/**
 * Extract TripPatternJson and TimetableGroupV2Json from GTFS SQLite database.
 *
 * This is the most complex v2 extraction. It:
 * 1. Groups trips by their stop sequence → trip patterns
 * 2. Assigns deterministic pattern IDs: `{prefix}:p{1-indexed}`
 * 3. Builds per-stop timetable groups referencing patterns
 * 4. Includes arrival_time, pickup_type, drop_off_type
 *
 * Stops are not filtered out of the bundle when they lack timetable
 * coverage. This extractor only builds the timetable section, so a stop
 * with no usable departure records simply does not get a timetable key.
 * The stop record itself is still emitted from stops.txt by design.
 */

import type Database from 'better-sqlite3';

import type {
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../../src/types/data/transit-v2-json';
import { timeToMinutes } from '../../../transit-time-utils';

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
  stop_headsign: string | null;
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
  stopHeadsigns: (string | null)[];
}

// ---------------------------------------------------------------------------
// Pattern sorting
// ---------------------------------------------------------------------------

/**
 * Deterministic sort key for a trip pattern.
 * route_id → headsign → direction → stops → stopHeadsigns
 *
 * stopHeadsigns is included so that trips with the same stop sequence
 * but different stop_headsign values form separate patterns. Without
 * this, the first trip's stopHeadsigns would silently win (see #92).
 */
function patternSortKey(p: {
  routeId: string;
  headsign: string;
  directionId: number | null;
  stops: string[];
  stopHeadsigns: (string | null)[];
}): string {
  const dir = p.directionId ?? -1;
  // JSON.stringify for arrays to avoid delimiter collision.
  // GTFS IDs and headsigns are free-text UTF-8 and may contain commas.
  return `${p.routeId}\0${p.headsign}\0${dir}\0${JSON.stringify(p.stops)}\0${JSON.stringify(p.stopHeadsigns)}`;
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
              pickup_type, drop_off_type, stop_headsign
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
        stopHeadsigns: [],
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
    currentTrip.stopHeadsigns.push(st.stop_headsign);
  }

  if (skipped > 0) {
    console.warn(`  [${prefix}] WARN: ${skipped} stop_times skipped (trip not found)`);
  }

  // 4. Group trips by pattern (route + headsign + direction + stop sequence + stop headsigns)
  // stop_headsign is included in the key so that trips with the same stop
  // sequence but different stop_headsign values form separate patterns.
  const patternKey = (t: TripStopTimes): string =>
    `${t.routeId}\0${t.headsign}\0${t.directionId ?? ''}\0${JSON.stringify(t.stops)}\0${JSON.stringify(t.stopHeadsigns)}`;

  const patternGroups = new Map<
    string,
    {
      routeId: string;
      headsign: string;
      directionId: number | null;
      stops: string[];
      stopHeadsigns: (string | null)[];
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
        stopHeadsigns: trip.stopHeadsigns,
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

    // Use the first trip's stopHeadsigns as the representative values.
    // All trips in the same pattern share the same stop_headsign at each
    // stop — guaranteed by patternKey including stopHeadsigns.
    const refTrip = p.trips[0];

    const pattern: TripPatternJson = {
      v: 2,
      r: `${prefix}:${p.routeId}`,
      h: p.headsign,
      stops: p.stops.map((s, idx) => {
        const stop: TripPatternJson['stops'][number] = {
          id: `${prefix}:${s}`,
        };
        const sh = refTrip.stopHeadsigns[idx];
        // NULL = stop_headsign not specified → omit sh (consumer falls back to h).
        // In practice, the CSV→DB import converts empty CSV fields to NULL,
        // so sh is either a non-empty string or null here.
        if (sh != null) {
          stop.sh = sh;
        }
        return stop;
      }),
    };

    if (p.directionId != null) {
      pattern.dir = p.directionId as 0 | 1;
    }

    tripPatterns[patternId] = pattern;
  }

  console.log(`  [${prefix}] ${sortedPatterns.length} trip patterns`);

  // 6. Build per-stop timetable
  // stopId -> patternId -> si (stop position within pattern) -> serviceId -> entries
  //
  // The 4-level nesting is required by Issue #47: when the same stop_id appears
  // at multiple positions within one pattern (6-shape, circular routes), each
  // position needs its own group identified by `si`. Without splitting, departures
  // from different positions get merged and frequencies double-count.
  type DepartureData = {
    d: number;
    a: number;
    pt: number;
    dt: number;
  };
  const stopTimetable = new Map<string, Map<string, Map<number, Map<string, DepartureData[]>>>>();

  for (const [, trip] of tripStopTimesMap) {
    const key = patternKey(trip);
    const patId = patternIdByKey.get(key)!;
    const prefixedServiceId = `${prefix}:${trip.serviceId}`;

    for (let stopIdx = 0; stopIdx < trip.stops.length; stopIdx++) {
      const dep = trip.departures[stopIdx];
      if (dep == null) {
        continue;
      }

      // stop_id is not yet prefixed in the internal TripStopTimes
      const prefixedStopId = `${prefix}:${trip.stops[stopIdx]}`;
      const arr = trip.arrivals[stopIdx] ?? dep;
      const pt = trip.pickupTypes[stopIdx] ?? 0;
      const dt = trip.dropOffTypes[stopIdx] ?? 0;

      // si = 0-based position within pattern.stops. Same value across all trips
      // of the same pattern (pattern key includes JSON.stringify(t.stops), so
      // trip.stops and pattern.stops are aligned by index).
      const si = stopIdx;

      let patternMap = stopTimetable.get(prefixedStopId);
      if (!patternMap) {
        patternMap = new Map();
        stopTimetable.set(prefixedStopId, patternMap);
      }

      let siMap = patternMap.get(patId);
      if (!siMap) {
        siMap = new Map();
        patternMap.set(patId, siMap);
      }

      let serviceMap = siMap.get(si);
      if (!serviceMap) {
        serviceMap = new Map();
        siMap.set(si, serviceMap);
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

    for (const [patId, siMap] of patternMap) {
      // Emit one group per (patId, si) pair. For 6-shape/circular patterns
      // where the same stop appears at multiple positions, this produces
      // multiple groups under the same (stopId, patId).
      // Sort by si for deterministic output.
      const sortedSiEntries = [...siMap.entries()].sort((a, b) => a[0] - b[0]);

      for (const [si, serviceMap] of sortedSiEntries) {
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
          si,
          d,
          a,
          // GTFS always provides pickup_type/drop_off_type, so always include
          pt,
          dt,
        };

        groups.push(group);
        groupCount++;
      }
    }

    timetable[stopId] = groups;
  }

  console.log(`  [${prefix}] ${stopTimetable.size} stops, ${groupCount} timetable groups`);

  return { tripPatterns, timetable };
}
