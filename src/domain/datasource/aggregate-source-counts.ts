import type { DataSourceInfo } from './data-source-info';

/**
 * Sum the `maxTripsPerDay` of every {@link DataSourceInfo} that
 * actually has a known catalog total.
 *
 * Per-source `maxTripsPerDay` already represents the busiest single
 * service day; summing it across a group's prefixes treats the
 * group's worst-case daily load as the union of those peaks
 * (an over-estimate when peaks fall on different days, an exact
 * value when they coincide).
 *
 * Returns `null` when **none** of the inputs has a known value
 * (every entry has `maxTripsPerDay === null`). Callers should treat
 * this as "no displayable activity figure" and hide the field.
 */
export function aggregateMaxTripsPerDay(infos: readonly DataSourceInfo[]): number | null {
  let sum = 0;
  let found = false;
  for (const info of infos) {
    if (info.maxTripsPerDay === null) {
      continue;
    }
    found = true;
    sum += info.maxTripsPerDay;
  }
  return found ? sum : null;
}

/**
 * Sum the `boardingStopsCount` of every {@link DataSourceInfo} that
 * has a known catalog count.
 *
 * Each catalog entry already filters to `location_type === 0`
 * (physical boarding stops); the sum gives the group's total
 * boarding-stop count under the same definition.
 *
 * Returns `null` when **none** of the inputs has a known value.
 * Callers should treat this as "no displayable stop count" and
 * hide the field.
 */
export function aggregateBoardingStopsCount(infos: readonly DataSourceInfo[]): number | null {
  let sum = 0;
  let found = false;
  for (const info of infos) {
    if (info.boardingStopsCount === null) {
      continue;
    }
    found = true;
    sum += info.boardingStopsCount;
  }
  return found ? sum : null;
}
