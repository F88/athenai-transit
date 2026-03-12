/**
 * Repository result types and constants.
 *
 * Provides a unified error-handling contract for all
 * {@link TransitRepository} methods.
 */

/**
 * Maximum number of stops that any single query can return.
 *
 * This is an API-level cap. Even if the underlying dataset contains
 * more matching stops, implementations MUST NOT return more than
 * this number. When results are truncated to this limit, the
 * {@link CollectionResult.truncated} flag MUST be set to `true`.
 */
export const MAX_STOPS_RESULT = 5000;

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
 *   but were omitted due to `limit` or {@link MAX_STOPS_RESULT}.
 * - `success: false` — a domain-level error occurred.
 */
export type CollectionResult<T> =
  | { success: true; data: T[]; truncated: boolean }
  | { success: false; error: string };
