/**
 * Repository result types.
 *
 * Provides a unified error-handling contract for all
 * {@link TransitRepository} methods.
 */

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
