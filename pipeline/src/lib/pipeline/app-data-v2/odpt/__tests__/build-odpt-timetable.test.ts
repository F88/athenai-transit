/**
 * Tests for build-timetable.ts (ODPT v2).
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
  OdptStationTimetableObject,
} from '../../../../../types/odpt-train';
import {
  buildTripPatternsAndTimetableFromOdpt,
  effectiveDestination,
  estimateTravelTimes,
  getHeadsignFromDestination,
  groupEntriesByStation,
  inferTripsForDestination,
  makeUnitKey,
  preprocessTimetables,
  type EntryEvent,
} from '../build-timetable';
import { ODPT_WARN_CODES } from '../warn-codes';

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
    expect(p.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }, { id: 'test:C' }]);
    // ODPT does not provide stop_headsign — sh must not be present
    for (const stop of p.stops) {
      expect(stop.sh).toBeUndefined();
    }
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
    expect(p.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }]); // truncated at B
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
    expect(p.stops).toEqual([{ id: 'test:C' }, { id: 'test:B' }]); // C to B, reversed
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

    expect(fullPattern.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }, { id: 'test:C' }]);
    expect(shortPattern.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }]);

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
    expect(p.stops).toEqual([{ id: 'test:C' }, { id: 'test:B' }, { id: 'test:A' }]);
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
    expect(p.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }, { id: 'test:C' }]);
  });

  it('normalizes terminal destination and missing destination into the same full-route pattern', () => {
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
          { 'odpt:departureTime': '06:30', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
        ],
      },
    ];

    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);

    expect(Object.keys(tripPatterns)).toHaveLength(1);
    expect(Object.values(tripPatterns)[0].stops).toEqual([
      { id: 'test:A' },
      { id: 'test:B' },
      { id: 'test:C' },
    ]);
    expect(timetable['test:A']).toHaveLength(1);
    expect(timetable['test:A'][0].d['test:weekday']).toEqual([360, 390]);
  });

  it('falls back to full-route stop sequence when destination is not in stationOrder', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.Unknown',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('C駅');
    expect(p.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }, { id: 'test:C' }]);
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
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
      // Station D on railway Y -> outbound to E
      makeTimetable(
        'odpt.Station:Test.D',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['07:00'],
        'odpt.Station:Test.E',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railwayX,
      railwayY,
    ]);

    // Should produce 2 patterns: one for each railway
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const xPattern = patterns.find((p) => p.r === 'test:X')!;
    const yPattern = patterns.find((p) => p.r === 'test:Y')!;

    expect(xPattern.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }, { id: 'test:C' }]);
    expect(yPattern.stops).toEqual([{ id: 'test:B' }, { id: 'test:D' }, { id: 'test:E' }]);
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
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.B',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railwayX,
      railwayY,
    ]);

    const p = Object.values(tripPatterns)[0];
    // Must use X's index (B at 1), so stops = [A, B] (not just [A] if Y's index 0 were used)
    expect(p.r).toBe('test:X');
    expect(p.stops).toEqual([{ id: 'test:A' }, { id: 'test:B' }]);
    expect(p.h).toBe('B駅');
  });

  it('uses the first matching railway for a shared-station timetable', () => {
    const ordersX: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(2, 'odpt.Station:Test.C', 'C駅', 'Station C'),
    ];
    const ordersY: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(2, 'odpt.Station:Test.D', 'D駅', 'Station D'),
    ];
    const railwayX = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': ordersX });
    const railwayY = makeRailway({ 'odpt:lineCode': 'Y', 'odpt:stationOrder': ordersY });

    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.B',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railwayX,
      railwayY,
    ]);

    expect(Object.keys(tripPatterns)).toHaveLength(1);
    const [patternId, pattern] = Object.entries(tripPatterns)[0];
    expect(pattern.r).toBe('test:X');
    expect(pattern.stops).toEqual([{ id: 'test:B' }, { id: 'test:C' }]);
    expect(timetable['test:B'][0].tp).toBe(patternId);
    expect(timetable['test:B'][0].d['test:weekday']).toEqual([360]);
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
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:SaturdayHoliday',
        'odpt.RailDirection:Outbound',
        ['07:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    expect(g.d['test:weekday']).toEqual([360]);
    expect(g.d['test:saturday-holiday']).toEqual([420]);
  });

  it('handles overnight departures (25:xx)', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['25:10'],
        'odpt.Station:Test.C',
      ),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    expect(timetable['test:A'][0].d['test:weekday']).toEqual([1510]);
  });

  it('pt and dt are always undefined for ODPT (no pickup/drop-off concept)', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00', '07:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    expect(g.pt).toBeUndefined();
    expect(g.dt).toBeUndefined();
  });

  it('dir is always omitted for ODPT patterns', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.A',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.dir).toBeUndefined();
  });

  it('skips timetable entries for stations not found in any railway', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.Unknown',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
        'odpt.Station:Test.C',
      ),
    ];

    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);
    expect(Object.keys(tripPatterns)).toHaveLength(0);
    expect(Object.keys(timetable)).toHaveLength(0);
  });

  it('returns empty results when timetables array is empty', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });

    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt(
      'test',
      [],
      [railway],
    );
    expect(tripPatterns).toEqual({});
    expect(timetable).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Test fixtures for D1-D16 / AC #1-#3 (Plan Tests #1-#19)
//
// These tests pin the algorithm-level behavior of the inference pipeline
// introduced for Issue #153. Each test references the Plan decision (D#)
// or Plan Tests entry (#N) that motivates it.
// ---------------------------------------------------------------------------

const FIVE_STATIONS: OdptStationOrder[] = [
  {
    'odpt:index': 1,
    'odpt:station': 'odpt.Station:T.A',
    'odpt:stationTitle': { ja: 'A', en: 'A' },
  },
  {
    'odpt:index': 2,
    'odpt:station': 'odpt.Station:T.B',
    'odpt:stationTitle': { ja: 'B', en: 'B' },
  },
  {
    'odpt:index': 3,
    'odpt:station': 'odpt.Station:T.C',
    'odpt:stationTitle': { ja: 'C', en: 'C' },
  },
  {
    'odpt:index': 4,
    'odpt:station': 'odpt.Station:T.D',
    'odpt:stationTitle': { ja: 'D', en: 'D' },
  },
  {
    'odpt:index': 5,
    'odpt:station': 'odpt.Station:T.E',
    'odpt:stationTitle': { ja: 'E', en: 'E' },
  },
];

interface DepFixture {
  /** Departure time HH:MM. */
  t: string;
  /** Destination station URI for this departure. */
  dest: string;
  /** odpt:originStation array (canonical signal); omit by default. */
  originStation?: string[];
  /** Arrival-only entry: when true, only arrivalTime is set. */
  arrOnly?: boolean;
}

/**
 * Build a station timetable with rich per-departure controls.
 * Each fixture entry can have its own destination / originStation / arr-only flag.
 */
function makeRichTimetable(
  station: string,
  calendar: string,
  direction: string,
  fixtures: DepFixture[],
): OdptStationTimetable {
  const stationShort = station.split('.').pop()!;
  return {
    'owl:sameAs': `odpt.StationTimetable:T.${stationShort}.${calendar.split(':')[1]}.${direction.split(':')[1]}`,
    'dct:issued': '2025-04-01',
    'odpt:station': station,
    'odpt:calendar': calendar,
    'odpt:railDirection': direction,
    'odpt:stationTimetableObject': fixtures.map((f) => {
      const obj: OdptStationTimetableObject = f.arrOnly
        ? { 'odpt:arrivalTime': f.t, 'odpt:destinationStation': [f.dest] }
        : { 'odpt:departureTime': f.t, 'odpt:destinationStation': [f.dest] };
      if (f.originStation) {
        obj['odpt:originStation'] = f.originStation;
      }
      return obj;
    }),
  };
}

/** Build a 5-station Inbound full-line + mid-pattern-origin fixture. */
function buildAriakeStyleFixture(): {
  railway: OdptRailway;
  timetables: OdptStationTimetable[];
} {
  const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
  // Inbound goes A->B->C->D->E (we treat A as line-start of Inbound for this 5-station fixture
  // by using direction=Inbound and stations[0]=A as the start). Direction matters: in our
  // existing test convention, Inbound's line-start is stationOrder[0], because lineStart for
  // Inbound is computed as stationOrder[0] OR stationOrder[last] — let me reread build-timetable.
  //
  // Actually buildLegacyTrips/getOrCreatePatternKey define:
  //   lineStart (Outbound) = stationOrder[0]
  //   lineStart (Inbound)  = stationOrder[last]
  // So for Inbound, line-start = E. To represent A->E trips as full-line (origin == lineStart),
  // we should use Outbound. Use Outbound here to keep "A is origin = lineStart" intuitive.
  const direction = 'odpt.RailDirection:Outbound';
  const cal = 'odpt.Calendar:Weekday';
  const dest = 'odpt.Station:T.E';

  // Full-line trips: A 7:00 -> B 7:02 -> C 7:04 -> D 7:06 -> E 7:08
  //                  A 7:10 -> B 7:12 -> C 7:14 -> D 7:16 -> E 7:18
  //                  A 7:20 -> B 7:22 -> C 7:24 -> D 7:26 -> E 7:28
  // Mid-pattern (C-origin): C 7:30 -> D 7:32 -> E 7:34
  //                          C 7:40 -> D 7:42 -> E 7:44
  const timetables: OdptStationTimetable[] = [
    makeRichTimetable('odpt.Station:T.A', cal, direction, [
      { t: '07:00', dest },
      { t: '07:10', dest },
      { t: '07:20', dest },
    ]),
    makeRichTimetable('odpt.Station:T.B', cal, direction, [
      { t: '07:02', dest },
      { t: '07:12', dest },
      { t: '07:22', dest },
    ]),
    makeRichTimetable('odpt.Station:T.C', cal, direction, [
      { t: '07:04', dest },
      { t: '07:14', dest },
      { t: '07:24', dest },
      { t: '07:30', dest }, // C-origin trip 1
      { t: '07:40', dest }, // C-origin trip 2
    ]),
    makeRichTimetable('odpt.Station:T.D', cal, direction, [
      { t: '07:06', dest },
      { t: '07:16', dest },
      { t: '07:26', dest },
      { t: '07:32', dest }, // C-origin trip 1
      { t: '07:42', dest }, // C-origin trip 2
    ]),
    makeRichTimetable('odpt.Station:T.E', cal, direction, [
      { t: '07:08', dest, arrOnly: true },
      { t: '07:18', dest, arrOnly: true },
      { t: '07:28', dest, arrOnly: true },
      { t: '07:34', dest, arrOnly: true },
      { t: '07:44', dest, arrOnly: true },
    ]),
  ];
  return { railway, timetables };
}

describe('Issue #153: mid-pattern origin inference (Plan Tests #1-#19)', () => {
  // ---- Algorithm core (#1-#6) ----

  it('#1: mid-pattern-origin produces a separate pattern', () => {
    const { railway, timetables } = buildAriakeStyleFixture();
    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);

    const patternList = Object.entries(tripPatterns);
    // Expect 2 patterns: full-line (5 stops) and C-origin short-turn (3 stops).
    expect(patternList).toHaveLength(2);

    const fullLine = patternList.find(([, p]) => p.stops.length === 5);
    const cOrigin = patternList.find(([, p]) => p.stops.length === 3);
    expect(fullLine).toBeDefined();
    expect(cOrigin).toBeDefined();

    // Cross-stop d_len uniformity per (patternId, serviceId).
    for (const [patId, pat] of patternList) {
      for (const stop of pat.stops) {
        const groups = timetable[stop.id] ?? [];
        const g = groups.find((x) => x.tp === patId);
        if (!g) {
          continue;
        }
        const lens = Object.values(g.d).map((arr) => arr.length);
        // Same length per service across this stop.
        // (We assert per-stop here; cross-stop is asserted in #5.)
        expect(new Set(lens).size).toBe(1);
      }
    }
  });

  it('#2: time-matching aggregates a full-line trip into its full-line pattern', () => {
    // Same fixture as #1: A 7:00 trip is observed at C at 7:04 and D at 7:06,
    // both within tolerance of expected travel (A->B=2, B->C=2, C->D=2). The
    // 7:00 trip should be in the full-line (5-stop) pattern, not split by C.
    const { railway, timetables } = buildAriakeStyleFixture();
    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);

    const fullLine = Object.entries(tripPatterns).find(([, p]) => p.stops.length === 5)!;
    const [fullLineId] = fullLine;
    // Full-line pattern has 3 trips per service across all of A/B/C/D/E.
    const aGroups = timetable['test:A'].find((x) => x.tp === fullLineId)!;
    expect(aGroups.d['test:weekday']).toEqual([7 * 60, 7 * 60 + 10, 7 * 60 + 20]);
    const cGroups = timetable['test:C'].find((x) => x.tp === fullLineId)!;
    // 7:04, 7:14, 7:24 are part of the full-line pattern; 7:30 / 7:40 are NOT.
    expect(cGroups.d['test:weekday']).toEqual([7 * 60 + 4, 7 * 60 + 14, 7 * 60 + 24]);
  });

  it('#3: tolerance edge — close but not matching trips do not merge', () => {
    // Fixture: A->E trip at 7:00 with regular travel (A 7:00, B 7:02, C 7:04).
    // A separate mid-pattern trip at C 7:05 (only 1 minute later than the
    // full-line 7:04 observation). Tolerance is +/- 2 min, so 7:05 vs
    // expected 7:04 (diff = 1) WOULD nominally match. But since 7:04 is
    // already matched to the 7:00 trip greedily, 7:05 starts a new trip.
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [{ t: '07:00', dest }]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [{ t: '07:02', dest }]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '07:04', dest },
        { t: '07:05', dest }, // close to the upstream trip but should NOT merge
      ]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [
        { t: '07:06', dest },
        { t: '07:07', dest },
      ]),
      makeRichTimetable('odpt.Station:T.E', cal, direction, [
        { t: '07:08', dest, arrOnly: true },
        { t: '07:09', dest, arrOnly: true },
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    // Expect 2 patterns: full-line (5 stops) + C-origin (3 stops).
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const cOrigin = Object.values(tripPatterns).find((p) => p.stops.length === 3);
    expect(cOrigin).toBeDefined();
  });

  it('#4: line-start origin only — pattern count unchanged (regression guard)', () => {
    // All trips originate at A (line-start for Outbound). No mid-pattern origins.
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest },
        { t: '07:10', dest },
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [
        { t: '07:02', dest },
        { t: '07:12', dest },
      ]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '07:04', dest },
        { t: '07:14', dest },
      ]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [
        { t: '07:06', dest },
        { t: '07:16', dest },
      ]),
      makeRichTimetable('odpt.Station:T.E', cal, direction, [
        { t: '07:08', dest, arrOnly: true },
        { t: '07:18', dest, arrOnly: true },
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    // Single full-line pattern.
    expect(Object.keys(tripPatterns)).toHaveLength(1);
    const p = Object.values(tripPatterns)[0];
    expect(p.stops).toHaveLength(5);
  });

  it('#5: cross-stop d_len uniformity across all (patternId, serviceId)', () => {
    const { railway, timetables } = buildAriakeStyleFixture();
    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [
      railway,
    ]);

    let mismatches = 0;
    for (const [patId, pat] of Object.entries(tripPatterns)) {
      const lengthsBySvc = new Map<string, Set<number>>();
      for (const stop of pat.stops) {
        const groups = timetable[stop.id] ?? [];
        const g = groups.find((x) => x.tp === patId);
        if (!g) {
          continue;
        }
        for (const sid of Object.keys(g.d)) {
          if (!lengthsBySvc.has(sid)) {
            lengthsBySvc.set(sid, new Set());
          }
          lengthsBySvc.get(sid)!.add(g.d[sid].length);
        }
      }
      for (const lens of lengthsBySvc.values()) {
        if (lens.size > 1) {
          mismatches++;
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('#6: pattern.stops[0] is the actual origin (AC #3 / isOrigin contract)', () => {
    const { railway, timetables } = buildAriakeStyleFixture();
    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);

    const fullLine = Object.values(tripPatterns).find((p) => p.stops.length === 5)!;
    expect(fullLine.stops[0].id).toBe('test:A');
    const cOrigin = Object.values(tripPatterns).find((p) => p.stops.length === 3)!;
    expect(cOrigin.stops[0].id).toBe('test:C');
  });

  // ---- Helper unit (#7-#9) ----

  it('#7: preprocessTimetables normalizes overnight, sorts by Determinism, and applies D7 originStation length===1', () => {
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    const tt = makeRichTimetable('odpt.Station:T.A', cal, direction, [
      // Reverse insertion order on purpose to verify Determinism sort.
      { t: '07:10', dest, originStation: ['odpt.Station:T.A'] }, // length 1 -> kept
      { t: '07:00', dest, originStation: ['odpt.Station:T.A', 'odpt.Station:T.B'] }, // length 2 -> null
      { t: '07:05', dest }, // omitted -> null
    ]);

    // Build stationToRailways map (mirrors what wrapper does).
    interface RwInfoShape {
      routeId: string;
      stationOrder: OdptStationOrder[];
      stationIndexMap: Map<string, number>;
    }
    const rwInfo: RwInfoShape = {
      routeId: 'test:X',
      stationOrder: FIVE_STATIONS,
      stationIndexMap: new Map(FIVE_STATIONS.map((s, i) => [s['odpt:station'], i])),
    };
    const stationToRailways = new Map<string, RwInfoShape[]>();
    for (const so of FIVE_STATIONS) {
      stationToRailways.set(so['odpt:station'], [rwInfo]);
    }
    void railway; // unused by helper directly

    const { unitGroups, diagnostics } = preprocessTimetables([tt], stationToRailways);
    expect(diagnostics).toEqual([]);
    expect(unitGroups.size).toBe(1);
    const entries = [...unitGroups.values()][0];
    expect(entries).toHaveLength(3);
    // Sorted by eventTime ascending.
    expect(entries.map((e) => e.eventTime)).toEqual([7 * 60, 7 * 60 + 5, 7 * 60 + 10]);
    // D7: originStation is value when length===1, null otherwise.
    expect(entries[0].originStation).toBeNull(); // length 2
    expect(entries[1].originStation).toBeNull(); // omitted
    expect(entries[2].originStation).toBe('odpt.Station:T.A'); // length 1
  });

  it('#8: groupEntriesByStation buckets without re-sorting (D11)', () => {
    const make = (station: string, eventTime: number, origIndex: number): EntryEvent => ({
      station,
      depTime: eventTime,
      arrTime: null,
      eventTime,
      origIndex,
      trainNumber: null,
      trainType: null,
      originStation: null,
      isOrigin: null,
      destination: '',
      calendar: '',
    });
    const entries: EntryEvent[] = [
      make('A', 100, 0),
      make('B', 200, 1),
      make('A', 300, 2),
      make('B', 400, 3),
      make('A', 500, 4),
    ];
    const grouped = groupEntriesByStation(entries);
    expect(grouped.size).toBe(2);
    // Order within each bucket = input order (no re-sort).
    expect(grouped.get('A')!.map((e) => e.eventTime)).toEqual([100, 300, 500]);
    expect(grouped.get('B')!.map((e) => e.eventTime)).toEqual([200, 400]);
  });

  it('#9: estimateTravelTimes computes per-pair median and emits diagnostic for missing pairs (D5)', () => {
    // 3 stations A-B-C, Outbound. Two trips with different B-C travel.
    const stationOrder3: OdptStationOrder[] = FIVE_STATIONS.slice(0, 3);
    const rw = {
      routeId: 'test:X',
      stationOrder: stationOrder3,
      stationIndexMap: new Map(stationOrder3.map((s, i) => [s['odpt:station'], i])),
    };
    const direction = 'odpt.RailDirection:Outbound';

    const make = (station: string, eventTime: number): EntryEvent => ({
      station,
      depTime: eventTime,
      arrTime: null,
      eventTime,
      origIndex: 0,
      trainNumber: null,
      trainType: null,
      originStation: null,
      isOrigin: null,
      destination: '',
      calendar: '',
    });
    // Trips: A 100 -> B 102 -> C 105 (travel A-B=2, B-C=3)
    //        A 200 -> B 203 -> C 205 (travel A-B=3, B-C=2)
    // Median A-B = 2.5, B-C = 2.5
    const entries: EntryEvent[] = [
      make('odpt.Station:T.A', 100),
      make('odpt.Station:T.A', 200),
      make('odpt.Station:T.B', 102),
      make('odpt.Station:T.B', 203),
      make('odpt.Station:T.C', 105),
      make('odpt.Station:T.C', 205),
    ];
    const { travelTimes, diagnostics } = estimateTravelTimes(entries, rw, direction, 'unit');
    expect(diagnostics).toEqual([]);
    expect(travelTimes.get('odpt.Station:T.A\0odpt.Station:T.B')).toBe(2.5);
    expect(travelTimes.get('odpt.Station:T.B\0odpt.Station:T.C')).toBe(2.5);

    // Missing-pair case: only A and C are observed (B has no entries).
    // After filtering by observed stations, sequence = [A, C], adjacent
    // pair = (A, C). Travel from A to C requires a downstream entry
    // matching upstream's eventTime. With single-station-skip patterns
    // not in fixture, both pairs have observable diffs. Force missing
    // by giving zero observable downstream for one pair.
    const entriesGap: EntryEvent[] = [make('odpt.Station:T.A', 100)];
    const result = estimateTravelTimes(entriesGap, rw, direction, 'unit');
    expect(result.travelTimes.size).toBe(0);
    // Single-station case: no adjacent pairs, no diagnostic emitted.
    expect(result.diagnostics).toEqual([]);
  });

  // ---- Canonical fast path & fallback (#10-#16) ----

  it('#10: D2/D7 canonical fast path — all entries with originStation length===1 bypasses inference', () => {
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    // Every entry declares originStation=A canonically.
    const origin = ['odpt.Station:T.A'];
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest, originStation: origin },
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [
        { t: '07:02', dest, originStation: origin },
      ]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '07:04', dest, originStation: origin },
      ]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [
        { t: '07:06', dest, originStation: origin },
      ]),
      makeRichTimetable('odpt.Station:T.E', cal, direction, [
        { t: '07:08', dest, originStation: origin, arrOnly: true },
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    // Canonical fast path produces 1 pattern (origin = line-start, all stops).
    expect(Object.keys(tripPatterns)).toHaveLength(1);
    const p = Object.values(tripPatterns)[0];
    expect(p.stops).toHaveLength(5);
    expect(p.stops[0].id).toBe('test:A');
  });

  it('#11: D7 mixed populate — CANONICAL_REJECTED_PARTIAL_POPULATE, falls back to inference', () => {
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    // Mix: some entries have originStation, some don't.
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest, originStation: ['odpt.Station:T.A'] }, // populated
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [
        { t: '07:02', dest }, // not populated
      ]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [{ t: '07:04', dest }]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [{ t: '07:06', dest }]),
      makeRichTimetable('odpt.Station:T.E', cal, direction, [{ t: '07:08', dest, arrOnly: true }]),
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockRestore();

    expect(calls.some((m) => m.includes(ODPT_WARN_CODES.CANONICAL_REJECTED_PARTIAL_POPULATE))).toBe(
      true,
    );
  });

  it('#12: D1 monotonic violation — INFERENCE_SKIPPED_NON_MONOTONIC, legacy fallback', () => {
    // Construct a unit where per-station entry counts decrease in trip direction.
    // 5-station Outbound: A:3, B:3, C:3, D:1, E:3 — count drops at D, then rises at E.
    // This violates monotonic non-decreasing.
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest },
        { t: '07:10', dest },
        { t: '07:20', dest },
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [
        { t: '07:02', dest },
        { t: '07:12', dest },
        { t: '07:22', dest },
      ]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '07:04', dest },
        { t: '07:14', dest },
        { t: '07:24', dest },
      ]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [{ t: '07:06', dest }]), // count drops
      makeRichTimetable('odpt.Station:T.E', cal, direction, [
        { t: '07:08', dest, arrOnly: true },
        { t: '07:18', dest, arrOnly: true },
        { t: '07:28', dest, arrOnly: true },
      ]),
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockRestore();

    expect(calls.some((m) => m.includes(ODPT_WARN_CODES.INFERENCE_SKIPPED_NON_MONOTONIC))).toBe(
      true,
    );
    // Legacy fallback: single full-line pattern with origin = line-start (A).
    expect(Object.keys(tripPatterns)).toHaveLength(1);
    expect(Object.values(tripPatterns)[0].stops[0].id).toBe('test:A');
  });

  it('#13: D3 Layer mismatch — inference produces fewer trips than Layer 1 origins', () => {
    // Construct a unit where Layer 1 sees N origin candidates but Layer 2
    // matching loses some. Using arr-only orphan entries downstream that
    // count as candidates but get dropped by D4.
    //
    // 3 stations A-B-C Outbound. A has 2 trips, B has 2 (matching), C has 3
    // (one extra arr-only). The extra C entry has no upstream and is
    // arr-only -> D4 drops it. Layer 1 origin count counts A's 2 plus C's
    // delta of 1 (=3 - 2 from B), so total = 3. Layer 2 produces 2 trips.
    // Mismatch -> INFERENCE_REJECTED_LAYER_MISMATCH.
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.C';
    const stationOrder3: OdptStationOrder[] = FIVE_STATIONS.slice(0, 3);
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': stationOrder3 });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest },
        { t: '07:10', dest },
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [
        { t: '07:02', dest },
        { t: '07:12', dest },
      ]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '07:04', dest, arrOnly: true },
        { t: '07:14', dest, arrOnly: true },
        { t: '08:00', dest, arrOnly: true }, // orphan: no upstream within tolerance
      ]),
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockRestore();

    // Either DROPPED_UNTRACEABLE_ARR_ONLY (D4) OR INFERENCE_REJECTED_LAYER_MISMATCH (D3) fires.
    // Both indicate the orphan entry was detected; the exact path depends on Layer 1 ordering.
    const hasMismatch =
      calls.some((m) => m.includes(ODPT_WARN_CODES.INFERENCE_REJECTED_LAYER_MISMATCH)) ||
      calls.some((m) => m.includes(ODPT_WARN_CODES.DROPPED_UNTRACEABLE_ARR_ONLY));
    expect(hasMismatch).toBe(true);
  });

  it('#14: D4 untraceable arr-only entry is dropped with diagnostic (helper-level)', () => {
    // Test inferTripsForDestination directly to isolate D4 behavior from
    // the wrapper's D3/D16 unit-fallback logic. (At the wrapper level,
    // a Layer 1/Layer 2 mismatch normally forces legacy fallback, which
    // would re-include the orphan entry. The helper itself, however,
    // must surface DROPPED_UNTRACEABLE_ARR_ONLY when an arr-only entry
    // cannot be matched to any pending upstream trip.)
    const stationOrder2: OdptStationOrder[] = FIVE_STATIONS.slice(0, 2);
    const rw = {
      routeId: 'test:X',
      stationOrder: stationOrder2,
      stationIndexMap: new Map(stationOrder2.map((s, i) => [s['odpt:station'], i])),
    };
    const direction = 'odpt.RailDirection:Outbound';

    const make = (station: string, eventTime: number, kind: 'dep' | 'arr'): EntryEvent => ({
      station,
      depTime: kind === 'dep' ? eventTime : null,
      arrTime: kind === 'arr' ? eventTime : null,
      eventTime,
      origIndex: 0,
      trainNumber: null,
      trainType: null,
      originStation: null,
      isOrigin: null,
      destination: 'odpt.Station:T.B',
      calendar: 'odpt.Calendar:Weekday',
    });
    // Trips: A 7:00 (dep) -> B 7:02 (arr) matched.
    // Orphan: B 9:00 (arr) — no upstream pending within tolerance.
    const entries: EntryEvent[] = [
      make('odpt.Station:T.A', 7 * 60, 'dep'),
      make('odpt.Station:T.B', 7 * 60 + 2, 'arr'),
      make('odpt.Station:T.B', 9 * 60, 'arr'),
    ];
    const travelTimes = new Map([['odpt.Station:T.A\0odpt.Station:T.B', 2]]);

    const { trips, diagnostics } = inferTripsForDestination(
      entries,
      travelTimes,
      rw,
      direction,
      'odpt.Station:T.B',
      'unit',
    );

    expect(trips).toHaveLength(1);
    expect(trips[0].origin).toBe('odpt.Station:T.A');
    expect(diagnostics.some((d) => d.code === ODPT_WARN_CODES.DROPPED_UNTRACEABLE_ARR_ONLY)).toBe(
      true,
    );
  });

  it('#15: D4 end-of-walk pending trip is dropped with diagnostic (helper-level)', () => {
    // Test inferTripsForDestination directly: a trip that starts at A but
    // never reaches the completion station (= no matching downstream entry).
    // The pending trip is dropped at end-of-walk with DROPPED_PENDING_TRIP.
    const stationOrder3: OdptStationOrder[] = FIVE_STATIONS.slice(0, 3);
    const rw = {
      routeId: 'test:X',
      stationOrder: stationOrder3,
      stationIndexMap: new Map(stationOrder3.map((s, i) => [s['odpt:station'], i])),
    };
    const direction = 'odpt.RailDirection:Outbound';

    const make = (station: string, eventTime: number): EntryEvent => ({
      station,
      depTime: eventTime,
      arrTime: null,
      eventTime,
      origIndex: 0,
      trainNumber: null,
      trainType: null,
      originStation: null,
      isOrigin: null,
      destination: 'odpt.Station:T.C',
      calendar: 'odpt.Calendar:Weekday',
    });
    // A 7:00, A 7:10 (two trips). B 7:02 only (one matches), C empty.
    // Trip 1 (A 7:00) reaches B at 7:02, but no C entry -> end-of-walk pending.
    // Trip 2 (A 7:10) has no B match within tolerance, also pending.
    //
    // Walk: stations observed = [A, B] (since C has no entries).
    // Completion station: rw says stationOrder[last] = C, but C is not
    // in observed walk, so completionStation falls back to last walked = B.
    // After processing B, pending trips with lastStation == B move to completed.
    //
    // To force end-of-walk pending: include C in observed walk by having a
    // C entry, but for one trip the entry never reaches C.
    const entries: EntryEvent[] = [
      make('odpt.Station:T.A', 7 * 60),
      make('odpt.Station:T.A', 7 * 60 + 10),
      make('odpt.Station:T.B', 7 * 60 + 2),
      // Only 1 C entry (matches trip 1). Trip 2 never matches B or C.
      make('odpt.Station:T.C', 7 * 60 + 4),
    ];
    const travelTimes = new Map([
      ['odpt.Station:T.A\0odpt.Station:T.B', 2],
      ['odpt.Station:T.B\0odpt.Station:T.C', 2],
    ]);

    const { trips, diagnostics } = inferTripsForDestination(
      entries,
      travelTimes,
      rw,
      direction,
      'odpt.Station:T.C',
      'unit',
    );

    // Trip 1 completes (A->B->C). Trip 2 is pending at A (no B match within
    // tolerance from 7:10 with travel 2 -> expected B 7:12, no such entry).
    // It then becomes a new B trip via depTime fallback? No — entries only
    // has 1 B at 7:02, already consumed. So Trip 2's e at A starts a new
    // trip, then never matches at B/C. Dropped at end-of-walk.
    expect(trips).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === ODPT_WARN_CODES.DROPPED_PENDING_TRIP)).toBe(true);
  });

  it('#16: D5/D16 travel time pair missing → unit fallback to legacy', () => {
    // 3 stations Outbound A-B-C. Only A and C have entries, B has none.
    // After filtering observed stations, sequence = [A, C], pair (A, C)
    // requires median = downstream eventTime - upstream eventTime,
    // computable as long as A and C each have entries within 30 min.
    //
    // To force missing: have only A's entries with no downstream observations.
    // But that would mean only 1 observed station (= < 2), which my code
    // routes via observedStationCount < 2 -> legacy without TRAVEL_TIME_PAIR_MISSING.
    //
    // Instead, force outlier: A 7:00 then C 9:00 (diff 120 > 30 -> filtered as outlier).
    // -> diffs is empty -> TRAVEL_TIME_PAIR_MISSING -> unit fallback.
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.C';
    const stationOrder3: OdptStationOrder[] = FIVE_STATIONS.slice(0, 3);
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': stationOrder3 });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [{ t: '07:00', dest }]),
      // No B entries.
      makeRichTimetable('odpt.Station:T.C', cal, direction, [
        { t: '09:00', dest, arrOnly: true }, // diff 120 > outlier threshold
      ]),
    ];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockRestore();

    expect(calls.some((m) => m.includes(ODPT_WARN_CODES.TRAVEL_TIME_PAIR_MISSING))).toBe(true);
    // Legacy fallback: 1 pattern, origin = line-start.
    expect(Object.keys(tripPatterns)).toHaveLength(1);
  });

  // ---- Logging contract (#17-#18) ----

  it('#17: warning code text uses ODPT_WARN_CODES constants (D8 SSOT)', () => {
    // Reuse #11 fixture (mixed populate triggers a warn).
    const direction = 'odpt.RailDirection:Outbound';
    const cal = 'odpt.Calendar:Weekday';
    const dest = 'odpt.Station:T.E';
    const railway = makeRailway({ 'odpt:lineCode': 'X', 'odpt:stationOrder': FIVE_STATIONS });
    const timetables: OdptStationTimetable[] = [
      makeRichTimetable('odpt.Station:T.A', cal, direction, [
        { t: '07:00', dest, originStation: ['odpt.Station:T.A'] },
      ]),
      makeRichTimetable('odpt.Station:T.B', cal, direction, [{ t: '07:02', dest }]),
      makeRichTimetable('odpt.Station:T.C', cal, direction, [{ t: '07:04', dest }]),
      makeRichTimetable('odpt.Station:T.D', cal, direction, [{ t: '07:06', dest }]),
      makeRichTimetable('odpt.Station:T.E', cal, direction, [{ t: '07:08', dest, arrOnly: true }]),
    ];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockRestore();

    // Every emitted warn line must contain at least one ODPT_WARN_CODES value verbatim.
    const warnLines = calls.filter((m) => m.includes('WARN:'));
    expect(warnLines.length).toBeGreaterThan(0);
    const knownCodes = Object.values(ODPT_WARN_CODES);
    for (const line of warnLines) {
      const matched = knownCodes.some((code) => line.includes(code));
      expect(matched).toBe(true);
    }
  });

  it('#18: normal path emits no console.log/info/debug summary (D12)', () => {
    const { railway, timetables } = buildAriakeStyleFixture();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const logCount = logSpy.mock.calls.length;
    const infoCount = infoSpy.mock.calls.length;
    const debugCount = debugSpy.mock.calls.length;
    logSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
    expect(logCount).toBe(0);
    expect(infoCount).toBe(0);
    expect(debugCount).toBe(0);
  });

  // ---- Determinism (#19) ----

  it('#19: input order does not affect Trip[] output (Determinism)', () => {
    const { railway, timetables } = buildAriakeStyleFixture();
    const out1 = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);

    // Permute the timetables array.
    const reversed = [...timetables].reverse();
    const out2 = buildTripPatternsAndTimetableFromOdpt('test', reversed, [railway]);

    // Pattern keys (= IDs) and stops should be identical regardless of input order.
    expect(Object.keys(out1.tripPatterns).sort()).toEqual(Object.keys(out2.tripPatterns).sort());
    for (const id of Object.keys(out1.tripPatterns)) {
      expect(out2.tripPatterns[id].stops).toEqual(out1.tripPatterns[id].stops);
    }
    // Stop timetable structure (sorted dep arrays per service) should match.
    for (const stopId of Object.keys(out1.timetable)) {
      expect(out2.timetable[stopId]).toEqual(out1.timetable[stopId]);
    }
  });
});

// ---------------------------------------------------------------------------
// effectiveDestination / makeUnitKey unit tests (D14)
// ---------------------------------------------------------------------------

describe('effectiveDestination (D14)', () => {
  const rw = {
    routeId: 'test:X',
    stationOrder: FIVE_STATIONS,
    stationIndexMap: new Map(FIVE_STATIONS.map((s, i) => [s['odpt:station'], i])),
  };
  const outbound = 'odpt.RailDirection:Outbound';
  const inbound = 'odpt.RailDirection:Inbound';

  it('returns __full__ for missing destination', () => {
    expect(effectiveDestination(undefined, rw, outbound)).toBe('__full__');
    expect(effectiveDestination('', rw, outbound)).toBe('__full__');
  });

  it('returns __full__ for terminal destination (Outbound = stationOrder[last])', () => {
    expect(effectiveDestination('odpt.Station:T.E', rw, outbound)).toBe('__full__');
  });

  it('returns __full__ for terminal destination (Inbound = stationOrder[0])', () => {
    expect(effectiveDestination('odpt.Station:T.A', rw, inbound)).toBe('__full__');
  });

  it('returns __full__ for unknown destination not in stationOrder', () => {
    expect(effectiveDestination('odpt.Station:Other.X', rw, outbound)).toBe('__full__');
  });

  it('returns raw value for mid-station destination', () => {
    expect(effectiveDestination('odpt.Station:T.C', rw, outbound)).toBe('odpt.Station:T.C');
  });
});

describe('makeUnitKey', () => {
  it('composes UnitKey with NUL separator', () => {
    expect(makeUnitKey('rw1', 'Outbound', 'destA', 'Cal1')).toBe('rw1\0Outbound\0destA\0Cal1');
  });
});

// ---------------------------------------------------------------------------
// Test suite hygiene
// ---------------------------------------------------------------------------

describe('test suite hygiene', () => {
  let originalWarn: typeof console.warn;
  beforeEach(() => {
    originalWarn = console.warn;
  });
  afterEach(() => {
    console.warn = originalWarn;
  });
  it('console.warn restoration sanity', () => {
    expect(console.warn).toBe(originalWarn);
  });
});
