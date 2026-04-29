import type { TripStopTime } from '@/types/app/transit-composed';

/**
 * Pure helpers for accessing entries inside a {@link TripStopTime} array.
 *
 * Per `TripSnapshot.stopTimes` contract, the array is sorted by
 * `timetableEntry.patternPosition.stopIndex` but may be **sparse**:
 * when the repository cannot resolve a pattern entry against the
 * requested `(serviceId, tripIndex)` it drops that row, so neither
 * `stopTimes.length` nor `stopTimes[i].stopIndex === i` can be relied
 * on by callers.
 *
 * These helpers centralize the "sparse-safe" lookup that consumers
 * would otherwise have to reinvent (and easily get wrong, e.g. by
 * using `stopTimes[0]` for origin or `stopTimes[length-1]` for
 * terminal — both of which silently return the wrong entry when the
 * actual origin / terminal is missing).
 *
 * Each helper is a pure function over the array; the lookup `Map`
 * builder is exposed for callers that need repeated lookups (e.g.
 * dense-list rendering) and want to avoid re-scanning the array.
 */

/**
 * Total number of stops in the pattern this trip belongs to.
 *
 * Reads from any reconstructed entry's `patternPosition.totalStops`
 * (the value is identical across entries for a given pattern).
 * Returns `0` when {@link stopTimes} is empty.
 */
export function getPatternTotalStops(stopTimes: readonly TripStopTime[]): number {
  return stopTimes[0]?.timetableEntry.patternPosition.totalStops ?? 0;
}

/**
 * Build a sparse-safe lookup keyed by `patternPosition.stopIndex`.
 *
 * Use this when the caller needs repeated lookups (e.g. when
 * iterating `0..totalStops-1` to render a dense list of stops with
 * placeholders for missing ones). For one-off origin / terminal
 * lookups prefer {@link getOriginStop} / {@link getTerminalStop}.
 *
 * Per Issue #47 (6-shape / circular routes), the same physical
 * `stop_id` can appear at multiple positions in one pattern, but
 * each position has its own `stopIndex`, so the index is unique
 * within a pattern and safe to use as a `Map` key.
 */
export function buildStopByPatternIndex(
  stopTimes: readonly TripStopTime[],
): Map<number, TripStopTime> {
  return new Map(stopTimes.map((stop) => [stop.timetableEntry.patternPosition.stopIndex, stop]));
}

/**
 * Stop reconstructed at the given pattern index, or `undefined`
 * when no entry exists for that position.
 */
export function getStopAtPatternIndex(
  stopTimes: readonly TripStopTime[],
  stopIndex: number,
): TripStopTime | undefined {
  return stopTimes.find((s) => s.timetableEntry.patternPosition.stopIndex === stopIndex);
}

/**
 * Pattern origin (`stopIndex === 0` / `isOrigin === true`).
 *
 * Returns `undefined` when the origin row was not reconstructed,
 * which is semantically correct: callers should not paper over a
 * missing origin by silently substituting the first available
 * downstream stop.
 */
export function getOriginStop(stopTimes: readonly TripStopTime[]): TripStopTime | undefined {
  return stopTimes.find((s) => s.timetableEntry.patternPosition.isOrigin);
}

/**
 * Pattern terminal (`stopIndex === totalStops - 1` /
 * `isTerminal === true`).
 *
 * Returns `undefined` when the terminal row was not reconstructed,
 * which is semantically correct: callers should not paper over a
 * missing terminal by silently substituting the last available
 * upstream stop (e.g. yurikamome short-turn trips that stop one
 * station before the pattern's terminal).
 */
export function getTerminalStop(stopTimes: readonly TripStopTime[]): TripStopTime | undefined {
  return stopTimes.find((s) => s.timetableEntry.patternPosition.isTerminal);
}
