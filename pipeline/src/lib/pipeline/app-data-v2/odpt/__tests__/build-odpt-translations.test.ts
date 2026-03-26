/**
 * Tests for v2-build-odpt-translations.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OdptRailway,
  OdptStation,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../../types/odpt-train';
import type { Provider } from '../../../../../types/resource-common';
import { buildTranslationsV2 } from '../build-translations';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  colors: [{ bg: '000000', text: 'FFFFFF' }],
};

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

describe('buildTranslationsV2', () => {
  it('generates headsign, stop_names, route_names, agency translations', () => {
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    ];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const stations: OdptStation[] = [
      {
        'owl:sameAs': 'odpt.Station:Test.A',
        'dc:date': '2025-01-01',
        'geo:lat': 35.66,
        'geo:long': 139.76,
        'odpt:stationCode': '',
        'odpt:stationTitle': { ja: 'A駅', en: 'Station A' },
      },
    ];
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          {
            'odpt:departureTime': '06:00',
            'odpt:destinationStation': ['odpt.Station:Test.B'],
          },
        ],
      },
    ];

    const result = buildTranslationsV2('test', timetables, [railway], stations, TEST_PROVIDER);

    // Headsign: derived from destinationStation
    expect(result.headsigns['B駅']).toEqual({ ja: 'B駅', en: 'Station B' });
    // Stop names
    expect(result.stop_names['test:A']).toEqual({ ja: 'A駅', en: 'Station A' });
    // Route names
    expect(result.route_names['test:U']).toEqual({ ja: 'テスト線', en: 'Test Line' });
    // Agency names
    expect(result.agency_names['test:Test Transit']).toEqual({
      ja: 'テスト交通',
      en: 'Test Transit',
    });
    expect(result.agency_short_names['test:Test Transit']).toEqual({
      ja: 'テスト',
      en: 'Test',
    });
  });

  it('includes ko and zh-Hans in station translations when available', () => {
    const orders: OdptStationOrder[] = [makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A')];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const stations: OdptStation[] = [
      {
        'owl:sameAs': 'odpt.Station:Test.A',
        'dc:date': '2025-01-01',
        'geo:lat': 35.66,
        'geo:long': 139.76,
        'odpt:stationCode': '',
        'odpt:stationTitle': { ja: 'A駅', en: 'Station A', ko: 'A역', 'zh-Hans': 'A站' },
      },
    ];

    const result = buildTranslationsV2('test', [], [railway], stations, TEST_PROVIDER);
    expect(result.stop_names['test:A']).toEqual({
      ja: 'A駅',
      en: 'Station A',
      ko: 'A역',
      'zh-Hans': 'A站',
    });
  });

  it('returns empty headsigns when timetables are empty', () => {
    const orders: OdptStationOrder[] = [makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A')];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const stations: OdptStation[] = [
      {
        'owl:sameAs': 'odpt.Station:Test.A',
        'dc:date': '2025-01-01',
        'geo:lat': 35.66,
        'geo:long': 139.76,
        'odpt:stationCode': '',
        'odpt:stationTitle': { ja: 'A駅', en: 'Station A' },
      },
    ];

    const result = buildTranslationsV2('test', [], [railway], stations, TEST_PROVIDER);
    expect(result.headsigns).toEqual({});
  });

  it('produces multiple headsigns from multiple destinations', () => {
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
      makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
    ];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const stations: OdptStation[] = [];
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          {
            'odpt:departureTime': '06:00',
            'odpt:destinationStation': ['odpt.Station:Test.B'],
          },
          {
            'odpt:departureTime': '07:00',
            'odpt:destinationStation': ['odpt.Station:Test.C'],
          },
        ],
      },
    ];

    const result = buildTranslationsV2('test', timetables, [railway], stations, TEST_PROVIDER);
    expect(result.headsigns['B駅']).toEqual({ ja: 'B駅', en: 'Station B' });
    expect(result.headsigns['C駅']).toEqual({ ja: 'C駅', en: 'Station C' });
    expect(Object.keys(result.headsigns)).toHaveLength(2);
  });

  it('stop_headsigns is always empty for ODPT', () => {
    const orders: OdptStationOrder[] = [makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A')];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    const stations: OdptStation[] = [
      {
        'owl:sameAs': 'odpt.Station:Test.A',
        'dc:date': '2025-01-01',
        'geo:lat': 35.66,
        'geo:long': 139.76,
        'odpt:stationCode': '',
        'odpt:stationTitle': { ja: 'A駅', en: 'Station A' },
      },
    ];
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00', 'odpt:destinationStation': ['odpt.Station:Test.A'] },
        ],
      },
    ];

    const result = buildTranslationsV2('test', timetables, [railway], stations, TEST_PROVIDER);
    expect(result.stop_headsigns).toEqual({});
  });

  it('deduplicates headsigns when same destination appears in multiple timetables', () => {
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    ];
    const railway = makeRailway({ 'odpt:lineCode': 'U', 'odpt:stationOrder': orders });
    // Two timetables (Weekday + Saturday) both going to B
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '06:00', 'odpt:destinationStation': ['odpt.Station:Test.B'] },
        ],
      },
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Saturday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Saturday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '07:00', 'odpt:destinationStation': ['odpt.Station:Test.B'] },
        ],
      },
    ];

    const result = buildTranslationsV2('test', timetables, [railway], [], TEST_PROVIDER);
    expect(Object.keys(result.headsigns)).toHaveLength(1);
    expect(result.headsigns['B駅']).toEqual({ ja: 'B駅', en: 'Station B' });
  });
});
