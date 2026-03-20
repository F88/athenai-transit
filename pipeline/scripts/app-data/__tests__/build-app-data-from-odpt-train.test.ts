/**
 * Tests for build-app-data-from-odpt-train.ts pure functions.
 *
 * Uses inline fixture objects to verify each exported function produces
 * correct output without requiring file system access or network calls.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OdptRailway,
  OdptStation,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../types/odpt-train';
import type { Provider } from '../../../types/resource-common';
import {
  buildAgency,
  buildRoutes,
  buildStops,
  buildTimetable,
  buildTranslations,
  calendarToServiceId,
  computeDateRange,
  extractStationShortId,
  getHeadsignFromDestination,
  getHeadsignFromDirection,
  timeToMinutes,
} from '../build-app-data-from-odpt-train';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Create a minimal OdptStation with required fields only. */
function makeStation(
  sameAs: string,
  nameJa: string,
  nameEn: string,
  lat: number,
  lon: number,
): OdptStation {
  return {
    'owl:sameAs': sameAs,
    'dc:date': '2025-01-01',
    'geo:lat': lat,
    'geo:long': lon,
    'odpt:stationCode': '',
    'odpt:stationTitle': { ja: nameJa, en: nameEn },
  };
}

/** Create a minimal OdptStationOrder entry. */
function makeStationOrder(
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

/** Create a minimal OdptRailway. */
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

/** Create a minimal OdptStationTimetable entry. */
function makeTimetable(
  station: string,
  calendar: string,
  direction: string,
  departures: string[],
): OdptStationTimetable {
  return {
    'owl:sameAs': `odpt.StationTimetable:Test.${extractStationShortId(station)}.${calendar.split(':')[1]}`,
    'dct:issued': '2025-04-01',
    'odpt:station': station,
    'odpt:calendar': calendar,
    'odpt:railDirection': direction,
    'odpt:stationTimetableObject': departures.map((t) => ({
      'odpt:departureTime': t,
      'odpt:destinationStation': [],
    })),
  };
}

/**
 * Create an OdptStationTimetable with raw stationTimetableObject entries.
 * Unlike {@link makeTimetable}, this accepts raw objects so callers can
 * include entries with missing departureTime.
 */
function makeTimetableWithRawObjects(
  station: string,
  calendar: string,
  direction: string,
  objects: OdptStationTimetable['odpt:stationTimetableObject'],
): OdptStationTimetable {
  return {
    'owl:sameAs': `odpt.StationTimetable:Test.${extractStationShortId(station)}.${calendar.split(':')[1]}`,
    'dct:issued': '2025-04-01',
    'odpt:station': station,
    'odpt:calendar': calendar,
    'odpt:railDirection': direction,
    'odpt:stationTimetableObject': objects,
  };
}

/** Default provider for tests. */
const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
};

// ---------------------------------------------------------------------------
// extractStationShortId
// ---------------------------------------------------------------------------

describe('extractStationShortId', () => {
  it('extracts the last segment from a Yurikamome station ID', () => {
    expect(extractStationShortId('odpt.Station:Yurikamome.Shimbashi')).toBe('Shimbashi');
  });

  it('extracts the last segment from a Tokyo Metro station ID', () => {
    expect(extractStationShortId('odpt.Station:TokyoMetro.Ginza')).toBe('Ginza');
  });
});

// ---------------------------------------------------------------------------
// calendarToServiceId
// ---------------------------------------------------------------------------

describe('calendarToServiceId', () => {
  it('converts Weekday to lowercase', () => {
    expect(calendarToServiceId('odpt.Calendar:Weekday')).toBe('weekday');
  });

  it('converts SaturdayHoliday to kebab-case', () => {
    expect(calendarToServiceId('odpt.Calendar:SaturdayHoliday')).toBe('saturday-holiday');
  });

  it('converts Saturday to lowercase', () => {
    expect(calendarToServiceId('odpt.Calendar:Saturday')).toBe('saturday');
  });

  it('converts Holiday to lowercase', () => {
    expect(calendarToServiceId('odpt.Calendar:Holiday')).toBe('holiday');
  });
});

// ---------------------------------------------------------------------------
// timeToMinutes
// ---------------------------------------------------------------------------

describe('timeToMinutes', () => {
  it('converts 06:30 to 390 minutes', () => {
    expect(timeToMinutes('06:30')).toBe(390);
  });

  it('converts 00:00 to 0 minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 23:59 to 1439 minutes', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('converts overnight time 25:30 to 1530 minutes', () => {
    expect(timeToMinutes('25:30')).toBe(1530);
  });
});

// ---------------------------------------------------------------------------
// getHeadsignFromDirection
// ---------------------------------------------------------------------------

describe('getHeadsignFromDirection', () => {
  const stationOrder: OdptStationOrder[] = [
    makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
    makeStationOrder(2, 'odpt.Station:Test.Odaiba', 'お台場海浜公園', 'Odaiba-kaihinkoen'),
    makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
  ];

  it('returns last station name for Outbound direction', () => {
    expect(getHeadsignFromDirection('odpt.RailDirection:Outbound', stationOrder)).toBe('豊洲');
  });

  it('returns first station name for Inbound direction', () => {
    expect(getHeadsignFromDirection('odpt.RailDirection:Inbound', stationOrder)).toBe('新橋');
  });
});

// ---------------------------------------------------------------------------
// computeDateRange
// ---------------------------------------------------------------------------

describe('computeDateRange', () => {
  it('computes a 2-year range from issued date', () => {
    const result = computeDateRange('2025-04-01');
    expect(result).toEqual({ startDate: '20250401', endDate: '20270401' });
  });

  it('handles leap year: Feb 29 + 2 years clamps to Feb 28', () => {
    const result = computeDateRange('2000-02-29');
    expect(result).toEqual({ startDate: '20000229', endDate: '20020228' });
  });

  it('handles year-end date', () => {
    const result = computeDateRange('2025-12-31');
    expect(result).toEqual({ startDate: '20251231', endDate: '20271231' });
  });
});

// ---------------------------------------------------------------------------
// buildStops
// ---------------------------------------------------------------------------

describe('buildStops', () => {
  it('sorts stations by stationOrder index', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.Toyosu', '豊洲', 'Toyosu', 35.6461, 139.7914),
      makeStation('odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi', 35.6658, 139.7584),
    ];
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];

    const result = buildStops('test', stations, stationOrders, TEST_PROVIDER);

    expect(result).toHaveLength(2);
    // Shimbashi (index 1) should come first despite being second in input
    expect(result[0].i).toBe('test:Shimbashi');
    expect(result[1].i).toBe('test:Toyosu');
  });

  it('produces correct output format with prefix and ai field', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi', 35.6658, 139.7584),
    ];
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
    ];

    const result = buildStops('yrkm', stations, stationOrders, TEST_PROVIDER);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'yrkm:Shimbashi',
      n: '新橋',
      a: 35.6658,
      o: 139.7584,
      l: 0,
      ai: 'yrkm:Test Transit',
    });
  });

  it('merges stationOrders from 2 railways and sorts all stations', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:LineB.StationC', '駅C', 'Station C', 35.68, 139.78),
      makeStation('odpt.Station:LineA.StationA', '駅A', 'Station A', 35.66, 139.76),
      makeStation('odpt.Station:LineA.StationB', '駅B', 'Station B', 35.67, 139.77),
    ];
    // Railway A: StationA (index 1), StationB (index 2)
    // Railway B: StationC (index 1)
    const mergedOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:LineA.StationA', '駅A', 'Station A'),
      makeStationOrder(2, 'odpt.Station:LineA.StationB', '駅B', 'Station B'),
      makeStationOrder(1, 'odpt.Station:LineB.StationC', '駅C', 'Station C'),
    ];

    const result = buildStops('test', stations, mergedOrders, TEST_PROVIDER);

    expect(result).toHaveLength(3);
    // index 1 stations come first, then index 2
    // Within the same index, original array order is preserved (StationC before StationA)
    expect(result[0].i).toBe('test:StationC');
    expect(result[1].i).toBe('test:StationA');
    expect(result[2].i).toBe('test:StationB');
  });
});

// ---------------------------------------------------------------------------
// buildRoutes
// ---------------------------------------------------------------------------

describe('buildRoutes', () => {
  it('builds a single route from a railway', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:railwayTitle': { ja: 'ゆりかもめ', en: 'Yurikamome' },
      'odpt:color': '#00B2E5',
      'odpt:stationOrder': [],
    });

    const result = buildRoutes('yrkm', railway, TEST_PROVIDER);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'yrkm:U',
      s: '',
      l: 'ゆりかもめ',
      t: 2,
      c: '00B2E5',
      tc: '',
      ai: 'yrkm:Test Transit',
    });
  });

  it('builds routes from two railways', () => {
    const railwayA = makeRailway({
      'odpt:lineCode': 'A',
      'odpt:railwayTitle': { ja: 'A線', en: 'Line A' },
      'odpt:stationOrder': [],
    });
    const railwayB = makeRailway({
      'odpt:lineCode': 'B',
      'odpt:railwayTitle': { ja: 'B線', en: 'Line B' },
      'odpt:stationOrder': [],
    });

    const resultA = buildRoutes('test', railwayA, TEST_PROVIDER);
    const resultB = buildRoutes('test', railwayB, TEST_PROVIDER);
    const combined = [...resultA, ...resultB];

    expect(combined).toHaveLength(2);
    expect(combined[0].i).toBe('test:A');
    expect(combined[1].i).toBe('test:B');
  });
});

// ---------------------------------------------------------------------------
// buildTimetable
// ---------------------------------------------------------------------------

describe('buildTimetable', () => {
  it('builds timetable with correct structure', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Odaiba', 'お台場海浜公園', 'Odaiba-kaihinkoen'),
      makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });

    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00', '06:15', '06:30'],
      ),
    ];

    const result = buildTimetable('yrkm', timetables, [railway], TEST_PROVIDER);

    // Should have one stop
    expect(Object.keys(result)).toEqual(['yrkm:Shimbashi']);

    const groups = result['yrkm:Shimbashi'];
    expect(groups).toHaveLength(1);
    expect(groups[0].r).toBe('yrkm:U');
    expect(groups[0].h).toBe('豊洲'); // Outbound -> last station
    expect(groups[0].d).toEqual({
      'yrkm:weekday': [360, 375, 390],
    });
  });

  it('skips entries without departureTime', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Odaiba', 'お台場海浜公園', 'Odaiba-kaihinkoen'),
      makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });

    const timetables: OdptStationTimetable[] = [
      makeTimetableWithRawObjects(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        [
          {
            'odpt:departureTime': '06:00',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          // Entry without departureTime (arrival-only)
          {
            'odpt:arrivalTime': '06:10',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          {
            'odpt:departureTime': '06:30',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          // Entry with neither departureTime nor arrivalTime
          { 'odpt:destinationStation': ['odpt.Station:Test.Toyosu'] },
        ],
      ),
    ];

    const result = buildTimetable('yrkm', timetables, [railway], TEST_PROVIDER);

    const groups = result['yrkm:Shimbashi'];
    expect(groups).toHaveLength(1);
    // Only entries with departureTime should be included (06:00 and 06:30)
    expect(groups[0].d).toEqual({
      'yrkm:weekday': [360, 390],
    });
    // Headsign should still be derived correctly from destinationStation
    expect(groups[0].h).toBe('豊洲');
  });

  it('produces no timetable entry when all entries lack departureTime', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });

    const timetables: OdptStationTimetable[] = [
      makeTimetableWithRawObjects(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        [
          // All entries lack departureTime — skipped
          {
            'odpt:arrivalTime': '06:10',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          { 'odpt:destinationStation': ['odpt.Station:Test.Toyosu'] },
        ],
      ),
    ];

    const result = buildTimetable('yrkm', timetables, [railway], TEST_PROVIDER);

    // No departures -> empty groups array for this stop
    expect(result['yrkm:Shimbashi']).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildTranslations
// ---------------------------------------------------------------------------

describe('buildTranslations', () => {
  it('generates headsign translations with ja/en keys', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi', 35.6658, 139.7584),
      makeStation('odpt.Station:Test.Toyosu', '豊洲', 'Toyosu', 35.6461, 139.7914),
    ];

    const timetables: OdptStationTimetable[] = [
      makeTimetable(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        ['06:00'],
      ),
      makeTimetable(
        'odpt.Station:Test.Toyosu',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Inbound',
        ['06:30'],
      ),
    ];

    const result = buildTranslations('test', timetables, [railway], stations, TEST_PROVIDER);

    // Outbound headsign: 豊洲
    expect(result.headsigns['豊洲']).toEqual({ ja: '豊洲', en: 'Toyosu' });
    // Inbound headsign: 新橋
    expect(result.headsigns['新橋']).toEqual({ ja: '新橋', en: 'Shimbashi' });
    // stop_headsigns should be empty
    expect(result.stop_headsigns).toEqual({});
  });

  it('generates stop_names keyed by prefixed stop_id', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi', 35.6658, 139.7584),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': [
        makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      ],
    });

    const result = buildTranslations('yrkm', [], [railway], stations, TEST_PROVIDER);

    expect(result.stop_names['yrkm:Shimbashi']).toEqual({ ja: '新橋', en: 'Shimbashi' });
  });

  it('generates route_names keyed by prefixed route_id', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:railwayTitle': { ja: 'ゆりかもめ', en: 'Yurikamome' },
      'odpt:stationOrder': [],
    });

    const result = buildTranslations('yrkm', [], [railway], [], TEST_PROVIDER);

    expect(result.route_names['yrkm:U']).toEqual({ ja: 'ゆりかもめ', en: 'Yurikamome' });
  });

  it('generates agency_names keyed by prefixed agency_id', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': [],
    });

    const result = buildTranslations('yrkm', [], [railway], [], TEST_PROVIDER);

    expect(result.agency_names['yrkm:Test Transit']).toEqual({
      ja: 'テスト交通',
      en: 'Test Transit',
    });
  });

  it('generates agency_short_names keyed by prefixed agency_id', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': [],
    });

    const result = buildTranslations('yrkm', [], [railway], [], TEST_PROVIDER);

    expect(result.agency_short_names['yrkm:Test Transit']).toEqual({
      ja: 'テスト',
      en: 'Test',
    });
  });
});

// ---------------------------------------------------------------------------
// buildAgency
// ---------------------------------------------------------------------------

describe('buildAgency', () => {
  it('builds agency with provider info', () => {
    const result = buildAgency('yrkm', TEST_PROVIDER);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'yrkm:Test Transit',
      n: 'テスト交通',
      sn: 'テスト',
      u: 'https://example.com',
      l: 'ja',
      tz: 'Asia/Tokyo',
      fu: '',
      cs: [],
    });
  });

  it('includes provider colors in cs field', () => {
    const providerWithColors: Provider = {
      ...TEST_PROVIDER,
      colors: [{ bg: '00B2E5', text: 'FFFFFF' }],
    };
    const result = buildAgency('yrkm', providerWithColors);

    expect(result[0].cs).toEqual([{ b: '00B2E5', t: 'FFFFFF' }]);
  });
});

// ---------------------------------------------------------------------------
// getHeadsignFromDestination
// ---------------------------------------------------------------------------

describe('getHeadsignFromDestination', () => {
  const stationOrder: OdptStationOrder[] = [
    makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
    makeStationOrder(2, 'odpt.Station:Test.Ariake', '有明', 'Ariake'),
    makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
  ];

  it('returns destination station name when found in stationOrder', () => {
    expect(
      getHeadsignFromDestination(
        'odpt.Station:Test.Ariake',
        'odpt.RailDirection:Outbound',
        stationOrder,
      ),
    ).toBe('有明');
  });

  it('falls back to terminal when destination is undefined', () => {
    expect(getHeadsignFromDestination(undefined, 'odpt.RailDirection:Outbound', stationOrder)).toBe(
      '豊洲',
    );
    expect(getHeadsignFromDestination(undefined, 'odpt.RailDirection:Inbound', stationOrder)).toBe(
      '新橋',
    );
  });

  it('falls back to terminal when destination is not found in stationOrder', () => {
    expect(
      getHeadsignFromDestination(
        'odpt.Station:Test.Unknown',
        'odpt.RailDirection:Outbound',
        stationOrder,
      ),
    ).toBe('豊洲');
  });
});

// ---------------------------------------------------------------------------
// buildTimetable (destination grouping)
// ---------------------------------------------------------------------------

describe('buildTimetable (destination grouping)', () => {
  it('separates short-turn and full-line services into different groups', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Ariake', '有明', 'Ariake'),
      makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });

    const timetables: OdptStationTimetable[] = [
      makeTimetableWithRawObjects(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        [
          {
            'odpt:departureTime': '06:00',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          {
            'odpt:departureTime': '06:30',
            'odpt:destinationStation': ['odpt.Station:Test.Ariake'],
          },
          {
            'odpt:departureTime': '07:00',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
        ],
      ),
    ];

    const result = buildTimetable('yrkm', timetables, [railway], TEST_PROVIDER);
    const groups = result['yrkm:Shimbashi'];

    // Two groups: 豊洲行き and 有明行き
    expect(groups).toHaveLength(2);
    const toyosuGroup = groups.find((g) => g.h === '豊洲')!;
    const ariakeGroup = groups.find((g) => g.h === '有明')!;

    expect(toyosuGroup).toBeDefined();
    expect(ariakeGroup).toBeDefined();
    expect(toyosuGroup.d['yrkm:weekday']).toEqual([360, 420]); // 06:00, 07:00
    expect(ariakeGroup.d['yrkm:weekday']).toEqual([390]); // 06:30
  });
});

// ---------------------------------------------------------------------------
// buildTranslations (destination headsigns)
// ---------------------------------------------------------------------------

describe('buildTranslations (destination headsigns)', () => {
  it('includes headsign translations for short-turn destinations', () => {
    const stationOrders: OdptStationOrder[] = [
      makeStationOrder(1, 'odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi'),
      makeStationOrder(2, 'odpt.Station:Test.Ariake', '有明', 'Ariake'),
      makeStationOrder(3, 'odpt.Station:Test.Toyosu', '豊洲', 'Toyosu'),
    ];
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:stationOrder': stationOrders,
    });
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.Shimbashi', '新橋', 'Shimbashi', 35.6658, 139.7584),
    ];

    const timetables: OdptStationTimetable[] = [
      makeTimetableWithRawObjects(
        'odpt.Station:Test.Shimbashi',
        'odpt.Calendar:Weekday',
        'odpt.RailDirection:Outbound',
        [
          {
            'odpt:departureTime': '06:00',
            'odpt:destinationStation': ['odpt.Station:Test.Toyosu'],
          },
          {
            'odpt:departureTime': '06:30',
            'odpt:destinationStation': ['odpt.Station:Test.Ariake'],
          },
        ],
      ),
    ];

    const result = buildTranslations('yrkm', timetables, [railway], stations, TEST_PROVIDER);

    // Both 豊洲 and 有明 should have headsign translations
    expect(result.headsigns['豊洲']).toEqual({ ja: '豊洲', en: 'Toyosu' });
    expect(result.headsigns['有明']).toEqual({ ja: '有明', en: 'Ariake' });
    expect(Object.keys(result.headsigns)).toHaveLength(2);
  });
});
