/**
 * Build tripPatternStats section of InsightsBundle.
 *
 * Computes per-pattern operational statistics segmented by service group:
 * - `freq`: total departures per day for this service group
 * - `rd`: remaining minutes from each stop to the terminal (median-based)
 *
 * ### Duplicate stop_id handling (Issue #47)
 *
 * For 6-shape and circular routes where the same stop_id appears at multiple
 * positions in a pattern, each position has its own TimetableGroupV2Json
 * identified by `si` (0-based index in pattern.stops). All freq/rd
 * computations select groups by `(patternId, si)` to avoid double-counting
 * departures from different positions.
 *
 * ### Stops without timetable entries
 *
 * Some stops in a pattern may have no corresponding timetable entry
 * (e.g. GTFS stops with NULL departure_time). For `rd`, these gaps
 * are filled using nearest-neighbor averaging/copying from adjacent
 * known segments, not via proportional linear interpolation.
 */

import type {
  ServiceGroupEntry,
  TimetableGroupV2Json,
  TripPatternJson,
  TripPatternStatsJson,
} from '../../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Count departures for a pattern at a given stop position,
 * summing across all service IDs in the service group.
 *
 * Filters by `(patternId, si)` to select the correct group when the same
 * stop_id appears at multiple positions in the pattern (Issue #47).
 */
function countDepartures(
  timetableGroups: TimetableGroupV2Json[] | undefined,
  patternId: string,
  si: number,
  serviceIds: string[],
): number {
  if (!timetableGroups) {
    return 0;
  }

  let count = 0;
  for (const group of timetableGroups) {
    if (group.tp !== patternId || group.si !== si) {
      continue;
    }
    for (const svcId of serviceIds) {
      const deps = group.d[svcId];
      if (deps) {
        count += deps.length;
      }
    }
  }
  return count;
}

/**
 * Get departure times for a pattern at a specific stop position,
 * concatenated across all service IDs in the service group.
 * Returns a sorted array of departure minutes.
 *
 * Filters by `(patternId, si)` to select the correct group when the same
 * stop_id appears at multiple positions in the pattern (Issue #47).
 */
function getDepartures(
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

  // Cache departures per (stopId, si) to avoid redundant timetable scans and sorts.
  // Each stop appears in two consecutive segments (as end of one, start of next),
  // so caching halves the number of getDepartures calls.
  // Cache key includes si because the same stop_id may have different deps
  // at different pattern positions (Issue #47, e.g. 6-shape routes).
  const depsCache = new Map<string, number[]>();
  function getCachedDeps(stopId: string, si: number): number[] {
    const cacheKey = `${stopId}:${si}`;
    let cached = depsCache.get(cacheKey);
    if (cached === undefined) {
      cached = getDepartures(timetable[stopId], patternId, si, serviceIds);
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
 * @param patterns - Trip patterns keyed by pattern ID.
 * @param timetable - Timetable data keyed by stop ID.
 * @param serviceGroups - Service group definitions.
 * @returns Nested map: service group key → pattern ID → stats.
 */
export function buildTripPatternStats(
  patterns: Record<string, TripPatternJson>,
  timetable: Record<string, TimetableGroupV2Json[]>,
  serviceGroups: ServiceGroupEntry[],
): Record<string, Record<string, TripPatternStatsJson>> {
  const result: Record<string, Record<string, TripPatternStatsJson>> = {};

  for (const group of serviceGroups) {
    const groupStats: Record<string, TripPatternStatsJson> = {};

    for (const [patternId, pattern] of Object.entries(patterns)) {
      const { stops } = pattern;

      if (stops.length === 0) {
        continue;
      }

      // freq: count departures from origin (si=0). With Issue #47's si-based
      // grouping, the origin's group contains exactly the trip count, so no
      // circular workaround is needed (previously we used interior stop[1]
      // to dodge the 2x merged count).
      const freq = countDepartures(timetable[stops[0].id], patternId, 0, group.serviceIds);

      // Omit patterns with no departures in this service group.
      // Consistent with stopStats, which also excludes freq=0 entries.
      if (freq === 0) {
        continue;
      }

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
