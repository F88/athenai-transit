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
