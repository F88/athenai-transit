/**
 * Build stopGeo section of GlobalInsightsBundle.
 *
 * Computes per-stop geographic and connectivity metrics across all
 * sources. Requires all sources' DataBundle data to be loaded and
 * merged before calling.
 *
 * ### Metrics
 *
 * - `nr`: distance (km) to the nearest stop served by a route NOT
 *   in this stop's own route set (definition B).
 *   **Day-agnostic**: uses all routes that structurally serve the stop
 *   (from tripPatterns), regardless of which service group is active.
 *   This measures network topology, not service availability.
 * - `wp`: distance (km) to the nearest stop with a different
 *   `parent_station`. Omitted when the stop has no parent_station.
 *   Day-agnostic like `nr`.
 * - `cn`: connectivity within 300m radius — route count, freq total,
 *   and nearby stop count, keyed by service group.
 *   **Day-dependent**: uses routeFreqs filtered to the target service
 *   group, so frequency reflects actual service on that day type.
 *
 * ### location_type handling
 *
 * - l=0: computed directly from coordinates and timetable data.
 * - l=1: nr/wp derived as min of children; cn computed at parent's
 *   own coordinates (parent has no routes, so nr/wp can't be
 *   computed directly).
 * - l=2-4: excluded from output.
 */

import type { StopGeoJson } from '../../../../../src/types/data/transit-v2-json';
import { haversineKm } from '../../geo-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A stop with all data needed for stopGeo computation. */
export interface StopEntry {
  id: string;
  lat: number;
  lon: number;
  /**
   * All route IDs structurally serving this stop (from tripPatterns).
   *
   * Includes routes from ALL service groups (weekday, Saturday, Sunday, etc.),
   * not filtered by a specific service group. Used by `nr` to measure
   * network topology — "does a different route exist nearby?" — which is
   * independent of which day type is selected.
   */
  routeIds: Set<string>;
  /**
   * Per-route departure frequency for a specific service group.
   *
   * Unlike `routeIds`, this IS filtered to a target service group.
   * Used by `cn` (connectivity) where actual service availability matters.
   */
  routeFreqs: Map<string, number>;
  /** Parent station stop_id, if any. */
  parentStation?: string;
  /** GTFS location_type. */
  locationType: number;
}

/** Connectivity metrics for a single service group. */
interface ConnectivityResult {
  rc: number;
  freq: number;
  sc: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radius in meters for connectivity computation. */
const CONNECTIVITY_RADIUS_M = 300;

/** Connectivity radius in km for haversine comparison. */
const CONNECTIVITY_RADIUS_KM = CONNECTIVITY_RADIUS_M / 1000;

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute connectivity metrics within 300m radius for a single point.
 *
 * Used by buildParentStopGeo to compute cn at parent coordinates.
 * For l=0 stops, computeAllMetrics is used instead (single-pass).
 */
function computeConnectivity(target: StopEntry, allStops: StopEntry[]): ConnectivityResult {
  const uniqueRoutes = new Map<string, number>();
  for (const [rid, f] of target.routeFreqs) {
    uniqueRoutes.set(rid, Math.max(uniqueRoutes.get(rid) ?? 0, f));
  }

  let sc = 0;

  for (const s of allStops) {
    if (s.id === target.id) {
      continue;
    }
    const d = haversineKm(target.lat, target.lon, s.lat, s.lon);
    if (d > CONNECTIVITY_RADIUS_KM) {
      continue;
    }
    sc++;
    for (const [rid, f] of s.routeFreqs) {
      uniqueRoutes.set(rid, Math.max(uniqueRoutes.get(rid) ?? 0, f));
    }
  }

  let freq = 0;
  for (const f of uniqueRoutes.values()) {
    freq += f;
  }

  return { rc: uniqueRoutes.size, freq, sc };
}

/**
 * Compute nr, wp, and cn in a single pass over all stops.
 *
 * Avoids 3 separate O(N) scans per stop by combining all metric
 * computations into one loop.
 */
function computeAllMetrics(
  target: StopEntry,
  allStops: StopEntry[],
): { nr: number | undefined; wp: number | undefined; cn: ConnectivityResult } {
  let bestNr: number | undefined;
  let bestWp: number | undefined;
  const hasPs = !!target.parentStation;

  // cn: start with target's own routes
  const uniqueRoutes = new Map<string, number>();
  for (const [rid, f] of target.routeFreqs) {
    uniqueRoutes.set(rid, Math.max(uniqueRoutes.get(rid) ?? 0, f));
  }
  let sc = 0;

  for (const s of allStops) {
    if (s.id === target.id) {
      continue;
    }

    const d = haversineKm(target.lat, target.lon, s.lat, s.lon);

    // nr: nearest stop with a route not in target's route set
    if (bestNr === undefined || d < bestNr) {
      let hasDifferentRoute = false;
      for (const rid of s.routeIds) {
        if (!target.routeIds.has(rid)) {
          hasDifferentRoute = true;
          break;
        }
      }
      if (hasDifferentRoute) {
        bestNr = d;
      }
    }

    // wp: nearest stop with different parent_station
    if (hasPs && s.parentStation && s.parentStation !== target.parentStation) {
      if (bestWp === undefined || d < bestWp) {
        bestWp = d;
      }
    }

    // cn: connectivity within 300m
    if (d <= CONNECTIVITY_RADIUS_KM) {
      sc++;
      for (const [rid, f] of s.routeFreqs) {
        uniqueRoutes.set(rid, Math.max(uniqueRoutes.get(rid) ?? 0, f));
      }
    }
  }

  let freq = 0;
  for (const f of uniqueRoutes.values()) {
    freq += f;
  }

  return {
    nr: bestNr,
    wp: bestWp,
    cn: { rc: uniqueRoutes.size, freq, sc },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build stopGeo for all l=0 stops (full scan, no spatial index).
 *
 * Uses a single pass per stop to compute nr, wp, and cn simultaneously,
 * avoiding 3 separate O(N) scans.
 *
 * @param stops - All l=0 stops from all sources.
 * @param groupKey - Service group key for connectivity (e.g. "ho").
 * @param onProgress - Optional callback for progress reporting.
 * @returns Map of stop_id to StopGeoJson.
 */
export function buildStopGeo(
  stops: StopEntry[],
  groupKey: string,
  onProgress?: (current: number, total: number) => void,
): Record<string, StopGeoJson> {
  const result: Record<string, StopGeoJson> = {};

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    const { nr, wp, cn } = computeAllMetrics(stop, stops);

    const geo: StopGeoJson = {
      nr: nr !== undefined ? Math.round(nr * 1000) / 1000 : 0,
    };

    if (wp !== undefined) {
      geo.wp = Math.round(wp * 1000) / 1000;
    }

    // Only include cn if there are routes (rc > 0)
    if (cn.rc > 0) {
      geo.cn = { [groupKey]: cn };
    }

    result[stop.id] = geo;

    if (onProgress && (i + 1) % 500 === 0) {
      onProgress(i + 1, stops.length);
    }
  }

  // Final progress callback (skip if last iteration already reported)
  if (onProgress && stops.length % 500 !== 0) {
    onProgress(stops.length, stops.length);
  }

  return result;
}

/**
 * Derive stopGeo for l=1 (parent/station) stops from their children's values.
 *
 * - nr: minimum of children's positive nr (nr=0 excluded; see StopGeoJson)
 * - wp: minimum of children's wp (undefined excluded)
 * - cn: computed directly using parent's coordinates
 *
 * @param parents - All l=1 stops.
 * @param childrenMap - Map of parent stop_id to list of child stop_ids.
 * @param childGeo - Pre-computed stopGeo for l=0 stops.
 * @param allL0Stops - All l=0 stops (for parent cn computation).
 * @param groupKey - Service group key for connectivity (e.g. "ho").
 * @returns Map of parent stop_id to StopGeoJson.
 */
export function buildParentStopGeo(
  parents: StopEntry[],
  childrenMap: Map<string, string[]>,
  childGeo: Partial<Record<string, StopGeoJson>>,
  allL0Stops: StopEntry[],
  groupKey: string,
): Record<string, StopGeoJson> {
  const result: Record<string, StopGeoJson> = {};

  for (const parent of parents) {
    const childIds = childrenMap.get(parent.id) ?? [];
    const childGeos = childIds.map((cid) => childGeo[cid]).filter(Boolean);

    if (childGeos.length === 0) {
      continue;
    }

    // nr: min of children's positive values.
    // nr=0 is a sentinel meaning "no different-route stop exists", not a
    // distance. Filter it out so the parent gets the nearest real distance.
    // If ALL children have nr=0, the parent also gets 0 (no alternative).
    const nrs = childGeos.map((g) => g.nr).filter((n) => n > 0);
    const nr = nrs.length > 0 ? Math.min(...nrs) : 0;

    // wp: min of children
    const wps = childGeos.map((g) => g.wp).filter((w): w is number => w !== undefined);
    const wp = wps.length > 0 ? Math.min(...wps) : undefined;

    // cn: compute directly at parent's coordinates
    // Create a temporary StopEntry for the parent with empty routes
    const parentEntry: StopEntry = {
      id: parent.id,
      lat: parent.lat,
      lon: parent.lon,
      routeIds: new Set(),
      routeFreqs: new Map(),
      parentStation: undefined,
      locationType: 1,
    };
    const cn = computeConnectivity(parentEntry, allL0Stops);

    const geo: StopGeoJson = { nr };

    if (wp !== undefined) {
      geo.wp = wp;
    }

    if (cn.rc > 0) {
      geo.cn = { [groupKey]: cn };
    }

    result[parent.id] = geo;
  }

  return result;
}
