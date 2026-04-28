/**
 * Extract StopEntry data from a DataBundle for GlobalInsightsBundle.
 *
 * Provides two functions used by build-global-insights.ts:
 * - findSundayServiceIds: identify services active on at least one Sunday
 * - extractStopEntries: build StopEntry[] with routeIds and routeFreqs
 */

import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';
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

  // stopRouteFreqs: stop time counts filtered to serviceIds (day-dependent).
  // Used for cn (connectivity) where actual service frequency matters.
  for (const [stopId, groups] of Object.entries(bundle.timetable.data)) {
    for (const g of groups) {
      const pattern = patterns[g.tp];
      if (!pattern) {
        continue;
      }

      let freq = 0;
      for (const svcId of serviceIds) {
        const deps = g.d[svcId];
        if (deps) {
          freq += deps.length;
        }
      }

      if (freq > 0) {
        if (!stopRouteFreqs.has(stopId)) {
          stopRouteFreqs.set(stopId, new Map());
        }
        const routeMap = stopRouteFreqs.get(stopId)!;
        routeMap.set(pattern.r, (routeMap.get(pattern.r) ?? 0) + freq);
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
