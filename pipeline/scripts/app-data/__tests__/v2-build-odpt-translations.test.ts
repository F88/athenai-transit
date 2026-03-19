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
} from '../../../types/odpt-train';
import type { Provider } from '../../../types/resource-common';
import { buildTranslationsV2 } from '../lib/v2-build-odpt-translations';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
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
        'odpt:stationTimetableObject': [],
      },
    ];

    const result = buildTranslationsV2('test', timetables, [railway], stations, TEST_PROVIDER);

    // Headsign: outbound -> last station
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
});
