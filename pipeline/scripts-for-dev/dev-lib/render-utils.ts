/**
 * Shared rendering helpers for dev-lib analysers.
 *
 * Currently provides a single text-table formatter used by the v2
 * insights / global-insights analysers. Kept separate from
 * `stats-utils.ts` because table rendering is presentation, not
 * statistics — the two responsibilities are evolved independently.
 */

/**
 * Render a fixed-width text table from a header row and body rows.
 *
 * Columns auto-size to the longest cell (header included). Cells in
 * the first `leftAlignCount` columns are left-padded with spaces;
 * remaining columns are right-padded so numeric values line up to
 * the right.
 *
 * Output format:
 * ```text
 * col0      col1   col2
 * --------  -----  -----
 * value0    val1     123
 * value0b   val1b   1234
 * ```
 *
 * Empty body rows produce a header + separator only.
 *
 * @param header - Column header labels.
 * @param body - Each inner array is one row; lengths must match `header`.
 * @param leftAlignCount - How many leading columns to left-align.
 *   Defaults to `1` (just the first column). Pass `2` for tables
 *   whose first two columns are both label-like (e.g. source id +
 *   English name).
 *
 * @example
 * ```ts
 * renderTable(
 *   ['source', 'name', 'count', 'pct'],
 *   [
 *     ['nsrt', 'Nagoya SRT', '7', '0.5'],
 *     ['kobus', 'Keio Bus', '1234', '88.2'],
 *   ],
 *   2,
 * );
 * ```
 */
export function renderTable(
  header: string[],
  body: string[][],
  leftAlignCount: number = 1,
): string {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...body.map((row) => row[i]?.length ?? 0)),
  );
  const pad = (row: string[]): string =>
    row
      .map((cell, i) => (i < leftAlignCount ? cell.padEnd(widths[i]) : cell.padStart(widths[i])))
      .join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [pad(header), sep, ...body.map(pad)].join('\n');
}
