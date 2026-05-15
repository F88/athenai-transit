/**
 * Extract StopEntry data from a DataBundle for GlobalInsightsBundle.
 *
 * Provides two functions used by build-global-insights.ts:
 * - findSundayServiceIds: identify services active on at least one Sunday
 * - extractStopEntries: build StopEntry[] with routeIds and routeFreqs
 *
 * ### `routeFreqs` definition (Issue #220)
 *
 * `routeFreqs` reports the maximum, over the calendar's date range, of
 * the per-day stop-time count contributed by services that are both
 * (a) members of the input `serviceIds` set and (b) active on that date
 * per the GTFS `calendar` / `calendar_dates` semantics. This avoids the
 * overcount where services with disjoint actual dates would otherwise
 * be summed as if they all ran simultaneously — see Issue #219 for the
 * same pattern in `tripPatternStats` / `stopStats`.
 */

import type { DataBundle } from '@contracts/data/transit-v2-json';
import {
  addUtcDays,
  buildExceptionMap,
  computeActiveServiceIds,
  getCalendarDateRange,
} from './calendar-walk';
import { findServicesActiveOnWeekday } from './build-service-groups';
import type { StopEntry } from './build-stop-geo';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find service IDs that are active on at least one Sunday in the bundle's
 * calendar range.
 *
 * Weekly calendar bits and calendar_dates exceptions are both considered.
 */
export function findSundayServiceIds(bundle: DataBundle): Set<string> {
  return findServicesActiveOnWeekday(bundle.calendar.data, 6);
}

/**
 * Extract StopEntry[] from a DataBundle for a given set of service IDs.
 *
 * - `routeIds`: ALL routes structurally serving each stop (day-agnostic).
 *   Used for nr (network topology).
 * - `routeFreqs`: stop time counts filtered to serviceIds (day-dependent).
 *   Used for cn (connectivity).
 *
 * @param bundle - Source DataBundle.
 * @param serviceIds - Service IDs to count stop times for (e.g. Sunday services).
 * @returns StopEntry[] for all stops in the bundle.
 */
export function extractStopEntries(bundle: DataBundle, serviceIds: Set<string>): StopEntry[] {
  const patterns = bundle.tripPatterns.data;
  const entries: StopEntry[] = [];

  // stopRouteIds: ALL routes structurally serving each stop (day-agnostic).
  // Used for nr (network topology). Not filtered by serviceIds because nr
  // measures "does a different route exist nearby?" regardless of day type.
  const stopRouteFreqs = new Map<string, Map<string, number>>();
  const stopRouteIds = new Map<string, Set<string>>();

  for (const [, pattern] of Object.entries(patterns)) {
    for (const stop of pattern.stops) {
      if (!stopRouteIds.has(stop.id)) {
        stopRouteIds.set(stop.id, new Set());
      }
      stopRouteIds.get(stop.id)!.add(pattern.r);
    }
  }

  // stopRouteFreqs: per-day max stop-time count per (stop, route) filtered
  // to services in `serviceIds`. We walk every UTC date in the calendar
  // range and, for each date, sum the stop-time count contributions from
  // services that are both in `serviceIds` AND active on that date. The
  // final value per (stop, route) is the maximum across all dates. This
  // avoids the overcount that would arise from summing stop times across
  // services with disjoint date footprints (see Issue #220).

  // First, precompute per-(stop, route, service) stop-time counts. Each
  // (stop, route) accumulates across all timetable groups for that stop
  // and patterns that map to that route.
  type RouteServiceCounts = Map<string, Map<string, number>>; // route -> service -> count
  const stopRouteServiceCounts = new Map<string, RouteServiceCounts>();
  for (const [stopId, groups] of Object.entries(bundle.timetable.data)) {
    for (const g of groups) {
      const pattern = patterns[g.tp];
      if (!pattern) {
        continue;
      }
      for (const svcId of serviceIds) {
        const deps = g.d[svcId];
        if (!deps || deps.length === 0) {
          continue;
        }
        let routeMap = stopRouteServiceCounts.get(stopId);
        if (!routeMap) {
          routeMap = new Map();
          stopRouteServiceCounts.set(stopId, routeMap);
        }
        let serviceMap = routeMap.get(pattern.r);
        if (!serviceMap) {
          serviceMap = new Map();
          routeMap.set(pattern.r, serviceMap);
        }
        serviceMap.set(svcId, (serviceMap.get(svcId) ?? 0) + deps.length);
      }
    }
  }

  // Then walk the calendar and pick the per-(stop, route) max-day count.
  const dateRange = getCalendarDateRange(bundle.calendar.data.services, bundle.calendar.data.exceptions);
  if (dateRange) {
    const exceptionsByServiceId = buildExceptionMap(bundle.calendar.data.exceptions);
    for (let date = dateRange.min; date <= dateRange.max; date = addUtcDays(date, 1)) {
      const activeAll = computeActiveServiceIds(date, bundle.calendar.data.services, exceptionsByServiceId);
      // Intersect once with the input serviceIds — no point counting
      // services that aren't in the requested set.
      const activeInSet: string[] = [];
      for (const sid of serviceIds) {
        if (activeAll.has(sid)) {
          activeInSet.push(sid);
        }
      }
      if (activeInSet.length === 0) {
        continue;
      }
      for (const [stopId, routeMap] of stopRouteServiceCounts) {
        for (const [routeId, serviceMap] of routeMap) {
          let dayCount = 0;
          for (const sid of activeInSet) {
            dayCount += serviceMap.get(sid) ?? 0;
          }
          if (dayCount === 0) {
            continue;
          }
          let outerRouteMap = stopRouteFreqs.get(stopId);
          if (!outerRouteMap) {
            outerRouteMap = new Map();
            stopRouteFreqs.set(stopId, outerRouteMap);
          }
          const prev = outerRouteMap.get(routeId) ?? 0;
          if (dayCount > prev) {
            outerRouteMap.set(routeId, dayCount);
          }
        }
      }
    }
  }

  // Build StopEntry for each stop
  for (const stop of bundle.stops.data) {
    entries.push({
      id: stop.i,
      lat: stop.a,
      lon: stop.o,
      routeIds: stopRouteIds.get(stop.i) ?? new Set<string>(),
      routeFreqs: stopRouteFreqs.get(stop.i) ?? new Map<string, number>(),
      parentStation: stop.ps,
      locationType: stop.l,
    });
  }

  return entries;
}
