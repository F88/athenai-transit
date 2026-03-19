/**
 * Build TripPatternJson and TimetableGroupV2Json from ODPT data.
 *
 * ODPT direction + destinationStation + stationOrder -> trip patterns.
 * Short-turn services (e.g. Shimbashi → Ariake) produce separate
 * patterns with truncated stop sequences.
 *
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
 * Determine headsign from destination station.
 * Looks up the station title from stationOrder by matching the station URI.
 * Falls back to direction-based terminal if destination is not found.
 *
 * @param destination - ODPT destination station URI.
 * @param direction - ODPT rail direction URI.
 * @param stationOrder - Ordered station list for the railway.
 * @returns Destination station name in Japanese.
 */
export function getHeadsignFromDestination(
  destination: string | undefined,
  direction: string,
  stationOrder: OdptStationOrder[],
): string {
  if (destination) {
    const entry = stationOrder.find((so) => so['odpt:station'] === destination);
    if (entry) {
      return entry['odpt:stationTitle'].ja;
    }
  }
  // Fallback: terminal station from direction
  if (direction === 'odpt.RailDirection:Outbound') {
    return stationOrder[stationOrder.length - 1]['odpt:stationTitle'].ja;
  }
  return stationOrder[0]['odpt:stationTitle'].ja;
}

/**
 * Build ordered stop IDs truncated at destination station.
 *
 * Outbound: stationOrder[0..destIdx] (origin to destination).
 * Inbound: reversed stationOrder[destIdx..last] (end to destination).
 * If destination is not found, uses full stationOrder.
 *
 * @param direction - ODPT rail direction URI.
 * @param destination - ODPT destination station URI (may be undefined).
 * @param stationOrder - Ordered station list for the railway.
 * @param stationIndexMap - Station URI -> index in stationOrder.
 * @param prefix - Source prefix for ID namespacing.
 * @returns Ordered stop IDs from origin to destination.
 */
function buildStopSequence(
  direction: string,
  destination: string | undefined,
  stationOrder: OdptStationOrder[],
  stationIndexMap: Map<string, number>,
  prefix: string,
): string[] {
  const allStops = stationOrder.map(
    (so) => `${prefix}:${extractStationShortId(so['odpt:station'])}`,
  );

  const destIdx = destination ? stationIndexMap.get(destination) : undefined;

  if (direction === 'odpt.RailDirection:Outbound') {
    // Outbound: origin (index 0) to destination
    const endIdx = destIdx != null ? destIdx + 1 : allStops.length;
    return allStops.slice(0, endIdx);
  }
  // Inbound: end of line to destination (reversed)
  const startIdx = destIdx != null ? destIdx : 0;
  return [...allStops.slice(startIdx)].reverse();
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
 * Patterns are keyed by (direction, destinationStation) to correctly
 * separate short-turn services from full-line services.
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
  // Station URI -> positional index within stationOrder (0-based)
  const stationIndexMap = new Map<string, number>();

  for (const rw of railways) {
    const info: RailwayInfo = {
      routeId: `${prefix}:${rw['odpt:lineCode']}`,
      stationOrder: rw['odpt:stationOrder'],
    };
    for (let idx = 0; idx < rw['odpt:stationOrder'].length; idx++) {
      const so = rw['odpt:stationOrder'][idx];
      stationToRailway.set(so['odpt:station'], info);
      stationIndexMap.set(so['odpt:station'], idx);
    }
  }

  // 1. Discover patterns: route + direction + destination -> pattern
  const patternMap = new Map<
    string,
    { routeId: string; headsign: string; stops: string[]; sortKey: string }
  >();

  // Helper: get or create pattern for a (railway, direction, destination) combo
  function getOrCreatePatternKey(
    rw: RailwayInfo,
    direction: string,
    destination: string | undefined,
  ): string {
    // Normalize: if destination is the terminal for this direction, treat as full route
    const terminal =
      direction === 'odpt.RailDirection:Outbound'
        ? rw.stationOrder[rw.stationOrder.length - 1]['odpt:station']
        : rw.stationOrder[0]['odpt:station'];
    const effectiveDest = destination === terminal ? undefined : destination;
    const destKey = effectiveDest ?? '__full__';
    const pKey = `${rw.routeId}\0${direction}\0${destKey}`;

    if (!patternMap.has(pKey)) {
      const headsign = getHeadsignFromDestination(effectiveDest, direction, rw.stationOrder);
      const stops = buildStopSequence(
        direction,
        effectiveDest,
        rw.stationOrder,
        stationIndexMap,
        prefix,
      );
      patternMap.set(pKey, {
        routeId: rw.routeId,
        headsign,
        stops,
        sortKey: patternSortKey(rw.routeId, headsign, stops),
      });
    }
    return pKey;
  }

  // Scan all timetable objects to discover patterns
  for (const tt of timetables) {
    const rw = stationToRailway.get(tt['odpt:station']);
    if (!rw) {
      continue;
    }
    const direction = tt['odpt:railDirection'];
    // Discover unique destinations in this timetable's objects
    const seenDests = new Set<string | undefined>();
    for (const obj of tt['odpt:stationTimetableObject']) {
      const dest = obj['odpt:destinationStation']?.[0];
      if (!seenDests.has(dest)) {
        seenDests.add(dest);
        getOrCreatePatternKey(rw, direction, dest);
      }
    }
  }

  // 2. Sort patterns deterministically and assign IDs
  // Use code-unit comparison (< / >) instead of localeCompare to avoid
  // locale-dependent collation differences across environments.
  const sortedPatterns = [...patternMap.entries()].sort(([, a], [, b]) => {
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });

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
    const stopId = `${prefix}:${extractStationShortId(tt['odpt:station'])}`;
    const serviceId = `${prefix}:${calendarToServiceId(tt['odpt:calendar'])}`;

    for (const obj of tt['odpt:stationTimetableObject']) {
      const depTime = obj['odpt:departureTime'];
      const arrTime = obj['odpt:arrivalTime'];

      // Need at least departure or arrival
      if (!depTime && !arrTime) {
        continue;
      }

      // Assign to correct pattern by destination
      const dest = obj['odpt:destinationStation']?.[0];
      const pKey = getOrCreatePatternKey(rw, direction, dest);
      const patId = patternIdByKey.get(pKey)!;

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
