/**
 * Tests for build-timetable.ts (ODPT v2).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../../types/odpt-train';
import {
  buildTripPatternsAndTimetableFromOdpt,
  getHeadsignFromDestination,
} from '../build-timetable';

function makeOrder(
  index: number,
  station: string,
  nameJa: string,
  nameEn: string,
): OdptStationOrder {
  return {
    'odpt:index': index,
    'odpt:station': station,
    'odpt:stationTitle': { ja: nameJa, en: nameEn },
  };
}

function makeRailway(
  overrides: Partial<OdptRailway> & Pick<OdptRailway, 'odpt:lineCode' | 'odpt:stationOrder'>,
): OdptRailway {
  return {
    'dc:date': '2025-01-01',
    'dc:title': 'Test Railway',
    'odpt:color': '#00B2E5',
    'odpt:railwayTitle': { ja: 'テスト線', en: 'Test Line' },
    ...overrides,
  };
}

/** Create a timetable with destinationStation on each departure. */
function makeTimetable(
  station: string,
  calendar: string,
  direction: string,
  departures: string[],
  destination?: string,
): OdptStationTimetable {
  const stationShort = station.split('.').pop()!;
  return {
    'owl:sameAs': `odpt.StationTimetable:Test.${stationShort}.${calendar.split(':')[1]}`,
    'dct:issued': '2025-04-01',
    'odpt:station': station,
    'odpt:calendar': calendar,
    'odpt:railDirection': direction,
    'odpt:stationTimetableObject': departures.map((t) => ({
      'odpt:departureTime': t,
      ...(destination ? { 'odpt:destinationStation': [destination] } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// getHeadsignFromDestination
// ---------------------------------------------------------------------------

describe('getHeadsignFromDestination', () => {
  const orders: OdptStationOrder[] = [
    makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
    makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
  ];

  it('returns destination station name when provided', () => {
    expect(
      getHeadsignFromDestination('odpt.Station:Test.B', 'odpt.RailDirection:Outbound', orders),
    ).toBe('B駅');
  });

  it('falls back to last station for Outbound when destination is undefined', () => {
    expect(getHeadsignFromDestination(undefined, 'odpt.RailDirection:Outbound', orders)).toBe(
      'C駅',
    );
  });

  it('falls back to first station for Inbound when destination is undefined', () => {
    expect(getHeadsignFromDestination(undefined, 'odpt.RailDirection:Inbound', orders)).toBe('A駅');
  });

  it('falls back to direction terminal when destination not found in stationOrder', () => {
    expect(
      getHeadsignFromDestination(
        'odpt.Station:Test.Unknown',
        'odpt.RailDirection:Outbound',
        orders,
      ),
    ).toBe('C駅');
  });
});

// ---------------------------------------------------------------------------
// buildTripPatternsAndTimetableFromOdpt
// ---------------------------------------------------------------------------

describe('buildTripPatternsAndTimetableFromOdpt', () => {
  const orders: OdptStationOrder[] = [
    makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
    makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
  ];

  it('creates full-route pattern when destination is terminal', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C', // terminal = full route
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const ids = Object.keys(tripPatterns);
    expect(ids).toHaveLength(1);

    const p = tripPatterns[ids[0]];
    expect(p.v).toBe(2);
    expect(p.r).toBe('test:U');
    expect(p.h).toBe('C駅');
    expect(p.stops).toEqual(['test:A', 'test:B', 'test:C']);
  });

  it('creates truncated pattern for short-turn Outbound service', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.B', // short-turn: A -> B only
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('B駅');
    expect(p.stops).toEqual(['test:A', 'test:B']); // truncated at B
  });

  it('creates truncated pattern for short-turn Inbound service', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.C',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Inbound',
        ['06:00'],
        'odpt.Station:Test.B', // short-turn Inbound: C -> B only
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('B駅');
    expect(p.stops).toEqual(['test:C', 'test:B']); // C to B, reversed
  });

  it('separates full-route and short-turn into different patterns', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    // Station A: 2 departures to C (full), 1 departure to B (short-turn)
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
          { 'odpt:departureTime': '06:30', 'odpt:destinationStation': ['odpt.Station:Test.B'] },
          { 'odpt:departureTime': '07:00', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
        ],
      },
    ];

    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);

    // 2 patterns: full (A->C) and short-turn (A->B)
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const fullPattern = patterns.find((p) => p.h === 'C駅')!;
    const shortPattern = patterns.find((p) => p.h === 'B駅')!;

    expect(fullPattern.stops).toEqual(['test:A', 'test:B', 'test:C']);
    expect(shortPattern.stops).toEqual(['test:A', 'test:B']);

    // Timetable at A: 2 groups (one per pattern)
    const groups = timetable['test:A'];
    expect(groups).toHaveLength(2);

    const fullPatternId = Object.entries(tripPatterns).find(([, p]) => p.h === 'C駅')![0];
    const shortPatternId = Object.entries(tripPatterns).find(([, p]) => p.h === 'B駅')![0];

    const fullGroup = groups.find((g) => g.tp === fullPatternId)!;
    const shortGroup = groups.find((g) => g.tp === shortPatternId)!;

    expect(fullGroup.d['test:weekday']).toEqual([360, 420]); // 06:00, 07:00
    expect(shortGroup.d['test:weekday']).toEqual([390]); // 06:30
  });

  it('reverses stop order for full Inbound direction', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.C',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Inbound',
        ['06:00'],
        'odpt.Station:Test.A', // full Inbound to terminal
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('A駅');
    expect(p.stops).toEqual(['test:C', 'test:B', 'test:A']);
  });

  it('builds timetable with correct d/a structure', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00', '06:15'],
        'odpt.Station:Test.C',
      ),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    expect(timetable['test:A']).toHaveLength(1);
    const g = timetable['test:A'][0];
    expect(g.v).toBe(2);
    expect(g.d['test:weekday']).toEqual([360, 375]);
    expect(g.a['test:weekday']).toEqual([360, 375]);
    expect(g.pt).toBeUndefined();
    expect(g.dt).toBeUndefined();
  });

  it('uses arrivalTime when departureTime is absent', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00' },
          { 'odpt:arrivalTime': '06:10' },
          { 'odpt:departureTime': '06:20', 'odpt:arrivalTime': '06:19' },
        ],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    expect(g.d['test:weekday']).toEqual([360, 370, 380]);
    expect(g.a['test:weekday']).toEqual([360, 370, 379]);
  });

  it('skips entries with neither departure nor arrival time', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [{ 'odpt:departureTime': '06:00' }, {}],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    expect(timetable['test:A'][0].d['test:weekday']).toEqual([360]);
  });

  it('assigns deterministic pattern IDs: {prefix}:p{1-indexed}', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
      makeTimetable(
        'odpt.Station:Test.C',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Inbound',
        ['06:00'],
        'odpt.Station:Test.A',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const ids = Object.keys(tripPatterns).sort();
    expect(ids).toEqual(['test:p1', 'test:p2']);
  });

  it('handles departures without destinationStation (full route fallback)', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        // no destination = full route
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('C駅'); // fallback to terminal
    expect(p.stops).toEqual(['test:A', 'test:B', 'test:C']);
  });

  it('handles multiple railways with a shared station correctly', () => {
    // Railway X: stations A -> B -> C
    // Railway Y: stations B -> D -> E  (B is shared)
    const ordersX: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
    ];
    const ordersY: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(2, 'odpt.Station:Test.D', 'D駅', 'Station D'),
      makeOrder(3, 'odpt.Station:Test.E', 'E駅', 'Station E'),
    ];
    const railwayX = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': ordersX });
    const railwayY = makeRailway({ 'odpt:lineCode': 'Y', 'odpt:stationOrder': ordersY });

    const timetables: OdptStationTimetable[] = [
      // Station A on railway X -> outbound to C
      makeTimetable(
        'odpt.Station:Test.A', 'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound', ['06:00'],
        'odpt.Station:Test.C',
      ),
      // Station D on railway Y -> outbound to E
      makeTimetable(
        'odpt.Station:Test.D', 'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound', ['07:00'],
        'odpt.Station:Test.E',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt(
      'test', timetables, [railwayX, railwayY],
    );

    // Should produce 2 patterns: one for each railway
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const xPattern = patterns.find((p) => p.r === 'test:X')!;
    const yPattern = patterns.find((p) => p.r === 'test:Y')!;

    expect(xPattern.stops).toEqual(['test:A', 'test:B', 'test:C']);
    expect(yPattern.stops).toEqual(['test:B', 'test:D', 'test:E']);
  });

  it('uses per-railway station index for destination truncation (no cross-railway collision)', () => {
    // Railway X: A(0) -> B(1) -> C(2) -> D(3)
    // Railway Y: B(0) -> E(1) -> F(2)
    // B is at index 1 in X but index 0 in Y.
    // A short-turn on X to B should truncate at index 1, not index 0.
    const ordersX: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
      makeOrder(4, 'odpt.Station:Test.D', 'D駅', 'Station D'),
    ];
    const ordersY: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(2, 'odpt.Station:Test.E', 'E駅', 'Station E'),
      makeOrder(3, 'odpt.Station:Test.F', 'F駅', 'Station F'),
    ];
    const railwayX = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': ordersX });
    const railwayY = makeRailway({ 'odpt:lineCode': 'Y', 'odpt:stationOrder': ordersY });

    const timetables: OdptStationTimetable[] = [
      // Short-turn on X: A -> B (destination B is at index 1 in X)
      makeTimetable(
        'odpt.Station:Test.A', 'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound', ['06:00'],
        'odpt.Station:Test.B',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt(
      'test', timetables, [railwayX, railwayY],
    );

    const p = Object.values(tripPatterns)[0];
    // Must use X's index (B at 1), so stops = [A, B] (not just [A] if Y's index 0 were used)
    expect(p.r).toBe('test:X');
    expect(p.stops).toEqual(['test:A', 'test:B']);
    expect(p.h).toBe('B駅');
  });

  it('d and a array lengths are equal for each service_id', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00', 'odpt:arrivalTime': '05:59' },
          { 'odpt:departureTime': '06:15' },
          { 'odpt:arrivalTime': '06:30' },
        ],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    const dLen = g.d['test:weekday'].length;
    expect(g.a['test:weekday']).toHaveLength(dLen);
    expect(dLen).toBe(3);
  });

  it('departures within a service_id are sorted ascending', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '09:00', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
          { 'odpt:departureTime': '06:00', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
          { 'odpt:departureTime': '07:30', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
        ],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const d = timetable['test:A'][0].d['test:weekday'];
    // Must be sorted ascending
    for (let i = 1; i < d.length; i++) {
      expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    }
    expect(d).toEqual([360, 450, 540]);
  });

  it('multiple calendar types produce separate service_id entries in same group', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A', 'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound', ['06:00'],
        'odpt.Station:Test.C',
      ),
      makeTimetable(
        'odpt.Station:Test.A', 'odpt.Calendar:SaturdayHoliday',
        'odpt.RailDirection:Outbound', ['07:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    expect(g.d['test:weekday']).toEqual([360]);
    expect(g.d['test:saturday-holiday']).toEqual([420]);
  });
});
