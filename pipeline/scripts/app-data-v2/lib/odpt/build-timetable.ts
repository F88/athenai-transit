/**
 * Build TripPatternJson and TimetableGroupV2Json from ODPT data.
 *
 * ODPT direction + stationOrder -> trip patterns.
 * departure/arrival from odpt:departureTime / odpt:arrivalTime.
 * pt/dt: ODPT has no pickup/drop-off concept, so omitted (undefined).
 */

import type {
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../src/types/data/transit-v2-json';
import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../types/odpt-train';
import { timeToMinutes } from '../time-utils';
import { calendarToServiceId } from './build-calendar';
import { extractStationShortId } from './build-stops';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine headsign from rail direction.
 * Outbound -> last station, Inbound -> first station.
 *
 * @param direction - ODPT rail direction URI (e.g. "odpt.RailDirection:Outbound").
 * @param stationOrder - Ordered station list for the railway.
 * @returns Terminal station name in Japanese.
 */
export function getHeadsignFromDirection(
  direction: string,
  stationOrder: OdptStationOrder[],
): string {
  if (direction === 'odpt.RailDirection:Outbound') {
    return stationOrder[stationOrder.length - 1]['odpt:stationTitle'].ja;
  }
  return stationOrder[0]['odpt:stationTitle'].ja;
}

/**
 * Build ordered stop IDs for a direction.
 * Outbound -> original order, Inbound -> reversed.
 */
function buildStopSequence(
  direction: string,
  stationOrder: OdptStationOrder[],
  prefix: string,
): string[] {
  const stops = stationOrder.map((so) => `${prefix}:${extractStationShortId(so['odpt:station'])}`);
  if (direction === 'odpt.RailDirection:Inbound') {
    return [...stops].reverse();
  }
  return stops;
}

/**
 * Deterministic sort key for a pattern.
 */
function patternSortKey(routeId: string, headsign: string, stops: string[]): string {
  return `${routeId}\0${headsign}\0${stops.join(',')}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Build trip patterns and timetable from ODPT data.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param timetables - ODPT station timetable data.
 * @param railways - ODPT railway data.
 * @returns tripPatterns and timetable.
 */
export function buildTripPatternsAndTimetableFromOdpt(
  prefix: string,
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
): {
  tripPatterns: Record<string, TripPatternJson>;
  timetable: Record<string, TimetableGroupV2Json[]>;
} {
  // Build station -> railway lookup (O(1) per timetable entry)
  type RailwayInfo = {
    routeId: string;
    stationOrder: OdptStationOrder[];
  };
  const stationToRailway = new Map<string, RailwayInfo>();
  for (const rw of railways) {
    const info: RailwayInfo = {
      routeId: `${prefix}:${rw['odpt:lineCode']}`,
      stationOrder: rw['odpt:stationOrder'],
    };
    for (const so of rw['odpt:stationOrder']) {
      stationToRailway.set(so['odpt:station'], info);
    }
  }

  // 1. Discover patterns: route + direction -> pattern
  // Key: routeId + direction string
  const patternMap = new Map<
    string,
    { routeId: string; headsign: string; stops: string[]; sortKey: string }
  >();

  for (const tt of timetables) {
    const rw = stationToRailway.get(tt['odpt:station']);
    if (!rw) {
      continue;
    }
    const direction = tt['odpt:railDirection'];
    const pKey = `${rw.routeId}\0${direction}`;
    if (!patternMap.has(pKey)) {
      const headsign = getHeadsignFromDirection(direction, rw.stationOrder);
      const stops = buildStopSequence(direction, rw.stationOrder, prefix);
      patternMap.set(pKey, {
        routeId: rw.routeId,
        headsign,
        stops,
        sortKey: patternSortKey(rw.routeId, headsign, stops),
      });
    }
  }

  // 2. Sort patterns deterministically and assign IDs
  const sortedPatterns = [...patternMap.entries()].sort(([, a], [, b]) =>
    a.sortKey.localeCompare(b.sortKey),
  );

  const tripPatterns: Record<string, TripPatternJson> = {};
  const patternIdByKey = new Map<string, string>();

  for (let i = 0; i < sortedPatterns.length; i++) {
    const [pKey, p] = sortedPatterns[i];
    const patternId = `${prefix}:p${i + 1}`;
    patternIdByKey.set(pKey, patternId);

    tripPatterns[patternId] = {
      v: 2,
      r: p.routeId,
      h: p.headsign,
      // ODPT does not provide direction_id, so omit dir
      stops: p.stops,
    };
  }

  // 3. Build per-stop timetable
  type DepartureEntry = { d: number; a: number };
  // stopId -> patternId -> serviceId -> entries
  const stopTimetable = new Map<string, Map<string, Map<string, DepartureEntry[]>>>();

  for (const tt of timetables) {
    const rw = stationToRailway.get(tt['odpt:station']);
    if (!rw) {
      continue;
    }

    const direction = tt['odpt:railDirection'];
    const pKey = `${rw.routeId}\0${direction}`;
    const patId = patternIdByKey.get(pKey)!;
    const stopId = `${prefix}:${extractStationShortId(tt['odpt:station'])}`;
    const serviceId = `${prefix}:${calendarToServiceId(tt['odpt:calendar'])}`;

    let patMap = stopTimetable.get(stopId);
    if (!patMap) {
      patMap = new Map();
      stopTimetable.set(stopId, patMap);
    }

    let svcMap = patMap.get(patId);
    if (!svcMap) {
      svcMap = new Map();
      patMap.set(patId, svcMap);
    }

    let entries = svcMap.get(serviceId);
    if (!entries) {
      entries = [];
      svcMap.set(serviceId, entries);
    }

    for (const obj of tt['odpt:stationTimetableObject']) {
      const depTime = obj['odpt:departureTime'];
      const arrTime = obj['odpt:arrivalTime'];

      // Need at least departure or arrival
      if (!depTime && !arrTime) {
        continue;
      }

      // departure: prefer departureTime, fall back to arrivalTime
      const dep = depTime ? timeToMinutes(depTime) : timeToMinutes(arrTime!);
      // arrival: prefer arrivalTime, fall back to departureTime
      const arr = arrTime ? timeToMinutes(arrTime) : dep;

      entries.push({ d: dep, a: arr });
    }
  }

  // 4. Convert to output format
  const timetable: Record<string, TimetableGroupV2Json[]> = {};

  for (const [stopId, patMap] of stopTimetable) {
    const groups: TimetableGroupV2Json[] = [];

    for (const [patId, svcMap] of patMap) {
      const d: Record<string, number[]> = {};
      const a: Record<string, number[]> = {};

      for (const [serviceId, entries] of svcMap) {
        entries.sort((x, y) => x.d - y.d);
        d[serviceId] = entries.map((e) => e.d);
        a[serviceId] = entries.map((e) => e.a);
      }

      // ODPT has no pickup_type/drop_off_type, so pt/dt are omitted
      groups.push({
        v: 2,
        tp: patId,
        d,
        a,
      });
    }

    timetable[stopId] = groups;
  }

  return { tripPatterns, timetable };
}
