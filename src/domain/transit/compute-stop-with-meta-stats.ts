import type { StopWithMeta } from '../../types/app/transit-composed';

/**
 * Static composition summary for a set of stops.
 *
 * Describes WHAT a stop set (e.g. all stops within a radius) contains, not its
 * current service state: how many stops, and how many distinct agencies /
 * routes / route types serve them. All fields are derived from each stop's
 * resolved {@link StopWithMeta} context, so an entity with no upcoming service
 * still counts -- this is intentional static metadata ("what operates around
 * here"). Distinct from the per-stop {@link StopWithMeta.stats} (one stop's own
 * counts); for time-windowed service counts use `computeStopsCounts` instead.
 */
export interface StopWithMetaStats {
  /**
   * Number of stops in the set. This is the element count (`stops.length`), not
   * a distinct-`stop_id` count: callers are expected to pass one entry per stop
   * (as the nearby-stop pipeline does), so the two coincide.
   */
  stopCount: number;
  /** Distinct agencies (`agency_id`) serving the stops. */
  agencyCount: number;
  /** Distinct routes (`route_id`) serving the stops. */
  routeCount: number;
  /**
   * Distinct route types serving the stops (from each route's `route_type`).
   * A route whose `route_type` is missing (malformed data) is not counted, so
   * `null` / `undefined` never appears as a "type".
   */
  routeTypeCount: number;
}

/**
 * Compute the static {@link StopWithMetaStats} for a set of stops in a single
 * pass.
 *
 * Takes the base {@link StopWithMeta} (not the full `StopWithContext`) so it can
 * summarize any stop collection. The distinct agency / route / route-type counts
 * are accumulated in one traversal; route types are read from each route's
 * `route_type` (not a stop's dynamic `routeTypes` field).
 *
 * @param stops - The stop set to summarize.
 * @returns The static composition summary.
 */
export function computeStopWithMetaStats(stops: readonly StopWithMeta[]): StopWithMetaStats {
  const agencyIds = new Set<string>();
  const routeIds = new Set<string>();
  const routeTypes = new Set<number>();

  for (const swm of stops) {
    for (const agency of swm.agencies) {
      agencyIds.add(agency.agency_id);
    }
    for (const route of swm.routes) {
      routeIds.add(route.route_id);
      // Guard malformed data: a missing route_type must not be counted as a
      // type. `!= null` keeps valid 0 / -1 while dropping null / undefined.
      if (route.route_type != null) {
        routeTypes.add(route.route_type);
      }
    }
  }

  return {
    // Element count, not distinct stop_id (see StopWithMetaStats.stopCount).
    stopCount: stops.length,
    agencyCount: agencyIds.size,
    routeCount: routeIds.size,
    routeTypeCount: routeTypes.size,
  };
}
