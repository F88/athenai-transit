/**
 * Repository result types.
 *
 * Provides a unified error-handling contract for all
 * {@link TransitRepository} methods.
 */

import type {
  ContextualTimetableEntry,
  TimetableEntry,
  TripInspectionTarget,
  TripSnapshot,
} from './transit-composed';

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

/** Entries omitted by pre-filter (e.g. drop-off-only entries hidden in simple/normal). */
export interface TimetableOmitted {
  /**
   * Number of non-boardable entries omitted (= entries where
   * `isDropOffOnly` returns true: `pickup_type === 1` or
   * pattern-inferred `isTerminal`).
   */
  nonBoardable: number;
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
   *
   * Use `getStopServiceState(meta)` to derive a `StopServiceState`
   * from these raw signals.
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

/**
 * Result for upcoming timetable queries with service-day context.
 *
 * Like {@link TimetableResult} but carries {@link ContextualTimetableEntry}
 * entries that include `serviceDate` for correct minutes-to-Date conversion.
 * Used exclusively by `getUpcomingTimetableEntries`.
 */
export type UpcomingTimetableResult =
  | {
      success: true;
      data: ContextualTimetableEntry[];
      truncated: boolean;
      meta: TimetableQueryMeta;
    }
  | { success: false; error: string };

/** Result for repository-provided whole-trip reconstruction. */
export type TripSnapshotResult = Result<TripSnapshot>;

/** Programmatic reason for an empty trip-inspection target result. */
export type TripInspectionTargetsEmptyReason = 'no-stop-data' | 'no-service-on-this-day';

/** Non-empty trip-inspection target list. */
type NonEmptyTripInspectionTargets = [TripInspectionTarget, ...TripInspectionTarget[]];

/** Metadata returned alongside trip-inspection targets. */
export interface TripInspectionTargetsMeta {
  /**
   * Present when the query succeeds but yields no candidates.
   *
   * This property remains optional for ergonomic destructuring on the non-empty
   * path, but callers handling `data.length === 0` can rely on it being
   * defined.
   */
  emptyReason?: TripInspectionTargetsEmptyReason;
}

/**
 * Metadata for an empty trip-inspection target result.
 *
 * `emptyReason` is required here, unlike in
 * {@link TripInspectionTargetsMeta}, because the empty success branch of
 * {@link TripInspectionTargetsResult} guarantees a programmatic reason for the
 * absence of candidates. Used only when `data: []`.
 */
export interface EmptyTripInspectionTargetsMeta extends TripInspectionTargetsMeta {
  emptyReason: TripInspectionTargetsEmptyReason;
}

/**
 * Result for stop-level trip-inspection target queries.
 *
 * Empty results are reported as success, not failure. When no candidates exist
 * for the queried stop / service day, the repository returns
 * `{ success: true, data: [], truncated: false, meta: { emptyReason } }`.
 * Callers are expected to use {@link TripInspectionTargetsMeta.emptyReason} to
 * distinguish normal empty outcomes such as "no stop data" and
 * "no service on this day".
 *
 * **Invariant**: when `data.length === 0`, `meta.emptyReason` is always
 * defined. The optional marker on {@link TripInspectionTargetsMeta.emptyReason}
 * is only for ergonomic destructuring on the non-empty path.
 *
 * `{ success: false, error }` is reserved for repository-level failures such
 * as internal lookup or data integrity errors, not for normal "no matches"
 * outcomes.
 *
 * @example
 * ```ts
 * if (result.success) {
 *   if (result.data.length === 0) {
 *     handleEmpty(result.meta.emptyReason);
 *   } else {
 *     handleNonEmpty(result.data);
 *   }
 * }
 * ```
 */
export type TripInspectionTargetsResult =
  | {
      success: true;
      data: [];
      /** Always `false`: this API returns the full candidate set. */
      truncated: false;
      meta: EmptyTripInspectionTargetsMeta;
    }
  | {
      success: true;
      data: NonEmptyTripInspectionTargets;
      /** Always `false`: this API returns the full candidate set. */
      truncated: false;
      meta: TripInspectionTargetsMeta;
    }
  | { success: false; error: string };
