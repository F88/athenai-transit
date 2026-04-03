/**
 * Integration tests for build-from-odpt-train.ts DataBundle assembly.
 *
 * Uses inline ODPT fixtures to verify that all build functions combine
 * correctly into a valid DataBundle.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';
import type {
  OdptRailway,
  OdptStation,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../src/types/odpt-train';
import type { Provider } from '../../../../src/types/resource-common';
import { buildAgencyV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-agency';
import { buildCalendarV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-calendar';
import { buildFeedInfoV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-feed-info';
import { buildRoutesV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-routes';
import { buildStopsV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-stops';
import { buildTripPatternsAndTimetableFromOdpt } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-timetable';
import { buildTranslationsV2 } from '../../../../src/lib/pipeline/app-data-v2/odpt/build-translations';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
  colors: [{ bg: '000000', text: 'FFFFFF' }],
};

function makeOrder(i: number, station: string, ja: string, en: string): OdptStationOrder {
  return { 'odpt:index': i, 'odpt:station': station, 'odpt:stationTitle': { ja, en } };
}

function makeFixtures(): {
  stations: OdptStation[];
  railways: OdptRailway[];
  timetables: OdptStationTimetable[];
} {
  const orders: OdptStationOrder[] = [
    makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
    makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    makeOrder(3, 'odpt.Station:Test.C', 'C駅', 'Station C'),
  ];

  const stations: OdptStation[] = [
    {
      'owl:sameAs': 'odpt.Station:Test.A',
      'dc:date': '2025-04-01',
      'geo:lat': 35.66,
      'geo:long': 139.76,
      'odpt:stationCode': 'A01',
      'odpt:stationTitle': { ja: 'A駅', en: 'Station A' },
    },
    {
      'owl:sameAs': 'odpt.Station:Test.B',
      'dc:date': '2025-04-01',
      'geo:lat': 35.67,
      'geo:long': 139.77,
      'odpt:stationCode': 'B01',
      'odpt:stationTitle': { ja: 'B駅', en: 'Station B' },
    },
    {
      'owl:sameAs': 'odpt.Station:Test.C',
      'dc:date': '2025-04-01',
      'geo:lat': 35.68,
      'geo:long': 139.78,
      'odpt:stationCode': 'C01',
      'odpt:stationTitle': { ja: 'C駅', en: 'Station C' },
    },
  ];

  const railways: OdptRailway[] = [
    {
      'dc:date': '2025-04-01',
      'dc:title': 'Test Line',
      'odpt:color': '#00B2E5',
      'odpt:lineCode': 'T',
      'odpt:railwayTitle': { ja: 'テスト線', en: 'Test Line' },
      'odpt:stationOrder': orders,
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
        { 'odpt:departureTime': '06:00', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
        { 'odpt:departureTime': '06:30', 'odpt:destinationStation': ['odpt.Station:Test.C'] },
      ],
    },
    {
      'owl:sameAs': 'odpt.StationTimetable:Test.C.Weekday',
      'dct:issued': '2025-04-01',
      'odpt:station': 'odpt.Station:Test.C',
      'odpt:calendar': 'odpt.Calendar:Weekday',
      'odpt:railDirection': 'odpt.RailDirection:Inbound',
      'odpt:stationTimetableObject': [
        { 'odpt:departureTime': '07:00', 'odpt:destinationStation': ['odpt.Station:Test.A'] },
      ],
    },
  ];

  return { stations, railways, timetables };
}

describe('ODPT DataBundle assembly', () => {
  it('produces a valid DataBundle from ODPT fixtures', () => {
    const { stations, railways, timetables } = makeFixtures();
    const prefix = 'test';
    const issuedDate = timetables[0]['dct:issued'];

    const allStationOrders = railways.flatMap((rw) => rw['odpt:stationOrder']);
    const stops = buildStopsV2(prefix, stations, allStationOrders);
    const routes = railways.flatMap((rw) => buildRoutesV2(prefix, rw, TEST_PROVIDER));
    const calendar = buildCalendarV2(prefix, timetables, issuedDate);
    const agencies = buildAgencyV2(prefix, TEST_PROVIDER);
    const feedInfo = buildFeedInfoV2(issuedDate, TEST_PROVIDER);
    const translations = buildTranslationsV2(prefix, timetables, railways, stations, TEST_PROVIDER);
    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt(
      prefix,
      timetables,
      railways,
    );

    const bundle: DataBundle = {
      bundle_version: 2,
      kind: 'data',
      stops: { v: 2, data: stops },
      routes: { v: 2, data: routes },
      agency: { v: 1, data: agencies },
      calendar: { v: 1, data: calendar },
      feedInfo: { v: 1, data: feedInfo },
      timetable: { v: 2, data: timetable },
      tripPatterns: { v: 2, data: tripPatterns },
      translations: { v: 1, data: translations },
      lookup: { v: 2, data: {} },
    };

    // Bundle structure
    expect(bundle.bundle_version).toBe(2);
    expect(bundle.kind).toBe('data');

    // Section versions
    expect(bundle.stops.v).toBe(2);
    expect(bundle.routes.v).toBe(2);
    expect(bundle.agency.v).toBe(1);
    expect(bundle.calendar.v).toBe(1);
    expect(bundle.feedInfo.v).toBe(1);
    expect(bundle.timetable.v).toBe(2);
    expect(bundle.tripPatterns.v).toBe(2);
    expect(bundle.translations.v).toBe(1);
    expect(bundle.lookup.v).toBe(2);

    // Data populated
    expect(stops).toHaveLength(3);
    expect(routes).toHaveLength(1);
    expect(agencies).toHaveLength(1);
    expect(calendar.services).toHaveLength(1);
    expect(Object.keys(tripPatterns).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(timetable).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(translations.headsigns).length).toBeGreaterThanOrEqual(1);

    // ODPT: lookup is empty, pt/dt are absent
    expect(bundle.lookup.data).toEqual({});
    for (const groups of Object.values(timetable)) {
      for (const g of groups) {
        expect(g.pt).toBeUndefined();
        expect(g.dt).toBeUndefined();
      }
    }
  });

  it('timetable references only existing tripPattern IDs', () => {
    const { railways, timetables } = makeFixtures();
    const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt(
      'test',
      timetables,
      railways,
    );

    const patternIds = new Set(Object.keys(tripPatterns));
    for (const groups of Object.values(timetable)) {
      for (const g of groups) {
        expect(patternIds.has(g.tp)).toBe(true);
      }
    }
  });

  it('tripPattern stops reference only existing stop IDs', () => {
    const { stations, railways, timetables } = makeFixtures();
    const allStationOrders = railways.flatMap((rw) => rw['odpt:stationOrder']);
    const stops = buildStopsV2('test', stations, allStationOrders);
    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, railways);

    const stopIdSet = new Set(stops.map((s) => s.i));
    for (const p of Object.values(tripPatterns)) {
      for (const stop of p.stops) {
        expect(stopIdSet.has(stop.id)).toBe(true);
      }
    }
  });

  it('route IDs in tripPatterns reference existing routes', () => {
    const { railways, timetables } = makeFixtures();
    const routes = railways.flatMap((rw) => buildRoutesV2('test', rw, TEST_PROVIDER));
    const { tripPatterns } = buildTripPatternsAndTimetableFromOdpt('test', timetables, railways);

    const routeIds = new Set(routes.map((r) => r.i));
    for (const p of Object.values(tripPatterns)) {
      expect(routeIds.has(p.r)).toBe(true);
    }
  });
});
