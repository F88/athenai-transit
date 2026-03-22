/**
 * Build tripPatternStats section of InsightsBundle.
 *
 * Computes per-pattern operational statistics segmented by service group:
 * - `freq`: total departures per day for this service group
 * - `rd`: remaining minutes from each stop to the terminal (median-based)
 *
 * ### Circular route handling
 *
 * For circular routes (`stops[0] === stops[last]`), the origin/terminal stop
 * has 2x the departures of interior stops because it appears at both
 * position 0 and the last position. To get accurate freq counts, we use
 * an interior stop (position 1) as the reference for departure counting.
 *
 * For `rd` computation, segment travel times between consecutive interior
 * stops use positional alignment. The origin segment (position 0→1)
 * uses the interior stop count as the reference for alignment.
 *
 * ### Stops without timetable entries
 *
 * Some stops in a pattern may have no corresponding timetable entry
 * (e.g. GTFS stops with NULL departure_time). For `rd`, these gaps
 * are filled by linear interpolation from neighboring segments.
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
 * Count departures for a pattern at a specific stop position,
 * summing across all service IDs in the service group.
 */
function countDepartures(
  timetableGroups: TimetableGroupV2Json[] | undefined,
  patternId: string,
  serviceIds: string[],
): number {
  if (!timetableGroups) {
    return 0;
  }

  let count = 0;
  for (const group of timetableGroups) {
    if (group.tp !== patternId) {
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
 * Get departure times for a pattern at a specific stop,
 * concatenated across all service IDs in the service group.
 * Returns a sorted array of departure minutes.
 */
function getDepartures(
  timetableGroups: TimetableGroupV2Json[] | undefined,
  patternId: string,
  serviceIds: string[],
): number[] {
  if (!timetableGroups) {
    return [];
  }

  const deps: number[] = [];
  for (const group of timetableGroups) {
    if (group.tp !== patternId) {
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

  const isCircular = stops.length > 2 && stops[0] === stops[stops.length - 1];

  // Cache departures per stop to avoid redundant timetable scans and sorts.
  // Each stop appears in two consecutive segments (as end of one, start of next),
  // so caching halves the number of getDepartures calls.
  const depsCache = new Map<string, number[]>();
  function getCachedDeps(stopId: string): number[] {
    let cached = depsCache.get(stopId);
    if (cached === undefined) {
      cached = getDepartures(timetable[stopId], patternId, serviceIds);
      depsCache.set(stopId, cached);
    }
    return cached;
  }

  for (let i = 0; i < segmentCount; i++) {
    // For circular routes, skip segments involving the origin/terminal stop
    // (positions 0 and last). The origin/terminal has 2x departures
    // (starting trips + returning trips) interleaved when sorted, making
    // positional alignment unreliable. These segments are filled by
    // interpolation below.
    if (isCircular && (i === 0 || i === segmentCount - 1)) {
      continue;
    }

    const depsA = getCachedDeps(stops[i]);
    const depsB = getCachedDeps(stops[i + 1]);

    if (depsA.length === 0 || depsB.length === 0) {
      continue;
    }

    if (depsA.length !== depsB.length) {
      continue;
    }

    const diffs: number[] = [];
    for (let j = 0; j < depsA.length; j++) {
      const diff = depsB[j] - depsA[j];
      if (diff >= 0) {
        diffs.push(diff);
      }
    }

    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      segments[i] = median(diffs);
    }
  }

  // Fill gaps (NO_DATA) by linear interpolation from neighbors.
  // Only NO_DATA (-1) entries are filled — segments with value 0
  // (zero travel time) are valid and preserved.
  for (let i = 0; i < segmentCount; i++) {
    if (segments[i] !== NO_DATA) {
      continue;
    }
    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (segments[j] !== NO_DATA) {
        prevIdx = j;
        break;
      }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < segmentCount; j++) {
      if (segments[j] !== NO_DATA) {
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
      // are skipped). Use 0 rather than preserving NO_DATA (-1), because
      // the caller accumulates segments into rd via addition — a -1 would
      // produce negative rd values. 0 is the safest fallback: it means
      // "unknown duration treated as instant" rather than corrupting rd.
      // In practice this only occurs in degenerate patterns (3-stop circular).
      segments[i] = 0;
    }
  }

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

      // freq: use interior stop (position 1) for circular routes to avoid 2x
      const isCircular = stops.length > 2 && stops[0] === stops[stops.length - 1];
      const freqStopId = isCircular && stops.length > 2 ? stops[1] : stops[0];
      const freq = countDepartures(timetable[freqStopId], patternId, group.serviceIds);

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
