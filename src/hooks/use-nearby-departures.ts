import { useEffect, useState } from 'react';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import type { TransitRepository } from '../repositories/transit-repository';
import { createLogger } from '../utils/logger';

const logger = createLogger('NearbyDepartures');

/**
 * Return type for the useNearbyDepartures hook.
 */
export interface UseNearbyDeparturesReturn {
  /** Departure contexts for all nearby stops. */
  nearbyDepartures: StopWithContext[];
  /** Whether departures are currently being fetched. */
  isNearbyLoading: boolean;
}

/**
 * Fetches upcoming departures for all nearby stops.
 *
 * Automatically re-fetches when `radiusStops`, `dateTime`, or `repo` change.
 * Loading state is managed internally: set to `true` when dependencies change,
 * and `false` when the fetch completes.
 *
 * Stale fetches are cancelled via a `cancelled` flag so that only the latest
 * result is applied.
 *
 * @param radiusStops - Stops within the nearby radius.
 * @param dateTime - The reference date/time for departure lookup.
 * @param repo - Transit data repository.
 * @returns Departure data and loading state.
 */
export function useNearbyDepartures(
  radiusStops: StopWithMeta[],
  dateTime: Date,
  repo: TransitRepository,
): UseNearbyDeparturesReturn {
  const [nearbyDepartures, setNearbyDepartures] = useState<StopWithContext[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading must be set synchronously when deps change
    setIsNearbyLoading(true);

    const promise =
      radiusStops.length === 0
        ? Promise.resolve([])
        : Promise.all(
            radiusStops.map(async ({ stop, agencies, routes }) => {
              const [depsResult, rtResult] = await Promise.all([
                repo.getUpcomingDepartures(stop.stop_id, dateTime),
                repo.getRouteTypesForStop(stop.stop_id),
              ]);
              const groups = depsResult.success ? depsResult.data : [];
              const routeTypes = rtResult.success ? rtResult.data : [3 as const];
              return { stop, routeTypes, groups, agencies, routes };
            }),
          );

    promise
      .then((results) => {
        if (cancelled) {
          return;
        }
        const withDepartures = results.filter((r) => r.groups.length > 0);
        logger.debug(
          `nearby departures: ${withDepartures.length}/${results.length} stops with departures`,
        );
        setNearbyDepartures(results);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        logger.error('Failed to fetch nearby departures:', error);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsNearbyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [radiusStops, dateTime, repo]);

  return { nearbyDepartures, isNearbyLoading };
}
