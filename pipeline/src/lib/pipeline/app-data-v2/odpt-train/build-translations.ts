/**
 * Build TranslationsJson from ODPT data.
 */

import type { TranslationsJson } from '../../../../../../src/types/data/transit-json';
import type {
  OdptRailway,
  OdptStation,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../types/odpt-train';
import { extractStationShortId } from './build-stops';
import { getHeadsignFromDestination } from './build-timetable';

/**
 * Build TranslationsJson from ODPT data.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param timetables - ODPT station timetable data.
 * @param railways - ODPT railway data.
 * @param stations - ODPT station data.
 * @returns TranslationsJson with multilingual names.
 */
export function buildTranslationsV2(
  prefix: string,
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
  stations: OdptStation[],
): TranslationsJson {
  const tripHeadsigns: Record<string, Record<string, string>> = {};

  // Build station -> railway lookup.
  // A station shared by multiple railways maps to all of them (1:N).
  type RailwayInfo = {
    lineCode: string;
    stationOrder: OdptStationOrder[];
  };
  const stationToRailways = new Map<string, RailwayInfo[]>();
  for (const rw of railways) {
    const info: RailwayInfo = {
      lineCode: rw['odpt:lineCode'],
      stationOrder: rw['odpt:stationOrder'],
    };
    for (const so of rw['odpt:stationOrder']) {
      const station = so['odpt:station'];
      let list = stationToRailways.get(station);
      if (!list) {
        list = [];
        stationToRailways.set(station, list);
      }
      list.push(info);
    }
  }

  // Collect headsigns from timetable destinationStation.
  // Each unique destination produces a headsign (e.g. 豊洲, 有明, 新橋).
  for (const tt of timetables) {
    const rw = stationToRailways.get(tt['odpt:station'])?.[0];
    if (!rw) {
      continue;
    }

    for (const obj of tt['odpt:stationTimetableObject']) {
      const dest = obj['odpt:destinationStation']?.[0];
      const headsignJa = getHeadsignFromDestination(
        dest,
        tt['odpt:railDirection'],
        rw.stationOrder,
      );
      if (tripHeadsigns[headsignJa]) {
        continue;
      }
      // Find title for the destination station
      const destEntry = dest
        ? rw.stationOrder.find((so) => so['odpt:station'] === dest)
        : undefined;
      // Fall back to direction terminal if destination not in stationOrder
      const title = destEntry
        ? destEntry['odpt:stationTitle']
        : tt['odpt:railDirection'] === 'odpt.RailDirection:Outbound'
          ? rw.stationOrder[rw.stationOrder.length - 1]['odpt:stationTitle']
          : rw.stationOrder[0]['odpt:stationTitle'];
      const names: Record<string, string> = { ja: title.ja, en: title.en };
      if (title.ko) {
        names.ko = title.ko;
      }
      if (title['zh-Hans']) {
        names['zh-Hans'] = title['zh-Hans'];
      }
      tripHeadsigns[headsignJa] = names;
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

  // route_long_names: railway translations keyed by prefixed route_id.
  // ODPT railway titles are conceptually long names — they describe the
  // line (e.g. "Yurikamome", "Tsukuba Express"), not a short identifier.
  const routeLongNames: Record<string, Record<string, string>> = {};
  for (const rw of railways) {
    const title = rw['odpt:railwayTitle'];
    routeLongNames[`${prefix}:${rw['odpt:lineCode']}`] = { ja: title.ja, en: title.en };
  }

  // route_short_names: ODPT does not provide a separate short_name
  // translation; emit empty so the schema is satisfied.
  const routeShortNames: Record<string, Record<string, string>> = {};

  // agency_names: ODPT has no agency name translations — managed on
  // the App side via agency-attributes.ts.
  return {
    agency_names: {},
    route_long_names: routeLongNames,
    route_short_names: routeShortNames,
    stop_names: stopNames,
    trip_headsigns: tripHeadsigns,
    stop_headsigns: {},
  };
}
