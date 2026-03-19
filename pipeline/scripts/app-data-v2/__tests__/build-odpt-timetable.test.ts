/**
 * Tests for v2-build-odpt-timetable.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../types/odpt-train';
import {
  buildTripPatternsAndTimetableFromOdpt,
  getHeadsignFromDirection,
} from '../lib/odpt/build-timetable';

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

function makeTimetable(
  station: string,
  calendar: string,
  direction: string,
  departures: string[],
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
    })),
  };
}

describe('getHeadsignFromDirection', () => {
  const orders: OdptStationOrder[] = [
    makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
    makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
  ];

  it('returns last station for Outbound', () => {
    expect(getHeadsignFromDirection('odpt.RailDirection:Outbound', orders)).toBe('B駅');
  });

  it('returns first station for Inbound', () => {
    expect(getHeadsignFromDirection('odpt.RailDirection:Inbound', orders)).toBe('A駅');
  });
});

describe('buildTripPatternsAndTimetableFromOdpt', () => {
  const orders: OdptStationOrder[] = [
    makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
    makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
  ];

  it('creates patterns from direction + station order', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable('odpt.Station:Test.A', 'odpt.Calendar:Weekday', 'odpt.RailDirection:Outbound', [
        '06:00',
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const ids = Object.keys(tripPatterns);
    expect(ids).toHaveLength(1);

    const p = tripPatterns[ids[0]];
    expect(p.v).toBe(2);
    expect(p.r).toBe('test:U');
    expect(p.h).toBe('C駅'); // Outbound -> last station
    expect(p.stops).toEqual(['test:A', 'test:B', 'test:C']);
    expect(p.dir).toBeUndefined(); // ODPT has no direction_id
  });

  it('reverses stop order for Inbound direction', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable('odpt.Station:Test.C', 'odpt.Calendar:Weekday', 'odpt.RailDirection:Inbound', [
        '06:00',
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const p = Object.values(tripPatterns)[0];
    expect(p.h).toBe('A駅'); // Inbound -> first station
    expect(p.stops).toEqual(['test:C', 'test:B', 'test:A']);
  });

  it('builds timetable with correct structure', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable('odpt.Station:Test.A', 'odpt.Calendar:Weekday', 'odpt.RailDirection:Outbound', [
        '06:00',
        '06:15',
      ]),
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    expect(timetable['test:A']).toHaveLength(1);
    const g = timetable['test:A'][0];
    expect(g.v).toBe(2);
    expect(g.d['test:weekday']).toEqual([360, 375]);
    expect(g.a['test:weekday']).toEqual([360, 375]); // departure copied to arrival
    // ODPT: no pt/dt
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
          { 'odpt:arrivalTime': '06:10' }, // arrival only
          { 'odpt:departureTime': '06:20', 'odpt:arrivalTime': '06:19' }, // both
        ],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const g = timetable['test:A'][0];
    expect(g.d['test:weekday']).toEqual([360, 370, 380]);
    // arrival: 360 (copied from dep), 370 (from arrivalTime), 379 (from arrivalTime)
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
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00' },
          {}, // no time at all
        ],
      },
    ];

    const { timetable } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    expect(timetable['test:A'][0].d['test:weekday']).toEqual([360]);
  });

  it('assigns deterministic pattern IDs: {prefix}:p{1-indexed}', () => {
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const timetables: OdptStationTimetable[] = [
      makeTimetable('odpt.Station:Test.A', 'odpt.Calendar:Weekday', 'odpt.RailDirection:Outbound', [
        '06:00',
      ]),
      makeTimetable('odpt.Station:Test.C', 'odpt.Calendar:Weekday', 'odpt.RailDirection:Inbound', [
        '06:00',
      ]),
    ];

    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, [railway]);
    const ids = Object.keys(tripPatterns).sort();
    expect(ids).toEqual(['test:p1', 'test:p2']);
  });
});
