import { useEffect, useState } from 'react';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import type { TransitRepository } from '../repositories/transit-repository';
import { getServiceDay } from '../domain/transit/service-day';
import { formatDateKey } from '../domain/transit/calendar-utils';
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
 * Fetches upcoming timetable entries for all nearby stops.
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
            radiusStops.map(async ({ stop, agencies, routes, distance, geo }) => {
              const [depsResult, rtResult] = await Promise.all([
                // No limit: T4 view needs all entries to group by route+headsign
                // without losing groups. Limit would not reduce repo cost anyway
                // (full scan + sort required for meta and overnight interleave).
                repo.getUpcomingTimetableEntries(stop.stop_id, dateTime),
                repo.getRouteTypesForStop(stop.stop_id),
              ]);
              const departures = depsResult.success ? depsResult.data : [];
              // When timetable data is missing for a stop (success=false),
              // default to false. This only happens when the stop has no
              // timetable data at all (not a network error), so false is
              // semantically correct — no boardable entries exist.
              const isBoardableOnServiceDay = depsResult.success
                ? depsResult.meta.isBoardableOnServiceDay
                : false;
              const routeTypes = rtResult.success ? rtResult.data : [3 as const];
              // Resolve stats for the current dateTime's service group
              // instead of using the baked-in stats from enrichStopInsights.
              const stats = repo.resolveStopStats(stop.stop_id, getServiceDay(dateTime));
              return {
                stop,
                routeTypes,
                departures,
                isBoardableOnServiceDay,
                agencies,
                routes,
                distance,
                stats,
                geo,
              };
            }),
          );

    promise
      .then((results) => {
        if (cancelled) {
          return;
        }
        const withDepartures = results.filter((r) => r.departures.length > 0);
        const totalFreq = results.reduce((sum, r) => sum + (r.stats?.freq ?? 0), 0);
        const sd = getServiceDay(dateTime);
        logger.debug(
          `nearby departures: ${withDepartures.length}/${results.length} stops with departures (serviceDay=${formatDateKey(sd)} totalFreq=${totalFreq})`,
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
