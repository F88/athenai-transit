import { computeRouteStats, type RouteStats } from './compute-route-stats';
import type { TransitDisplayDatum } from './transit-info-display/build-transit-display-data';

/**
 * Stats over a set of {@link TransitDisplayDatum} (a board's entries -- the stop
 * events on it): the entry / stop counts plus the {@link RouteStats} of the
 * routes those entries run on. The entry-side counterpart of the stop-set
 * `StopWithMetaStats`. The scope depends on which entries are measured -- the
 * pre-cap board yields "qualifying" totals, the capped board yields displayed
 * totals.
 */
export interface TransitDisplayDatumStats extends RouteStats {
  /** Number of entries (stop events): the length of the datum array. */
  entryCount: number;
  /** Distinct stops the entries come from (by `stop_id`). */
  stopCount: number;
}

/**
 * Compute {@link TransitDisplayDatumStats} for a set of board entries in a
 * single pass.
 *
 * The entry-side counterpart of `computeStopWithMetaStats`: it counts the
 * entries plus the distinct stops / routes / agencies / route types they
 * involve. Run it on the pre-cap board for the "qualifying" totals (the cap
 * discards them downstream). A route whose `route_type` is missing is not
 * counted as a type.
 *
 * @param rows - The board entries to summarize.
 * @returns The entry-set stats.
 */
export function computeTransitDisplayDatumStats(
  rows: readonly TransitDisplayDatum[],
): TransitDisplayDatumStats {
  const stopIds = new Set<string>();
  for (const row of rows) {
    stopIds.add(row.stop.stop.stop_id);
  }

  // Route / agency / route-type distinct counts are the shared route-stat core.
  const routeStats = computeRouteStats(rows.map((row) => row.timetableEntry.routeDirection.route));

  return {
    entryCount: rows.length,
    stopCount: stopIds.size,
    ...routeStats,
  };
}
