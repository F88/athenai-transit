/**
 * Extract StopEntry data from a DataBundle for GlobalInsightsBundle.
 *
 * Provides two functions used by build-global-insights.ts:
 * - findSundayServiceIds: identify Sunday-pattern services
 * - extractStopEntries: build StopEntry[] with routeIds and routeFreqs
 */

import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';
import type { StopEntry } from './build-stop-geo';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find service IDs that cover Sunday (d[6] === 1) from a DataBundle's calendar.
 *
 * Uses the weekly calendar pattern only; calendar_dates holiday
 * exceptions are not considered.
 */
export function findSundayServiceIds(bundle: DataBundle): Set<string> {
  const ids = new Set<string>();
  for (const svc of bundle.calendar.data.services) {
    if (svc.d[6] === 1) {
      ids.add(svc.i);
    }
  }
  return ids;
}

/**
 * Extract StopEntry[] from a DataBundle for a given set of service IDs.
 *
 * - `routeIds`: ALL routes structurally serving each stop (day-agnostic).
 *   Used for nr (network topology).
 * - `routeFreqs`: departure counts filtered to serviceIds (day-dependent).
 *   Used for cn (connectivity).
 *
 * @param bundle - Source DataBundle.
 * @param serviceIds - Service IDs to count departures for (e.g. Sunday services).
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
    for (const sid of pattern.stops) {
      if (!stopRouteIds.has(sid)) {
        stopRouteIds.set(sid, new Set());
      }
      stopRouteIds.get(sid)!.add(pattern.r);
    }
  }

  // stopRouteFreqs: departure counts filtered to serviceIds (day-dependent).
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
