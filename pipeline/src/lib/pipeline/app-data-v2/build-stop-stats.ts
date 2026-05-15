/**
 * Build stopStats section of InsightsBundle.
 *
 * Computes per-stop operational statistics segmented by service group:
 * - `freq`: maximum stop-time count on any single calendar date for this
 *   service group (Issue #219 — see {@link buildStopStats} for the precise
 *   definition).
 * - `rc`: number of distinct routes that have any stop time at this stop
 *   in this service group (calendar-agnostic across the group).
 * - `rtc`: number of distinct route types (calendar-agnostic across the
 *   group).
 * - `ed`: earliest departure time (minutes from midnight) observed across
 *   all services in this group (calendar-agnostic).
 * - `ld`: latest departure time (minutes from midnight, >= 1440 for
 *   overnight) observed across all services in this group
 *   (calendar-agnostic).
 */

import type { CalendarJson } from '@contracts/data/transit-json';
import type {
  RouteV2Json,
  ServiceGroupEntry,
  StopStatsJson,
  TimetableGroupV2Json,
  TripPatternJson,
} from '@contracts/data/transit-v2-json';

import {
  addUtcDays,
  buildExceptionMap,
  computeActiveServiceIds,
  getCalendarDateRange,
} from './calendar-walk';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build per-stop operational statistics segmented by service group.
 *
 * `freq` is computed by walking every UTC date in the calendar's range:
 * for each date the active `service_id` set is intersected with the
 * service group's members, the per-stop stop-time count contributed by
 * those active-in-group services is summed across every timetable group
 * referencing this stop, and `freq` is the maximum of these per-day
 * counts across all dates (Issue #219). This avoids overcounting when
 * the service group bundles services that operate on disjoint dates.
 *
 * `rc`, `rtc`, `ed`, and `ld` are calendar-agnostic across the service
 * group — they describe what is ever observed at this stop with any
 * service in the group, regardless of which actual calendar date that
 * service is active.
 *
 * @param timetable - Timetable data keyed by stop ID.
 * @param patterns - Trip patterns keyed by pattern ID.
 * @param routes - Route records (used for route_type lookup).
 * @param serviceGroups - Service group definitions.
 * @param calendar - Calendar data (services + exceptions) used to walk
 *   actual operating dates per service group.
 * @returns Nested map: service group key → stop ID → stats.
 */
export function buildStopStats(
  timetable: Record<string, TimetableGroupV2Json[]>,
  patterns: Record<string, TripPatternJson>,
  routes: RouteV2Json[],
  serviceGroups: ServiceGroupEntry[],
  calendar: CalendarJson,
): Record<string, Record<string, StopStatsJson>> {
  // Build route lookup: route_id → route_type
  const routeTypeMap = new Map<string, number>();
  for (const route of routes) {
    routeTypeMap.set(route.i, route.t);
  }

  // Precompute active service IDs per date once across all groups.
  const dateRange = getCalendarDateRange(calendar.services, calendar.exceptions);
  const exceptionsByServiceId = buildExceptionMap(calendar.exceptions);
  const activesByDate: Set<string>[] = [];
  if (dateRange) {
    for (let date = dateRange.min; date <= dateRange.max; date = addUtcDays(date, 1)) {
      activesByDate.push(computeActiveServiceIds(date, calendar.services, exceptionsByServiceId));
    }
  }

  const result: Record<string, Record<string, StopStatsJson>> = {};

  for (const group of serviceGroups) {
    const groupStats: Record<string, StopStatsJson> = {};
    for (const [stopId, groups] of Object.entries(timetable)) {
      // Aggregate per-service stop-time counts at this stop, restricted to
      // services that are in the current service group. Also collect the
      // calendar-agnostic facts (rc, rtc, ed, ld).
      const stopTimesByService = new Map<string, number>();
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

        for (const serviceId of group.serviceIds) {
          const deps = tg.d[serviceId];
          if (!deps || deps.length === 0) {
            continue;
          }

          hasAnyStopTime = true;
          stopTimesByService.set(serviceId, (stopTimesByService.get(serviceId) ?? 0) + deps.length);

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

      if (stopTimesByService.size === 0) {
        continue;
      }

      // Compute freq as the per-day maximum. `stopTimesByService` was
      // populated exclusively from services in `group.serviceIds`
      // (loop above), so we only need to gate by per-date active status.
      let maxFreq = 0;
      for (const active of activesByDate) {
        let dayCount = 0;
        for (const [serviceId, count] of stopTimesByService) {
          if (active.has(serviceId)) {
            dayCount += count;
          }
        }
        if (dayCount > maxFreq) {
          maxFreq = dayCount;
        }
      }

      if (maxFreq === 0) {
        continue;
      }

      groupStats[stopId] = {
        freq: maxFreq,
        rc: routeIds.size,
        rtc: routeTypes.size,
        ed,
        ld,
      };
    }

    result[group.key] = groupStats;
  }

  return result;
}
