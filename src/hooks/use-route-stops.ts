import { useMemo } from 'react';
import type { StopWithMeta } from '../types/app/transit-composed';
import type { TransitRepository } from '../repositories/transit-repository';
import { createLogger } from '../lib/logger';

const logger = createLogger('RouteStops');

/**
 * Returns all stops served by the given routes.
 *
 * Used to display stop markers on selected routes when a stop is selected.
 * Recomputes when `routeIds` changes (referential equality).
 *
 * Uses `repo.getStopMetaByIds` (full-dataset scan) — **not** the
 * viewport-limited `findStopWithMeta` callback in `app.tsx` — because
 * a route's stops can extend far outside the current map viewport.
 * Reaching for a viewport-limited helper here previously caused stops
 * on long routes to silently disappear from the marker layer; that
 * regression is what motivated adding `getStopMetaByIds` to the
 * repository interface in the first place. See
 * `DEVELOPMENT.md > Stop ID lookup の選び方` for the general rule.
 *
 * @param routeIds - Set of route IDs from selectionInfo, or null if nothing is selected.
 * @param repo - Transit data repository.
 * @returns Array of StopWithMeta for all stops on the specified routes.
 */
export function useRouteStops(
  routeIds: Set<string> | null,
  repo: TransitRepository,
): StopWithMeta[] {
  return useMemo(() => {
    if (!routeIds || routeIds.size === 0) {
      return [];
    }
    const stopIds = repo.getStopsForRoutes(routeIds);
    const stops = repo.getStopMetaByIds(stopIds);
    logger.debug(`${routeIds.size} routes → ${stops.length} route stop markers`);
    return stops;
  }, [routeIds, repo]);
}
