/**
 * Extract RouteV2Json[] from GTFS SQLite database.
 *
 * Adds `desc` (route_desc) and removes `u` (route_url, moved to lookup).
 */

import type Database from 'better-sqlite3';

import type { RouteV2Json } from '../../../../../../src/types/data/transit-v2-json';

/**
 * Extract all routes from the GTFS database as v2 JSON records.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @param routeColorFallbacks - Fallback colors keyed by route_id or '*'.
 * @returns Array of RouteV2Json records.
 */
export function extractRoutesV2(
  db: Database.Database,
  prefix: string,
  routeColorFallbacks: Record<string, string>,
): RouteV2Json[] {
  const rows = db
    .prepare(
      `SELECT route_id, route_short_name, route_long_name, route_type,
              route_color, route_text_color, agency_id, route_desc
       FROM routes
       ORDER BY route_id`,
    )
    .all() as Array<{
    route_id: string;
    route_short_name: string | null;
    route_long_name: string | null;
    route_type: number;
    route_color: string | null;
    route_text_color: string | null;
    agency_id: string | null;
    route_desc: string | null;
  }>;

  const defaultColor = routeColorFallbacks['*'] ?? '';

  const result: RouteV2Json[] = rows.map((r) => {
    const rawColor = r.route_color || '';
    const rawTextColor = r.route_text_color || '';
    // Treat identical color/textColor (e.g. 000000/000000) as unset
    const colorUnset = !rawColor || (rawColor === rawTextColor && rawColor !== 'FFFFFF');
    const color = colorUnset ? routeColorFallbacks[r.route_id] || defaultColor : rawColor;
    const textColor = colorUnset && color !== rawColor ? 'FFFFFF' : rawTextColor;

    const route: RouteV2Json = {
      v: 2,
      i: `${prefix}:${r.route_id}`,
      s: r.route_short_name ?? '',
      l: r.route_long_name ?? '',
      t: r.route_type,
      c: color,
      tc: textColor,
      ai: r.agency_id ? `${prefix}:${r.agency_id}` : '',
    };

    if (r.route_desc) {
      route.desc = r.route_desc;
    }

    return route;
  });

  console.log(`  [${prefix}] ${rows.length} routes (v2)`);
  return result;
}
