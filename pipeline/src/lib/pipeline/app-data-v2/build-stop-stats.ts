/**
 * Build stopStats section of InsightsBundle.
 *
 * Computes per-stop operational statistics segmented by service group:
 * - `freq`: total stop times per day across all patterns serving this stop
 * - `rc`: number of distinct routes
 * - `rtc`: number of distinct route types (bus, subway, tram, etc.)
 * - `ed`: earliest departure time (minutes from midnight)
 * - `ld`: latest departure time (minutes from midnight, >= 1440 for overnight)
 */

import type {
  RouteV2Json,
  ServiceGroupEntry,
  StopStatsJson,
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build per-stop operational statistics segmented by service group.
 *
 * @param timetable - Timetable data keyed by stop ID.
 * @param patterns - Trip patterns keyed by pattern ID.
 * @param routes - Route records (used for route_type lookup).
 * @param serviceGroups - Service group definitions.
 * @returns Nested map: service group key → stop ID → stats.
 */
export function buildStopStats(
  timetable: Record<string, TimetableGroupV2Json[]>,
  patterns: Record<string, TripPatternJson>,
  routes: RouteV2Json[],
  serviceGroups: ServiceGroupEntry[],
): Record<string, Record<string, StopStatsJson>> {
  // Build route lookup: route_id → route_type
  const routeTypeMap = new Map<string, number>();
  for (const route of routes) {
    routeTypeMap.set(route.i, route.t);
  }

  const result: Record<string, Record<string, StopStatsJson>> = {};

  for (const group of serviceGroups) {
    const groupStats: Record<string, StopStatsJson> = {};

    for (const [stopId, groups] of Object.entries(timetable)) {
      let freq = 0;
      const routeIds = new Set<string>();
      const routeTypes = new Set<number>();
      let ed = Infinity;
      let ld = -Infinity;

      for (const tg of groups) {
        const pattern = patterns[tg.tp];
        if (!pattern) {
          continue;
        }

        let hasAnyStopTime = false;

        for (const svcId of group.serviceIds) {
          const deps = tg.d[svcId];
          if (!deps || deps.length === 0) {
            continue;
          }

          hasAnyStopTime = true;
          freq += deps.length;

          // deps are sorted ascending
          if (deps[0] < ed) {
            ed = deps[0];
          }
          if (deps[deps.length - 1] > ld) {
            ld = deps[deps.length - 1];
          }
        }

        if (hasAnyStopTime) {
          routeIds.add(pattern.r);
          const rt = routeTypeMap.get(pattern.r);
          if (rt !== undefined) {
            routeTypes.add(rt);
          }
        }
      }

      // Only include stops that have at least one stop time in this group
      if (freq > 0) {
        groupStats[stopId] = {
          freq,
          rc: routeIds.size,
          rtc: routeTypes.size,
          ed,
          ld,
        };
      }
    }

    result[group.key] = groupStats;
  }

  return result;
}
