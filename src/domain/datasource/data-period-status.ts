/**
 * Lifecycle status of a data source's operating-date span relative to a
 * reference date ("today").
 *
 * - `inPeriod` — the reference date falls within the operating range.
 * - `expired` — the reference date is after the latest operating date.
 * - `beforePeriod` — the reference date is before the earliest operating date.
 * - `indeterminate` — operating dates are missing or incomplete (either bound
 *   absent), or there is no reference date.
 */
export type DataPeriodStatus = 'inPeriod' | 'expired' | 'beforePeriod' | 'indeterminate';

/**
 * Classify a data source's operating-date span against a reference date.
 *
 * `operatingDates` carries the earliest (`first`) and latest (`last`)
 * service dates derived from the catalog (trip-backed min/max), each as a
 * `YYYYMMDD` key or `null` when that bound is unknown. `referenceDateKey`
 * is the effective "today" as a `YYYYMMDD` key (see `formatDateKey`),
 * which honours the app's `?time=` override.
 *
 * Both bounds are inclusive: a reference date equal to `first` or `last`
 * is still `inPeriod`. Because `YYYYMMDD` keys are fixed-width, a plain
 * string comparison orders them chronologically, so no date parsing is
 * needed.
 *
 * Both bounds are required: returns `indeterminate` when the input is `null`,
 * either bound is `null`, or `referenceDateKey` is empty. The catalog always
 * emits operating dates as a first/last pair (a one-sided range cannot
 * occur), and deciding `inPeriod` (after the start and before the end) needs
 * both ends, so a single known bound is treated as `indeterminate` rather
 * than guessed.
 *
 * @param operatingDates - Earliest / latest operating dates, or `null`.
 * @param referenceDateKey - Effective "today" as a `YYYYMMDD` key.
 * @returns The period status relative to the reference date.
 */
export function getDataPeriodStatus(
  operatingDates: { first: string | null; last: string | null } | null,
  referenceDateKey: string,
): DataPeriodStatus {
  if (operatingDates === null || referenceDateKey === '') {
    return 'indeterminate';
  }
  const { first, last } = operatingDates;
  if (first === null || last === null) {
    return 'indeterminate';
  }
  if (referenceDateKey > last) {
    return 'expired';
  }
  if (referenceDateKey < first) {
    return 'beforePeriod';
  }
  return 'inPeriod';
}
