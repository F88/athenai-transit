/**
 * Extract StopV2Json[] from GTFS SQLite database.
 *
 * Unlike v1, does NOT filter by location_type — all stops are included.
 * Parent stations (location_type=1) are emitted for terminal grouping.
 * The `ai` field is removed in v2 (GTFS stops have no agency_id).
 */

import type Database from 'better-sqlite3';

import type { StopV2Json } from '../../../../src/types/data/transit-v2-json';

/**
 * Extract all stops from the GTFS database as v2 JSON records.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing (e.g. "tobus").
 * @returns Array of StopV2Json records.
 */
export function extractStopsV2(db: Database.Database, prefix: string): StopV2Json[] {
  const rows = db
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon, location_type,
              wheelchair_boarding, parent_station, platform_code
       FROM stops
       ORDER BY stop_id`,
    )
    .all() as Array<{
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    location_type: number | null;
    wheelchair_boarding: number | null;
    parent_station: string | null;
    platform_code: string | null;
  }>;

  const result: StopV2Json[] = rows.map((s) => {
    const stop: StopV2Json = {
      v: 2,
      i: `${prefix}:${s.stop_id}`,
      n: s.stop_name,
      a: s.stop_lat,
      o: s.stop_lon,
      l: s.location_type ?? 0,
    };

    if (s.wheelchair_boarding != null) {
      stop.wb = s.wheelchair_boarding as 0 | 1 | 2;
    }

    if (s.parent_station) {
      stop.ps = `${prefix}:${s.parent_station}`;
    }

    if (s.platform_code) {
      stop.pc = s.platform_code;
    }

    return stop;
  });

  console.log(`  [${prefix}] ${rows.length} stops (v2, all location_types)`);
  return result;
}
