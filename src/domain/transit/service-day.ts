/**
 * GTFS service day boundary logic.
 *
 * In GTFS, a service day extends past midnight (times >= 24:00) to cover
 * overnight trips. The "service day" does not change at 00:00 but at a
 * defined boundary hour (e.g. 03:00), after which the first morning
 * services begin.
 *
 * @example
 * // At 01:30 on March 11, the service day is still March 10.
 * getServiceDay(new Date('2026-03-11T01:30:00')) // → 2026-03-10T00:00:00
 *
 * // At 04:00 on March 11, the service day is March 11.
 * getServiceDay(new Date('2026-03-11T04:00:00')) // → 2026-03-11T00:00:00
 */

/**
 * Hour at which the GTFS service day changes.
 *
 * Before this hour, the current real-world time is considered part of
 * the previous calendar day's service. Toei transit first departures
 * are around 04:30–05:00, so 03:00 provides sufficient margin.
 */
export const SERVICE_DAY_BOUNDARY_HOUR = 3;

/**
 * Determine the GTFS service day for a given real-world time.
 *
 * Before {@link SERVICE_DAY_BOUNDARY_HOUR}, the service day is the
 * previous calendar day. At or after the boundary, it is the current
 * calendar day.
 *
 * @param now - The real-world current time.
 * @returns A Date representing the service day (time set to 00:00:00).
 */
export function getServiceDay(now: Date): Date {
  const result = new Date(now);
  if (result.getHours() < SERVICE_DAY_BOUNDARY_HOUR) {
    result.setDate(result.getDate() - 1);
  }
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Convert the current real-world time to "minutes from midnight" on the
 * service day.
 *
 * Before {@link SERVICE_DAY_BOUNDARY_HOUR}, the result is >= 1440
 * (e.g. 01:30 → 1530 minutes on the previous service day).
 * At or after the boundary, it is the standard hours * 60 + minutes.
 *
 * @param now - The real-world current time.
 * @returns Minutes from midnight of the service day.
 */
export function getServiceDayMinutes(now: Date): number {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < SERVICE_DAY_BOUNDARY_HOUR) {
    return (hours + 24) * 60 + minutes;
  }
  return hours * 60 + minutes;
}
