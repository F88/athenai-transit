/**
 * Tests for odpt-station-timetable-analysis.ts analysis functions.
 *
 * Uses minimal ODPT data fixtures to verify each analysis function
 * detects the expected patterns.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OdptRailway,
  OdptStationTimetable,
  OdptStationTimetableObject,
} from '../../../types/odpt-train';
import {
  analyzeOdptStationTimetable,
  formatOdptAnalysis,
} from '../lib/odpt-station-timetable-analysis';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRailway(stationIds: string[]): OdptRailway {
  return {
    'dc:date': '2026-01-01',
    'dc:title': 'Test Railway',
    'odpt:color': '#FF0000',
    'odpt:lineCode': 'T',
    'odpt:railwayTitle': { ja: 'テスト線', en: 'Test Line' },
    'odpt:stationOrder': stationIds.map((id, i) => ({
      'odpt:index': i,
      'odpt:station': id,
      'odpt:stationTitle': { ja: `駅${id}`, en: `Station ${id}` },
    })),
  };
}

function makeTimetable(
  station: string,
  direction: 'Outbound' | 'Inbound',
  calendar: string,
  objects: OdptStationTimetableObject[],
): OdptStationTimetable {
  return {
    'owl:sameAs': `odpt.StationTimetable:Test.${station}.${direction}.${calendar}`,
    'dct:issued': '2026-01-01',
    'odpt:station': station,
    'odpt:calendar': `odpt.Calendar:${calendar}`,
    'odpt:railDirection': `odpt.RailDirection:${direction}`,
    'odpt:stationTimetableObject': objects,
  };
}

function makeObject(overrides?: Partial<OdptStationTimetableObject>): OdptStationTimetableObject {
  return {
    'odpt:departureTime': '08:00',
    'odpt:destinationStation': ['odpt.Station:Test.C'],
    'odpt:trainType': 'odpt.TrainType:Test.Local',
    ...overrides,
  };
}

const STATION_A = 'odpt.Station:Test.A';
const STATION_B = 'odpt.Station:Test.B';
const STATION_C = 'odpt.Station:Test.C';

// ---------------------------------------------------------------------------
// #1 Time Fields
// ---------------------------------------------------------------------------

describe('timeFields', () => {
  it('counts objects with departureTime only', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:departureTime': '08:00' }),
        makeObject({ 'odpt:departureTime': '09:00' }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.timeFields.totalObjects).toBe(2);
    expect(result.timeFields.withDepartureTime).toBe(2);
    expect(result.timeFields.withArrivalTime).toBe(0);
    expect(result.timeFields.withBoth).toBe(0);
    expect(result.timeFields.withNeither).toBe(0);
  });

  it('counts objects with both arrival and departure', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:arrivalTime': '07:59', 'odpt:departureTime': '08:00' }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.timeFields.withBoth).toBe(1);
    expect(result.timeFields.withArrivalTime).toBe(1);
    expect(result.timeFields.withDepartureTime).toBe(1);
  });

  it('counts objects with neither time field', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:arrivalTime': undefined, 'odpt:departureTime': undefined }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.timeFields.withNeither).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// #2 Station Coverage
// ---------------------------------------------------------------------------

describe('stationCoverage', () => {
  it('detects stations missing timetable data', () => {
    const railway = makeRailway([STATION_A, STATION_B, STATION_C]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_C, 'Inbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.stationCoverage.stationOrderCount).toBe(3);
    expect(result.stationCoverage.stationsWithTimetable).toBe(2);
    expect(result.stationCoverage.missingStations).toEqual([STATION_B]);
  });

  it('reports no missing stations when all have timetables', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_B, 'Outbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.stationCoverage.missingStations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #3 Direction Coverage
// ---------------------------------------------------------------------------

describe('directionCoverage', () => {
  it('detects stations with only one direction', () => {
    const railway = makeRailway([STATION_A, STATION_B, STATION_C]);
    const timetables = [
      // A: Outbound only (first station — no inbound departures)
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      // B: both directions
      makeTimetable(STATION_B, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_B, 'Inbound', 'Weekday', [makeObject()]),
      // C: Inbound only (last station — no outbound departures)
      makeTimetable(STATION_C, 'Inbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.directionCoverage.outboundOnly).toEqual([STATION_A]);
    expect(result.directionCoverage.inboundOnly).toEqual([STATION_C]);
  });

  it('reports all stations have both directions when applicable', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_A, 'Inbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_B, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_B, 'Inbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.directionCoverage.outboundOnly).toEqual([]);
    expect(result.directionCoverage.inboundOnly).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #4 Calendar Coverage
// ---------------------------------------------------------------------------

describe('calendarCoverage', () => {
  it('detects stations missing calendar types', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_A, 'Outbound', 'SaturdayHoliday', [makeObject()]),
      // B has only Weekday
      makeTimetable(STATION_B, 'Outbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.calendarCoverage.calendarIds).toEqual([
      'odpt.Calendar:SaturdayHoliday',
      'odpt.Calendar:Weekday',
    ]);
    expect(result.calendarCoverage.stationsWithAllCalendars).toBe(1);
    expect(result.calendarCoverage.stationsMissingCalendars).toEqual([
      { station: STATION_B, missing: ['odpt.Calendar:SaturdayHoliday'] },
    ]);
  });

  it('reports all stations have all calendars when applicable', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]),
      makeTimetable(STATION_B, 'Outbound', 'Weekday', [makeObject()]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.calendarCoverage.stationsWithAllCalendars).toBe(2);
    expect(result.calendarCoverage.stationsMissingCalendars).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #5 Destinations
// ---------------------------------------------------------------------------

describe('destinations', () => {
  it('counts destination distribution', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:destinationStation': ['odpt.Station:Test.C'] }),
        makeObject({ 'odpt:destinationStation': ['odpt.Station:Test.C'] }),
        makeObject({ 'odpt:destinationStation': ['odpt.Station:Test.D'] }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.destinations.totalObjectsWithDestination).toBe(3);
    expect(result.destinations.uniqueDestinations).toBe(2);
    expect(result.destinations.top[0]).toEqual({
      destination: 'odpt.Station:Test.C',
      count: 2,
    });
  });

  it('counts objects without destination', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:destinationStation': undefined }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.destinations.totalObjectsWithoutDestination).toBe(1);
    expect(result.destinations.totalObjectsWithDestination).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #6 Train Types
// ---------------------------------------------------------------------------

describe('trainTypes', () => {
  it('counts train type distribution', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:trainType': 'odpt.TrainType:Test.Local' }),
        makeObject({ 'odpt:trainType': 'odpt.TrainType:Test.Local' }),
        makeObject({ 'odpt:trainType': 'odpt.TrainType:Test.Express' }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.trainTypes.totalObjectsWithTrainType).toBe(3);
    expect(result.trainTypes.uniqueTrainTypes).toBe(2);
    expect(result.trainTypes.top[0]).toEqual({
      trainType: 'odpt.TrainType:Test.Local',
      count: 2,
    });
  });

  it('counts objects without trainType', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [
        makeObject({ 'odpt:trainType': undefined }),
      ]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.trainTypes.totalObjectsWithoutTrainType).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// #7 Flags
// ---------------------------------------------------------------------------

describe('flags', () => {
  it('detects isLast and isOrigin flags', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const objWithFlags: OdptStationTimetableObject = {
      ...makeObject(),
      'odpt:isLast': true,
      'odpt:isOrigin': true,
    };
    const timetables = [
      makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject(), objWithFlags]),
    ];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.flags.totalObjects).toBe(2);
    expect(result.flags.withIsLast).toBe(1);
    expect(result.flags.withIsOrigin).toBe(1);
  });

  it('returns zero when no flags present', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()])];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.flags.withIsLast).toBe(0);
    expect(result.flags.withIsOrigin).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #8 Unknown Keys
// ---------------------------------------------------------------------------

describe('unknownKeys', () => {
  it('detects unknown keys in timetable objects', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const objWithUnknown = {
      ...makeObject(),
      'odpt:unknownField': 'test',
    } as unknown as OdptStationTimetableObject;
    const timetables = [makeTimetable(STATION_A, 'Outbound', 'Weekday', [objWithUnknown])];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.unknownKeys.objectKeys).toEqual([{ key: 'odpt:unknownField', count: 1 }]);
  });

  it('detects unknown keys in top-level timetable', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const tt = makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()]);
    (tt as unknown as Record<string, unknown>)['odpt:customField'] = 'test';
    const timetables = [tt];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.unknownKeys.timetableKeys).toEqual([{ key: 'odpt:customField', count: 1 }]);
  });

  it('returns empty when no unknown keys', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()])];

    const result = analyzeOdptStationTimetable(timetables, railway);
    expect(result.unknownKeys.objectKeys).toEqual([]);
    expect(result.unknownKeys.timetableKeys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatOdptAnalysis
// ---------------------------------------------------------------------------

describe('formatOdptAnalysis', () => {
  it('produces output containing source name and all section headers', () => {
    const railway = makeRailway([STATION_A, STATION_B]);
    const timetables = [makeTimetable(STATION_A, 'Outbound', 'Weekday', [makeObject()])];

    const result = analyzeOdptStationTimetable(timetables, railway);
    const output = formatOdptAnalysis('test-source', result);

    expect(output).toContain('=== test-source ===');
    expect(output).toContain('## Time Field Availability');
    expect(output).toContain('## Station Coverage');
    expect(output).toContain('## Direction Coverage');
    expect(output).toContain('## Calendar Coverage');
    expect(output).toContain('## Destination Distribution');
    expect(output).toContain('## Train Type Distribution');
    expect(output).toContain('## isLast / isOrigin Flags');
    expect(output).toContain('## Unknown Keys');
  });
});
