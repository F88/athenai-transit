import type { StopWithMeta } from '../../types/app/transit-composed';
import { computeRouteStats, type RouteStats } from './compute-route-stats';

/**
 * Static composition summary for a set of stops: the stop count plus the
 * {@link RouteStats} (distinct routes / agencies / route types) of the routes
 * serving them.
 *
 * Describes WHAT a stop set (e.g. all stops within a radius) contains, not its
 * current service state, so a route / agency with no upcoming service still
 * counts -- intentional static metadata ("what operates around here"). Distinct
 * from the per-stop {@link StopWithMeta.stats} (one stop's own counts); for
 * time-windowed service counts use `computeStopsCounts` instead.
 */
export interface StopWithMetaStats extends RouteStats {
  /**
   * Number of stops in the set. This is the element count (`stops.length`), not
   * a distinct-`stop_id` count: callers are expected to pass one entry per stop
   * (as the nearby-stop pipeline does), so the two coincide.
   */
  stopCount: number;
}

/**
 * Compute the static {@link StopWithMetaStats} for a set of stops.
 *
 * Takes the base {@link StopWithMeta} (not the full `StopWithContext`) so it can
 * summarize any stop collection. The route / agency / route-type counts come
 * from {@link computeRouteStats} over the routes serving the stops, so
 * `agencyCount` reflects each route's `agency_id`.
 *
 * @param stops - The stop set to summarize.
 * @returns The static composition summary.
 */
export function computeStopWithMetaStats(stops: readonly StopWithMeta[]): StopWithMetaStats {
  return {
    // Element count, not distinct stop_id (see StopWithMetaStats.stopCount).
    stopCount: stops.length,
    ...computeRouteStats(stops.flatMap((swm) => swm.routes)),
  };
}
