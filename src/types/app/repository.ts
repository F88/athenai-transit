/**
 * Repository result types.
 *
 * Provides a unified error-handling contract for all
 * {@link TransitRepository} methods.
 */

import type { TimetableEntry } from './transit-composed';

/**
 * Result for single-value queries.
 *
 * - `success: true` — the operation completed and `data` contains the value.
 * - `success: false` — a domain-level error occurred (e.g. unknown ID).
 *   `error` contains a human-readable description.
 */
export type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Result for collection queries with truncation support.
 *
 * - `success: true` — `data` contains the matching items.
 *   `truncated` indicates whether additional matches existed
 *   but were omitted due to `limit` or the API-level cap.
 * - `success: false` — a domain-level error occurred.
 */
export type CollectionResult<T> =
  | { success: true; data: T[]; truncated: boolean }
  | { success: false; error: string };

/** Entries omitted by pre-filter (e.g. terminal arrivals hidden in simple/normal). */
export interface TimetableOmitted {
  /** Number of terminal arrival entries omitted. */
  terminal: number;
}

/**
 * Metadata computed during timetable scan over the full service day.
 *
 * These values are derived from ALL entries before now/limit filtering,
 * so they reflect the stop's characteristics for the entire service day
 * rather than just the returned `data` subset.
 */
export interface TimetableQueryMeta {
  /**
   * Whether at least one boardable entry exists in the full service day.
   *
   * Computed from ALL entries before now/limit filtering — independent of
   * what `data` contains. A stop with `isBoardableOnServiceDay === false`
   * and `totalEntries > 0` is a drop-off-only stop.
   *
   * Boardable = not terminal AND pickupType !== 1 (pickupType 2/3 are
   * considered boardable as they require phone/coordination but allow boarding).
   */
  isBoardableOnServiceDay: boolean;

  /**
   * Total number of entries for the full service day (before now/limit filtering).
   *
   * For `getFullDayTimetableEntries`: always equals `data.length`.
   * For `getUpcomingTimetableEntries`: typically differs from `data.length`
   * (e.g. totalEntries=552, data.length=3 when most services have passed).
   *
   * - `totalEntries > 0 && data.length === 0` → service has ended for the day.
   * - `totalEntries === 0` → no service today.
   */
  totalEntries: number;
}

/**
 * Result for timetable queries with service-day metadata.
 *
 * Extends the standard collection result with {@link TimetableQueryMeta}
 * to provide full-day context alongside the (possibly filtered) entry data.
 */
export type TimetableResult =
  | { success: true; data: TimetableEntry[]; truncated: boolean; meta: TimetableQueryMeta }
  | { success: false; error: string };
