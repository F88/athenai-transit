/**
 * Lifecycle status of a data source's operating-date span relative to a
 * reference date ("today").
 *
 * - `inPeriod` — the reference date falls within the known bound(s).
 * - `expired` — the reference date is after the latest operating date.
 * - `beforePeriod` — the reference date is before the earliest operating date.
 * - `indeterminate` — no operating-date data to evaluate against.
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
 * Returns `indeterminate` when there is nothing to evaluate: the input is
 * `null`, both bounds are `null`, or `referenceDateKey` is empty. A
 * single known bound is still evaluated (e.g. only `last` known yields
 * `expired` once the reference date passes it, otherwise `inPeriod`).
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
  if (first === null && last === null) {
    return 'indeterminate';
  }
  if (last !== null && referenceDateKey > last) {
    return 'expired';
  }
  if (first !== null && referenceDateKey < first) {
    return 'beforePeriod';
  }
  return 'inPeriod';
}
