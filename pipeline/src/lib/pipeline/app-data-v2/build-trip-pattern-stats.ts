/**
 * Build tripPatternStats section of InsightsBundle.
 *
 * Computes per-pattern operational statistics segmented by service group:
 * - `freq`: maximum number of trips on any single calendar date for this
 *   service group (counted at origin si=0). See {@link buildTripPatternStats}
 *   for the precise definition.
 * - `rd`: remaining minutes from each stop to the terminal (median-based)
 *
 * ### `freq` definition (Issue #219)
 *
 * `freq` is the maximum, over all dates within the calendar's range,
 * of the per-day trip count contributed by services that are both
 * (a) members of this service group and (b) active on that date per the
 * GTFS `calendar` / `calendar_dates` semantics. This avoids overcounting
 * when distinct services bucketed into the same group operate on
 * disjoint actual dates (e.g. calendar_dates-only services that the
 * service-group builder merges via conservative inclusion).
 *
 * ### Duplicate stop_id handling (Issue #47)
 *
 * For 6-shape and circular routes where the same stop_id appears at multiple
 * positions in a pattern, each position has its own TimetableGroupV2Json
 * identified by `si` (0-based index in pattern.stops). All freq/rd
 * computations select groups by `(patternId, si)` to avoid double-counting
 * stop times from different positions.
 *
 * ### Stops without timetable entries
 *
 * Some stops in a pattern may have no corresponding timetable entry
 * (e.g. GTFS stops with NULL departure_time). For `rd`, these gaps
 * are filled using nearest-neighbor averaging/copying from adjacent
 * known segments, not via proportional linear interpolation.
 */

import type { CalendarJson } from '@contracts/data/transit-json';
import type {
  ServiceGroupEntry,
  TimetableGroupV2Json,
  TripPatternJson,
  TripPatternStatsJson,
} from '@contracts/data/transit-v2-json';

import {
  addUtcDays,
  buildExceptionMap,
  computeActiveServiceIds,
  getCalendarDateRange,
} from './calendar-walk';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Count origin-position trips per `service_id` for one pattern.
 *
 * Returns a map of `service_id -> trip count at origin (si=0)` for the
 * given `patternId`. Only `service_id` values with at least one trip are
 * included.
 *
 * The trip count for each service equals `d[serviceId].length` summed
 * across timetable groups that match `(patternId, si=0)`. Multiple
 * groups can match when the source emits separate origin entries for
 * the same pattern (e.g. duplicate stop_id at origin in 6-shape routes,
 * Issue #47); the values are summed across all such groups.
 */
function countTripsByServiceAtOrigin(
  timetableGroups: TimetableGroupV2Json[] | undefined,
  patternId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!timetableGroups) {
    return counts;
  }

  for (const group of timetableGroups) {
    if (group.tp !== patternId || group.si !== 0) {
      continue;
    }
    for (const [serviceId, deps] of Object.entries(group.d)) {
      if (deps.length === 0) {
        continue;
      }
      counts.set(serviceId, (counts.get(serviceId) ?? 0) + deps.length);
    }
  }
  return counts;
}

/**
 * Get departure times (`d` field) for a pattern at a specific stop position,
 * concatenated across all service IDs in the service group.
 * Returns a sorted array of departure minutes from midnight.
 *
 * Filters by `(patternId, si)` to select the correct group when the same
 * stop_id appears at multiple positions in the pattern (Issue #47).
 */
function getDepartureTimes(
  timetableGroups: TimetableGroupV2Json[] | undefined,
  patternId: string,
  si: number,
  serviceIds: string[],
): number[] {
  if (!timetableGroups) {
    return [];
  }

  const deps: number[] = [];
  for (const group of timetableGroups) {
    if (group.tp !== patternId || group.si !== si) {
      continue;
    }
    for (const svcId of serviceIds) {
      const d = group.d[svcId];
      if (d) {
        deps.push(...d);
      }
    }
  }
  return deps.sort((a, b) => a - b);
}

/**
 * Compute median of a sorted numeric array.
 * Returns 0 for empty arrays.
 */
function median(sorted: number[]): number {
  if (sorted.length === 0) {
    return 0;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Fill NO_DATA gaps in a segment array using nearest known neighbors.
 *
 * This function uses **simple neighbor averaging**, not proportional
 * linear interpolation. The rationale:
 *
 * - Adjacent bus/train segments between consecutive stops tend to have
 *   similar durations (1–3 min each). A gradient assumption (linear
 *   interpolation) is not more accurate than averaging for typical
 *   transit data.
 * - Across all 16 current sources, only 6 stops in a single pattern
 *   (Toei Asakusa Line toaran:p15) require gap filling. Consecutive
 *   gaps are at most 2 segments long, making the difference between
 *   averaging and interpolation negligible.
 *
 * **Important**: `0` is a valid segment value (zero travel time between
 * consecutive stops departing at the same minute). Only entries matching
 * `noData` are treated as gaps. See the NO_DATA sentinel in
 * {@link computeSegmentTimes} for details.
 *
 * When no valid neighbors exist at all (e.g. 3-stop circular where
 * every segment is skipped), gaps are set to `0` as a safe fallback.
 * The caller accumulates segments into `rd` via addition, so preserving
 * a negative sentinel would corrupt the output.
 *
 * @param segments - Mutable array of segment travel times. Modified in place.
 * @param noData - Sentinel value indicating missing data (typically -1).
 */
function fillSegmentGaps(segments: number[], noData: number): void {
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] !== noData) {
      continue;
    }
    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (segments[j] !== noData) {
        prevIdx = j;
        break;
      }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < segments.length; j++) {
      if (segments[j] !== noData) {
        nextIdx = j;
        break;
      }
    }

    if (prevIdx >= 0 && nextIdx >= 0) {
      segments[i] = (segments[prevIdx] + segments[nextIdx]) / 2;
    } else if (prevIdx >= 0) {
      segments[i] = segments[prevIdx];
    } else if (nextIdx >= 0) {
      segments[i] = segments[nextIdx];
    } else {
      // No valid neighbors exist (e.g. 3-stop circular where all segments
      // are skipped). Use 0 rather than preserving noData, because the
      // caller accumulates segments into rd via addition — a negative
      // sentinel would produce negative rd values.
      segments[i] = 0;
    }
  }
}

/**
 * Compute the median travel time for a single segment (stop A → stop B)
 * by positional alignment of departure arrays.
 *
 * Pairs up departures at the same index `j` and computes
 * `depsB[j] - depsA[j]`. Negative diffs are filtered out (can occur
 * with data anomalies). The median of the remaining diffs is returned.
 *
 * Returns `noData` if:
 * - Either departure array is empty
 * - The arrays have different lengths (alignment impossible)
 * - All diffs are negative
 *
 * @param depsA - Sorted departure minutes at stop A.
 * @param depsB - Sorted departure minutes at stop B.
 * @param noData - Sentinel value to return when no valid data exists.
 * @returns Median travel time in minutes, or `noData`.
 */
function computeSegmentMedian(depsA: number[], depsB: number[], noData: number): number {
  if (depsA.length === 0 || depsB.length === 0) {
    return noData;
  }
  if (depsA.length !== depsB.length) {
    return noData;
  }

  const diffs: number[] = [];
  for (let j = 0; j < depsA.length; j++) {
    const diff = depsB[j] - depsA[j];
    if (diff >= 0) {
      diffs.push(diff);
    }
  }

  if (diffs.length === 0) {
    return noData;
  }

  diffs.sort((a, b) => a - b);
  return median(diffs);
}

/**
 * Compute segment travel times between consecutive stops using
 * positional alignment of departure arrays.
 *
 * For each segment (i → i+1), pairs up departures at position j
 * and computes `dep[i+1][j] - dep[i][j]` for each pair, then
 * takes the median.
 *
 * Returns an array of length `stops.length - 1` where `segments[i]`
 * is the median travel time in minutes from stop i to stop i+1.
 * Uses -1 (NO_DATA) for missing data; 0 is a valid zero-minute segment.
 */
function computeSegmentTimes(
  pattern: TripPatternJson,
  timetable: Record<string, TimetableGroupV2Json[]>,
  serviceIds: string[],
  patternId: string,
): number[] {
  const { stops } = pattern;
  const segmentCount = stops.length - 1;
  // -1 = no data (timetable missing or alignment failed).
  // 0 = valid segment with zero travel time (e.g. consecutive stops
  // departing at the same minute: 初台坂上 23:20 → 東京オペラシティ南 23:20).
  // Gap interpolation only fills -1 entries, not 0.
  const NO_DATA = -1;
  const segments = new Array<number>(segmentCount).fill(NO_DATA);

  // Cache departure times per (stopId, si) to avoid redundant timetable scans and sorts.
  // Each stop appears in two consecutive segments (as end of one, start of next),
  // so caching halves the number of getDepartureTimes calls.
  // Cache key includes si because the same stop_id may have different deps
  // at different pattern positions (Issue #47, e.g. 6-shape routes).
  const depsCache = new Map<string, number[]>();
  function getCachedDeps(stopId: string, si: number): number[] {
    const cacheKey = `${stopId}:${si}`;
    let cached = depsCache.get(cacheKey);
    if (cached === undefined) {
      cached = getDepartureTimes(timetable[stopId], patternId, si, serviceIds);
      depsCache.set(cacheKey, cached);
    }
    return cached;
  }

  for (let i = 0; i < segmentCount; i++) {
    // No special-case for circular routes: si separates duplicate stops,
    // so positional alignment is now reliable for every segment.
    const result = computeSegmentMedian(
      getCachedDeps(stops[i].id, i),
      getCachedDeps(stops[i + 1].id, i + 1),
      NO_DATA,
    );
    if (result !== NO_DATA) {
      segments[i] = result;
    }
  }

  fillSegmentGaps(segments, NO_DATA);

  return segments;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build per-pattern operational statistics segmented by service group.
 *
 * `freq` is computed by walking every UTC date in the calendar's range:
 * for each date the active `service_id` set is intersected with the
 * service group's members, and the per-pattern trip count contributed
 * by those active-in-group services is computed at the origin. `freq`
 * is the maximum of those per-day values across all dates. This avoids
 * the overcount described in Issue #219, where the previous "sum across
 * all services in group" implementation overstated `freq` whenever the
 * grouped services ran on disjoint actual dates.
 *
 * `rd` (segment travel times) is calendar-agnostic and still uses
 * departure-time medians across all services in the group.
 *
 * @param patterns - Trip patterns keyed by pattern ID.
 * @param timetable - Timetable data keyed by stop ID.
 * @param serviceGroups - Service group definitions.
 * @param calendar - Calendar data (services + exceptions) used to walk
 *   actual operating dates per service group.
 * @returns Nested map: service group key → pattern ID → stats.
 */
export function buildTripPatternStats(
  patterns: Record<string, TripPatternJson>,
  timetable: Record<string, TimetableGroupV2Json[]>,
  serviceGroups: ServiceGroupEntry[],
  calendar: CalendarJson,
): Record<string, Record<string, TripPatternStatsJson>> {
  const result: Record<string, Record<string, TripPatternStatsJson>> = {};

  // Precompute active service IDs per date once. Empty when the calendar
  // has no parseable dates — in that case every group's max freq stays 0
  // and the resulting groupStats are empty (no patterns emitted).
  const dateRange = getCalendarDateRange(calendar.services, calendar.exceptions);
  const exceptionsByServiceId = buildExceptionMap(calendar.exceptions);
  const activesByDate: Set<string>[] = [];
  if (dateRange) {
    for (let date = dateRange.min; date <= dateRange.max; date = addUtcDays(date, 1)) {
      activesByDate.push(computeActiveServiceIds(date, calendar.services, exceptionsByServiceId));
    }
  }

  // Precompute per-pattern (service -> origin trip count) map, used by
  // every service group. Patterns with no origin trips are skipped.
  const tripsByPatternAndService = new Map<string, Map<string, number>>();
  for (const [patternId, pattern] of Object.entries(patterns)) {
    if (pattern.stops.length === 0) {
      continue;
    }
    const perService = countTripsByServiceAtOrigin(timetable[pattern.stops[0].id], patternId);
    if (perService.size > 0) {
      tripsByPatternAndService.set(patternId, perService);
    }
  }

  for (const group of serviceGroups) {
    const groupStats: Record<string, TripPatternStatsJson> = {};
    const groupServiceIds = new Set(group.serviceIds);

    // For each pattern compute the max per-day trip count across all
    // calendar dates, considering only services that are both in this
    // group and active on the date being walked.
    const maxFreqByPattern = new Map<string, number>();
    for (const [patternId, perService] of tripsByPatternAndService) {
      // Trim per-service trip counts to services that belong to this group.
      // Patterns with no in-group services contribute freq=0 for this group.
      const inGroupCounts: { serviceId: string; count: number }[] = [];
      for (const [serviceId, count] of perService) {
        if (groupServiceIds.has(serviceId)) {
          inGroupCounts.push({ serviceId, count });
        }
      }
      if (inGroupCounts.length === 0) {
        continue;
      }

      let maxFreq = 0;
      for (const active of activesByDate) {
        let dayTrips = 0;
        for (const { serviceId, count } of inGroupCounts) {
          if (active.has(serviceId)) {
            dayTrips += count;
          }
        }
        if (dayTrips > maxFreq) {
          maxFreq = dayTrips;
        }
      }
      if (maxFreq > 0) {
        maxFreqByPattern.set(patternId, maxFreq);
      }
    }

    for (const [patternId, pattern] of Object.entries(patterns)) {
      const freq = maxFreqByPattern.get(patternId);
      if (freq === undefined) {
        continue;
      }

      const { stops } = pattern;

      // rd: compute remaining minutes from each stop to terminal
      if (stops.length === 1) {
        groupStats[patternId] = { freq, rd: [0] };
        continue;
      }

      const segmentTimes = computeSegmentTimes(pattern, timetable, group.serviceIds, patternId);

      // Accumulate from terminal backwards
      const rd = new Array<number>(stops.length).fill(0);
      for (let i = stops.length - 2; i >= 0; i--) {
        rd[i] = rd[i + 1] + segmentTimes[i];
      }

      // Round to 1 decimal place
      for (let i = 0; i < rd.length; i++) {
        rd[i] = Math.round(rd[i] * 10) / 10;
      }

      groupStats[patternId] = { freq, rd };
    }

    result[group.key] = groupStats;
  }

  return result;
}
