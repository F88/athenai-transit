/**
 * Extract TripPatternJson and TimetableGroupV2Json from GTFS SQLite database.
 *
 * This is the most complex v2 extraction. It:
 * 1. Groups trips by their stop sequence → trip patterns
 * 2. Assigns deterministic pattern IDs: `{prefix}:p{1-indexed}`
 * 3. Builds per-stop timetable groups referencing patterns
 * 4. Includes arrival_time, pickup_type, drop_off_type
 */

import type Database from 'better-sqlite3';

import type {
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../../src/types/data/transit-v2-json';
import { timeToMinutes } from '../../../../../src/lib/time-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TripRow {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string | null;
  direction_id: number | null;
}

interface StopTimeRow {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  departure_time: string | null;
  arrival_time: string | null;
  pickup_type: number | null;
  drop_off_type: number | null;
}

/** Internal representation of a trip's stop sequence and times. */
interface TripStopTimes {
  tripId: string;
  routeId: string;
  serviceId: string;
  headsign: string;
  directionId: number | null;
  stops: string[];
  departures: (number | null)[];
  arrivals: (number | null)[];
  pickupTypes: (number | null)[];
  dropOffTypes: (number | null)[];
}

// ---------------------------------------------------------------------------
// Pattern sorting
// ---------------------------------------------------------------------------

/**
 * Deterministic sort key for a trip pattern.
 * route_id → headsign → direction → stops.join(",")
 */
function patternSortKey(p: {
  routeId: string;
  headsign: string;
  directionId: number | null;
  stops: string[];
}): string {
  const dir = p.directionId ?? -1;
  return `${p.routeId}\0${p.headsign}\0${dir}\0${p.stops.join(',')}`;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Extract trip patterns and timetable from the GTFS database.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @returns tripPatterns (keyed by pattern ID) and timetable (keyed by stop ID).
 */
export function extractTripPatternsAndTimetable(
  db: Database.Database,
  prefix: string,
): {
  tripPatterns: Record<string, TripPatternJson>;
  timetable: Record<string, TimetableGroupV2Json[]>;
} {
  // 1. Load trips
  const tripRows = db
    .prepare(
      `SELECT trip_id, route_id, service_id, trip_headsign, direction_id
       FROM trips`,
    )
    .all() as TripRow[];

  const tripMap = new Map<string, TripRow>();
  for (const t of tripRows) {
    tripMap.set(t.trip_id, t);
  }

  // 2. Load stop_times ordered by trip + stop_sequence
  const stopTimeRows = db
    .prepare(
      `SELECT trip_id, stop_id, stop_sequence, departure_time, arrival_time,
              pickup_type, drop_off_type
       FROM stop_times
       ORDER BY trip_id, stop_sequence`,
    )
    .all() as StopTimeRow[];

  console.log(`  [${prefix}] ${tripRows.length} trips, ${stopTimeRows.length} stop_times`);

  // 3. Group stop_times by trip_id
  const tripStopTimesMap = new Map<string, TripStopTimes>();
  let currentTripId = '';
  let currentTrip: TripStopTimes | null = null;
  let skipped = 0;

  for (const st of stopTimeRows) {
    if (st.trip_id !== currentTripId) {
      currentTripId = st.trip_id;
      const trip = tripMap.get(st.trip_id);
      if (!trip) {
        skipped++;
        currentTrip = null;
        continue;
      }
      currentTrip = {
        tripId: st.trip_id,
        routeId: trip.route_id,
        serviceId: trip.service_id,
        headsign: trip.trip_headsign ?? '',
        directionId: trip.direction_id,
        stops: [],
        departures: [],
        arrivals: [],
        pickupTypes: [],
        dropOffTypes: [],
      };
      tripStopTimesMap.set(st.trip_id, currentTrip);
    }
    if (!currentTrip) {
      skipped++;
      continue;
    }
    currentTrip.stops.push(st.stop_id);
    currentTrip.departures.push(st.departure_time ? timeToMinutes(st.departure_time) : null);
    currentTrip.arrivals.push(st.arrival_time ? timeToMinutes(st.arrival_time) : null);
    currentTrip.pickupTypes.push(st.pickup_type);
    currentTrip.dropOffTypes.push(st.drop_off_type);
  }

  if (skipped > 0) {
    console.warn(`  [${prefix}] WARN: ${skipped} stop_times skipped (trip not found)`);
  }

  // 4. Group trips by pattern (route + headsign + direction + stop sequence)
  const patternKey = (t: TripStopTimes): string =>
    `${t.routeId}\0${t.headsign}\0${t.directionId ?? ''}\0${t.stops.join(',')}`;

  const patternGroups = new Map<
    string,
    {
      routeId: string;
      headsign: string;
      directionId: number | null;
      stops: string[];
      trips: TripStopTimes[];
    }
  >();

  for (const [, trip] of tripStopTimesMap) {
    const key = patternKey(trip);
    let group = patternGroups.get(key);
    if (!group) {
      group = {
        routeId: trip.routeId,
        headsign: trip.headsign,
        directionId: trip.directionId,
        stops: trip.stops,
        trips: [],
      };
      patternGroups.set(key, group);
    }
    group.trips.push(trip);
  }

  // 5. Sort patterns deterministically and assign IDs
  // Use code-unit comparison (< / >) instead of localeCompare to avoid
  // locale-dependent collation differences across environments.
  const sortedPatterns = [...patternGroups.values()].sort((a, b) => {
    const ka = patternSortKey(a);
    const kb = patternSortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const tripPatterns: Record<string, TripPatternJson> = {};
  // Map from pattern key -> pattern ID for timetable building
  const patternIdByKey = new Map<string, string>();

  for (let i = 0; i < sortedPatterns.length; i++) {
    const p = sortedPatterns[i];
    const patternId = `${prefix}:p${i + 1}`;
    const key = patternKey(p.trips[0]);
    patternIdByKey.set(key, patternId);

    const pattern: TripPatternJson = {
      v: 2,
      r: `${prefix}:${p.routeId}`,
      h: p.headsign,
      stops: p.stops.map((s) => `${prefix}:${s}`),
    };

    if (p.directionId != null) {
      pattern.dir = p.directionId as 0 | 1;
    }

    tripPatterns[patternId] = pattern;
  }

  console.log(`  [${prefix}] ${sortedPatterns.length} trip patterns`);

  // 6. Build per-stop timetable
  // stopId -> patternId -> serviceId -> { departures, arrivals, pickupTypes, dropOffTypes }
  type DepartureData = {
    d: number;
    a: number;
    pt: number;
    dt: number;
  };
  const stopTimetable = new Map<string, Map<string, Map<string, DepartureData[]>>>();

  for (const [, trip] of tripStopTimesMap) {
    const key = patternKey(trip);
    const patId = patternIdByKey.get(key)!;
    const prefixedServiceId = `${prefix}:${trip.serviceId}`;

    for (let stopIdx = 0; stopIdx < trip.stops.length; stopIdx++) {
      const dep = trip.departures[stopIdx];
      if (dep == null) {
        continue;
      }

      const prefixedStopId = `${prefix}:${trip.stops[stopIdx]}`;
      const arr = trip.arrivals[stopIdx] ?? dep;
      const pt = trip.pickupTypes[stopIdx] ?? 0;
      const dt = trip.dropOffTypes[stopIdx] ?? 0;

      let patternMap = stopTimetable.get(prefixedStopId);
      if (!patternMap) {
        patternMap = new Map();
        stopTimetable.set(prefixedStopId, patternMap);
      }

      let serviceMap = patternMap.get(patId);
      if (!serviceMap) {
        serviceMap = new Map();
        patternMap.set(patId, serviceMap);
      }

      let entries = serviceMap.get(prefixedServiceId);
      if (!entries) {
        entries = [];
        serviceMap.set(prefixedServiceId, entries);
      }

      entries.push({ d: dep, a: arr, pt, dt });
    }
  }

  // 7. Convert to output format
  const timetable: Record<string, TimetableGroupV2Json[]> = {};
  let groupCount = 0;

  for (const [stopId, patternMap] of stopTimetable) {
    const groups: TimetableGroupV2Json[] = [];

    for (const [patId, serviceMap] of patternMap) {
      const d: Record<string, number[]> = {};
      const a: Record<string, number[]> = {};
      const pt: Record<string, (0 | 1 | 2 | 3)[]> = {};
      const dt: Record<string, (0 | 1 | 2 | 3)[]> = {};

      for (const [serviceId, entries] of serviceMap) {
        // Sort by departure time
        entries.sort((x, y) => x.d - y.d);
        d[serviceId] = entries.map((e) => e.d);
        a[serviceId] = entries.map((e) => e.a);
        pt[serviceId] = entries.map((e) => e.pt as 0 | 1 | 2 | 3);
        dt[serviceId] = entries.map((e) => e.dt as 0 | 1 | 2 | 3);
      }

      const group: TimetableGroupV2Json = {
        v: 2,
        tp: patId,
        d,
        a,
        // GTFS always provides pickup_type/drop_off_type, so always include
        pt,
        dt,
      };

      groups.push(group);
      groupCount++;
    }

    timetable[stopId] = groups;
  }

  console.log(`  [${prefix}] ${stopTimetable.size} stops, ${groupCount} timetable groups`);

  return { tripPatterns, timetable };
}
