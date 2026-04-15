/**
 * Shared statistical helpers for dev-lib analysers.
 *
 * Used by `v2-insights-analysis.ts` / `v2-global-insights-analysis.ts`
 * (and any future analyser that needs simple summary statistics over a
 * pre-collected numeric array).
 *
 * All helpers operate on **pre-sorted ascending arrays**. Sorting is the
 * caller's responsibility so a single sort can be reused across multiple
 * percentile / median queries on the same input.
 *
 * Empty-array inputs return `0` rather than `NaN` so analyser output
 * stays numeric without forcing every call site to handle the empty
 * case explicitly. Call sites that need to distinguish "no data" from
 * "data but median = 0" must check `array.length` before calling.
 */

/**
 * Median of a pre-sorted ascending numeric array.
 *
 * Uses the standard mathematical definition:
 * - odd-length: the single middle element
 * - even-length: average of the two middle elements
 *
 * Returns `0` for an empty array.
 *
 * @example
 * ```ts
 * sortedMedian([1, 2, 3]);      // 2
 * sortedMedian([1, 2, 3, 4]);   // 2.5
 * sortedMedian([10, 20, 30, 40]); // 25
 * sortedMedian([]);             // 0
 * ```
 */
export function sortedMedian(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Nearest-rank percentile of a pre-sorted ascending numeric array.
 *
 * Implements the standard nearest-rank method (NIST / ISO definition):
 * `rank = ceil(q * n)` (1-indexed), then convert to 0-indexed via
 * `index = rank - 1`. Clamps the index to `[0, n - 1]` so:
 * - `q = 0` returns the minimum
 * - `q = 1` returns the maximum
 *
 * Returns `0` for an empty array.
 *
 * @param sorted - Pre-sorted ascending numeric values.
 * @param q - Quantile in `[0, 1]` (e.g. `0.5` for median, `0.9` for p90).
 *
 * @example
 * ```ts
 * sortedPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9); // 9 (90th value)
 * sortedPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5); // 5
 * sortedPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0);   // 1
 * sortedPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1);   // 10
 * sortedPercentile([], 0.9);                              // 0
 * ```
 */
export function sortedPercentile(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const rank = Math.ceil(q * n);
  const index = Math.min(n - 1, Math.max(0, rank - 1));
  return sorted[index];
}
