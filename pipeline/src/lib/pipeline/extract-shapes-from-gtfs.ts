/**
 * Extract route shapes from GTFS shapes.txt data in a SQLite database.
 *
 * Shared by both v1 and v2 shapes builders. Returns
 * {@link ShapePointV2} arrays — `[lat, lon]` when shape_dist_traveled
 * is absent, `[lat, lon, dist]` when present.
 *
 * @module
 */

import type Database from 'better-sqlite3';

import type { ShapePointV2 } from '../../../../src/types/data/transit-v2-json';

/**
 * Extract route shapes from GTFS shapes.txt data.
 *
 * Builds a mapping from prefixed route_id to arrays of polylines,
 * where each polyline is an array of {@link ShapePointV2} tuples.
 * When a source provides `shape_dist_traveled`, the value is included
 * as the optional third element.
 *
 * @param db - A better-sqlite3 database with `trips` and `shapes` tables.
 * @param prefix - Source prefix to prepend to route IDs (e.g. `"toei-bus"`).
 * @returns Mapping of `"{prefix}:{route_id}"` to arrays of polylines.
 */
export function extractShapes(
  db: Database.Database,
  prefix: string,
): Record<string, ShapePointV2[][]> {
  // Get unique route_id -> shape_id mappings from trips
  const routeShapes = db
    .prepare(
      `SELECT DISTINCT t.route_id, t.shape_id
       FROM trips t
       WHERE t.shape_id IS NOT NULL AND t.shape_id <> ''
       ORDER BY t.route_id, t.shape_id`,
    )
    .all() as Array<{ route_id: string; shape_id: string }>;

  // Group shape_ids by route_id
  const routeToShapeIds = new Map<string, string[]>();
  for (const rs of routeShapes) {
    let ids = routeToShapeIds.get(rs.route_id);
    if (!ids) {
      ids = [];
      routeToShapeIds.set(rs.route_id, ids);
    }
    ids.push(rs.shape_id);
  }

  // Load all shape points, ordered by shape_id and sequence.
  // shape_dist_traveled is included when the column exists;
  // SQLite returns NULL for rows where the value is absent.
  const shapePoints = db
    .prepare(
      `SELECT shape_id, shape_pt_lat, shape_pt_lon, shape_dist_traveled
       FROM shapes
       ORDER BY shape_id, shape_pt_sequence`,
    )
    .all() as Array<{
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_dist_traveled: number | null;
  }>;

  // Group points by shape_id
  const shapeMap = new Map<string, ShapePointV2[]>();
  for (const pt of shapePoints) {
    let points = shapeMap.get(pt.shape_id);
    if (!points) {
      points = [];
      shapeMap.set(pt.shape_id, points);
    }
    // Round to 5 decimal places (~1m precision) to reduce file size
    const lat = Math.round(pt.shape_pt_lat * 1e5) / 1e5;
    const lon = Math.round(pt.shape_pt_lon * 1e5) / 1e5;
    if (pt.shape_dist_traveled != null) {
      points.push([lat, lon, pt.shape_dist_traveled]);
    } else {
      points.push([lat, lon]);
    }
  }

  // Build final structure: prefixed route_id -> array of polylines
  const json: Record<string, ShapePointV2[][]> = {};
  let totalShapes = 0;

  for (const [routeId, shapeIds] of routeToShapeIds) {
    const polylines: ShapePointV2[][] = [];
    for (const shapeId of shapeIds) {
      const points = shapeMap.get(shapeId);
      if (points && points.length > 0) {
        polylines.push(points);
        totalShapes++;
      }
    }
    if (polylines.length > 0) {
      json[`${prefix}:${routeId}`] = polylines;
    }
  }

  console.log(
    `  [${prefix}] ${routeToShapeIds.size} routes, ${totalShapes} shapes, ${shapePoints.length} points`,
  );
  return json;
}
