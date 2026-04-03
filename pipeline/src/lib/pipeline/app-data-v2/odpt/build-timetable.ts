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
} from '../../../../../../src/types/data/transit-v2-json';
import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../types/odpt-train';
import { adjustOdptOvernightTimes, timeToMinutes } from '../../../transit-time-utils';
import { calendarToServiceId } from '../../../odpt-calendar-utils';
import { extractStationShortId } from './build-stops';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Resolved railway info with per-railway station index map.
 * stationIndexMap is per-railway to avoid index collisions when
 * a station appears in multiple railways (e.g. transfer stations).
 */
interface RailwayInfo {
  routeId: string;
  stationOrder: OdptStationOrder[];
  /** Station URI -> 0-based positional index within THIS railway's stationOrder. */
  stationIndexMap: Map<string, number>;
}

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
 * @param rw - Railway info with stationOrder and per-railway index map.
 * @param prefix - Source prefix for ID namespacing.
 * @returns Ordered stop IDs from origin to destination.
 */
function buildStopSequence(
  direction: string,
  destination: string | undefined,
  rw: RailwayInfo,
  prefix: string,
): TripPatternJson['stops'] {
  const allStops = rw.stationOrder.map((so) => ({
    id: `${prefix}:${extractStationShortId(so['odpt:station'])}`,
  }));

  const destIdx = destination ? rw.stationIndexMap.get(destination) : undefined;

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
function patternSortKey(
  routeId: string,
  headsign: string,
  stops: TripPatternJson['stops'],
): string {
  return `${routeId}\0${headsign}\0${JSON.stringify(stops.map((s) => s.id))}`;
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
  const railwayInfos: RailwayInfo[] = railways.map((rw) => {
    const indexMap = new Map<string, number>();
    for (let idx = 0; idx < rw['odpt:stationOrder'].length; idx++) {
      indexMap.set(rw['odpt:stationOrder'][idx]['odpt:station'], idx);
    }
    return {
      routeId: `${prefix}:${rw['odpt:lineCode']}`,
      stationOrder: rw['odpt:stationOrder'],
      stationIndexMap: indexMap,
    };
  });

  // Station URI -> list of railways it belongs to.
  // A station shared by multiple railways (e.g. transfer stations)
  // maps to all of them. The first match is used for timetable lookup.
  const stationToRailways = new Map<string, RailwayInfo[]>();
  for (const rw of railwayInfos) {
    for (const so of rw.stationOrder) {
      const station = so['odpt:station'];
      let list = stationToRailways.get(station);
      if (!list) {
        list = [];
        stationToRailways.set(station, list);
      }
      list.push(rw);
    }
  }

  /** Find the railway for a station (first match, deterministic by input order). */
  function findRailway(station: string): RailwayInfo | undefined {
    const candidates = stationToRailways.get(station);
    return candidates?.[0];
  }

  // 1. Discover patterns: route + direction + destination -> pattern
  const patternMap = new Map<
    string,
    { routeId: string; headsign: string; stops: TripPatternJson['stops']; sortKey: string }
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
      const stops = buildStopSequence(direction, effectiveDest, rw, prefix);
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
    const rw = findRailway(tt['odpt:station']);
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
    const rw = findRailway(tt['odpt:station']);
    if (!rw) {
      continue;
    }

    const direction = tt['odpt:railDirection'];
    const stopId = `${prefix}:${extractStationShortId(tt['odpt:station'])}`;
    const serviceId = `${prefix}:${calendarToServiceId(tt['odpt:calendar'])}`;

    // Pre-convert overnight times: ODPT uses 00:xx for post-midnight,
    // but our data model uses 24:xx (same as GTFS convention).
    // See ODPT API Spec v4.15 Section 3.3.6.
    const objects = tt['odpt:stationTimetableObject'];
    const rawTimes = objects.map(
      (obj) => obj['odpt:departureTime'] ?? obj['odpt:arrivalTime'] ?? '',
    );
    const adjustedTimes = adjustOdptOvernightTimes(rawTimes);

    for (let objIdx = 0; objIdx < objects.length; objIdx++) {
      const obj = objects[objIdx];
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

      // Use overnight-adjusted time for minutes conversion.
      // adjustOdptOvernightTimes detects a 23:xx → 00:xx reversal.
      // isOvernightSection is true from that point onward, and
      // toOvernightMinutes adds +24h unconditionally to both
      // departure and arrival times before converting to minutes.
      const adjusted = adjustedTimes[objIdx];
      const isOvernightSection = adjusted !== rawTimes[objIdx];

      const toOvernightMinutes = (time: string): number => {
        if (isOvernightSection) {
          const h = parseInt(time.split(':')[0], 10);
          return (h + 24) * 60 + parseInt(time.split(':')[1], 10);
        }
        return timeToMinutes(time);
      };

      const dep = depTime ? toOvernightMinutes(depTime) : timeToMinutes(adjusted);
      const arr = arrTime ? toOvernightMinutes(arrTime) : dep;

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
