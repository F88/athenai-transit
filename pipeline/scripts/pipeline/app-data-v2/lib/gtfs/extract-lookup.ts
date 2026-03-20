/**
 * Extract LookupV2Json from GTFS SQLite database.
 *
 * New in v2 — extracts stop_url, route_url, stop_desc into normalized
 * lookup tables to reduce duplication in the main sections.
 */

import type Database from 'better-sqlite3';

import type { LookupV2Json } from '../../../../../../src/types/data/transit-v2-json';

/**
 * Extract lookup data (URLs, descriptions) from the GTFS database.
 *
 * Only includes fields that have non-empty values in the source data.
 * Each sub-table is omitted entirely if the source has no data for it.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @returns LookupV2Json with optional sub-tables.
 */
export function extractLookupV2(db: Database.Database, prefix: string): LookupV2Json {
  const lookup: LookupV2Json = {};

  // stop_url
  const stopUrlRows = db
    .prepare(
      `SELECT stop_id, stop_url FROM stops
       WHERE stop_url IS NOT NULL AND stop_url <> ''
       ORDER BY stop_id`,
    )
    .all() as Array<{ stop_id: string; stop_url: string }>;

  if (stopUrlRows.length > 0) {
    const stopUrls: Record<string, string> = {};
    for (const row of stopUrlRows) {
      stopUrls[`${prefix}:${row.stop_id}`] = row.stop_url;
    }
    lookup.stopUrls = stopUrls;
    console.log(`  [${prefix}] lookup: ${stopUrlRows.length} stop URLs`);
  }

  // route_url
  const routeUrlRows = db
    .prepare(
      `SELECT route_id, route_url FROM routes
       WHERE route_url IS NOT NULL AND route_url <> ''
       ORDER BY route_id`,
    )
    .all() as Array<{ route_id: string; route_url: string }>;

  if (routeUrlRows.length > 0) {
    const routeUrls: Record<string, string> = {};
    for (const row of routeUrlRows) {
      routeUrls[`${prefix}:${row.route_id}`] = row.route_url;
    }
    lookup.routeUrls = routeUrls;
    console.log(`  [${prefix}] lookup: ${routeUrlRows.length} route URLs`);
  }

  // stop_desc
  const stopDescRows = db
    .prepare(
      `SELECT stop_id, stop_desc FROM stops
       WHERE stop_desc IS NOT NULL AND stop_desc <> ''
       ORDER BY stop_id`,
    )
    .all() as Array<{ stop_id: string; stop_desc: string }>;

  if (stopDescRows.length > 0) {
    const stopDescs: Record<string, string> = {};
    for (const row of stopDescRows) {
      stopDescs[`${prefix}:${row.stop_id}`] = row.stop_desc;
    }
    lookup.stopDescs = stopDescs;
    console.log(`  [${prefix}] lookup: ${stopDescRows.length} stop descriptions`);
  }

  return lookup;
}
