/**
 * Build TranslationsJson from ODPT data.
 */

import type { TranslationsJson } from '../../../../../src/types/data/transit-json';
import type { OdptRailway, OdptStation, OdptStationOrder, OdptStationTimetable } from '../../../../types/odpt-train';
import type { Provider } from '../../../../types/resource-common';
import { extractStationShortId } from './build-stops';
import { getHeadsignFromDirection } from './build-timetable';

/**
 * Build TranslationsJson from ODPT data.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param timetables - ODPT station timetable data.
 * @param railways - ODPT railway data.
 * @param stations - ODPT station data.
 * @param provider - Provider info.
 * @returns TranslationsJson with multilingual names.
 */
export function buildTranslationsV2(
  prefix: string,
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
  stations: OdptStation[],
  provider: Provider,
): TranslationsJson {
  const headsigns: Record<string, Record<string, string>> = {};

  // Build station -> railway lookup (O(1) per timetable entry)
  type RailwayInfo = {
    lineCode: string;
    stationOrder: OdptStationOrder[];
  };
  const stationToRailway = new Map<string, RailwayInfo>();
  for (const rw of railways) {
    const info: RailwayInfo = {
      lineCode: rw['odpt:lineCode'],
      stationOrder: rw['odpt:stationOrder'],
    };
    for (const so of rw['odpt:stationOrder']) {
      stationToRailway.set(so['odpt:station'], info);
    }
  }

  // Collect headsigns from timetable direction -> terminal station
  const seenKeys = new Set<string>();
  for (const tt of timetables) {
    const rw = stationToRailway.get(tt['odpt:station']);
    if (!rw) {
      continue;
    }

    const dirKey = `${rw.lineCode}:${tt['odpt:railDirection']}`;
    if (seenKeys.has(dirKey)) {
      continue;
    }
    seenKeys.add(dirKey);

    const headsignJa = getHeadsignFromDirection(tt['odpt:railDirection'], rw.stationOrder);
    if (!headsigns[headsignJa]) {
      const terminalIdx =
        tt['odpt:railDirection'] === 'odpt.RailDirection:Outbound' ? rw.stationOrder.length - 1 : 0;
      const title = rw.stationOrder[terminalIdx]['odpt:stationTitle'];
      const names: Record<string, string> = { ja: title.ja, en: title.en };
      if (title.ko) {
        names.ko = title.ko;
      }
      if (title['zh-Hans']) {
        names['zh-Hans'] = title['zh-Hans'];
      }
      headsigns[headsignJa] = names;
    }
  }

  // stop_names: station translations keyed by prefixed stop_id
  const stopNames: Record<string, Record<string, string>> = {};
  for (const s of stations) {
    const shortId = extractStationShortId(s['owl:sameAs']);
    const title = s['odpt:stationTitle'];
    const names: Record<string, string> = { ja: title.ja, en: title.en };
    if (title.ko) {
      names.ko = title.ko;
    }
    if (title['zh-Hans']) {
      names['zh-Hans'] = title['zh-Hans'];
    }
    stopNames[`${prefix}:${shortId}`] = names;
  }

  // route_names: railway translations keyed by prefixed route_id
  const routeNames: Record<string, Record<string, string>> = {};
  for (const rw of railways) {
    const title = rw['odpt:railwayTitle'];
    routeNames[`${prefix}:${rw['odpt:lineCode']}`] = { ja: title.ja, en: title.en };
  }

  // agency_names: provider translations
  const agencyId = `${prefix}:${provider.name.en.long}`;
  const agencyNames: Record<string, Record<string, string>> = {};
  agencyNames[agencyId] = { ja: provider.name.ja.long, en: provider.name.en.long };

  const agencyShortNames: Record<string, Record<string, string>> = {};
  agencyShortNames[agencyId] = { ja: provider.name.ja.short, en: provider.name.en.short };

  return {
    headsigns,
    stop_headsigns: {},
    stop_names: stopNames,
    route_names: routeNames,
    agency_names: agencyNames,
    agency_short_names: agencyShortNames,
  };
}
