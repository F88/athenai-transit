/**
 * Shared fixture builders for ODPT timetable tests.
 *
 * Used by both:
 * - `build-odpt-timetable.test.ts` (facade-level integration tests)
 * - `infer-odpt-trips-heuristic.test.ts` (heuristic-level tests)
 *
 * Heuristic-only fixtures (FIVE_STATIONS, makeRichTimetable,
 * buildAriakeStyleFixture, etc.) live in the heuristic test file
 * itself rather than here, since they are not reused by the facade
 * test file.
 */

import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../../../types/odpt-train';

export function makeOrder(
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

export function makeRailway(
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
export function makeTimetable(
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
