import { useEffect, useRef, useState } from 'react';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import type { TransitRepository } from '../repositories/transit-repository';
import { getServiceDay } from '../domain/transit/service-day';
import { getStopServiceState } from '../domain/transit/timetable-utils';
import { formatDateKey } from '../domain/transit/calendar-utils';
import { createLogger } from '../lib/logger';

const logger = createLogger('NearbyStopTimes');

/**
 * Identify which dependency changes triggered the effect run, for
 * the debug log. Returns a `+`-joined token list so a single fire
 * caused by multiple simultaneous changes (rare, e.g. bounds change
 * and time tick landing in the same React batch) is still legible.
 *
 * Returns `strict-mode-rerun` when none of the tracked deps changed
 * — that branch is hit by React StrictMode's `setup → cleanup →
 * setup` double invocation in development. The first setup updates
 * the prev-value refs to current; the second setup observes equal
 * references and detects no real change.
 */
function describeTrigger(
  isFirstRun: boolean,
  dateTimeChanged: boolean,
  radiusStopsChanged: boolean,
  repoChanged: boolean,
): string {
  if (isFirstRun) {
    return 'initial';
  }
  const parts: string[] = [];
  if (repoChanged) {
    parts.push('repo');
  }
  if (radiusStopsChanged) {
    parts.push('radiusStops');
  }
  if (dateTimeChanged) {
    parts.push('dateTime');
  }
  return parts.length > 0 ? parts.join('+') : 'strict-mode-rerun';
}

/**
 * Return type for the useNearbyStopTimes hook.
 */
export interface UseNearbyStopTimesReturn {
  /** Stop time contexts for all nearby stops. */
  stopTimes: StopWithContext[];
  /** Whether stop times are currently being fetched. */
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
 * @param dateTime - The reference date/time for stop time lookup.
 * @param repo - Transit data repository.
 * @returns Stop time data and loading state.
 */
export function useNearbyStopTimes(
  radiusStops: StopWithMeta[],
  dateTime: Date,
  repo: TransitRepository,
): UseNearbyStopTimesReturn {
  const [nearbyStopTimes, setNearbyStopTimes] = useState<StopWithContext[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);

  // Refs that snapshot the previous dependency values so we can identify
  // which one triggered the effect. Used purely for diagnostics (the
  // debug log below); the effect itself still re-runs on any dep change.
  const isFirstRunRef = useRef(true);
  const prevRadiusStopsRef = useRef(radiusStops);
  const prevDateTimeRef = useRef(dateTime);
  const prevRepoRef = useRef(repo);

  useEffect(() => {
    const isFirstRun = isFirstRunRef.current;
    const radiusStopsChanged = prevRadiusStopsRef.current !== radiusStops;
    const dateTimeChanged = prevDateTimeRef.current !== dateTime;
    const repoChanged = prevRepoRef.current !== repo;
    const trigger = describeTrigger(isFirstRun, dateTimeChanged, radiusStopsChanged, repoChanged);
    isFirstRunRef.current = false;
    prevRadiusStopsRef.current = radiusStops;
    prevDateTimeRef.current = dateTime;
    prevRepoRef.current = repo;

    // Log the trigger synchronously at effect start. The companion
    // `stop times: ...` log fires only after the fetch promise resolves
    // and would be skipped when StrictMode's cleanup cancels the run,
    // which would silently hide the very first invocation
    // (`trigger=initial`) from the trace.
    //
    // Wrapped in `isEnabled('debug')` so the template literal allocation
    // is skipped when debug logging is off — this hook re-runs on every
    // 15 s tick, so the cumulative cost of evaluating the message in
    // production would otherwise add up.
    // if (logger.isEnabled('debug')) {
    //   logger.debug(`effect run (trigger=${trigger}, stops=${String(radiusStops.length)})`);
    // }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading must be set synchronously when deps change
    setIsNearbyLoading(true);

    // Hoist service day computation to avoid per-stop recalculation.
    const sd = getServiceDay(dateTime);

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
              const stopTimes = depsResult.success ? depsResult.data : [];
              // When timetable data is missing for a stop (success=false),
              // default to false / no-service. This only happens when the
              // stop has no timetable data at all (not a network error),
              // so these defaults are semantically correct — no boardable
              // entries and no service.
              const stopServiceState = depsResult.success
                ? getStopServiceState(depsResult.meta)
                : ('no-service' as const);
              const routeTypes = rtResult.success ? rtResult.data : [-1 as const];
              // Resolve stats for the current dateTime's service group
              // instead of using the baked-in stats from enrichStopInsights.
              const stats = repo.resolveStopStats(stop.stop_id, sd);
              return {
                stop,
                routeTypes,
                stopTimes,
                stopServiceState,
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
        // Compute the log-only aggregates inside the gate so neither
        // `filter` nor `reduce` runs when debug logging is disabled.
        // Both pass over `results` (= radiusStops, typically 10–50
        // entries) every 15 s tick, so skipping them in production
        // pays off cumulatively.
        if (logger.isEnabled('debug')) {
          const withStopTimes = results.filter((r) => r.stopTimes.length > 0);
          const totalFreq = results.reduce((sum, r) => sum + (r.stats?.freq ?? 0), 0);
          logger.debug(
            `stop times: ${withStopTimes.length}/${results.length} stops with stop times (serviceDay=${formatDateKey(sd)} totalFreq=${totalFreq} trigger=${trigger})`,
          );
        }
        setNearbyStopTimes(results);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        logger.error('Failed to fetch stop times:', error);
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

  return { stopTimes: nearbyStopTimes, isNearbyLoading };
}
