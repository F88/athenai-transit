/**
 * ODPT calendar utilities shared by pipeline builders (v1 and v2).
 *
 * Provides calendar-to-serviceId mapping, date range computation,
 * and Japanese holiday exception generation for ODPT train sources.
 */

import holiday_jp from '@holiday-jp/holiday_jp';

import type { CalendarExceptionJson } from '../../../src/types/data/transit-json';

/**
 * Map ODPT calendar to service ID.
 * "odpt.Calendar:Weekday" -> "weekday"
 * "odpt.Calendar:SaturdayHoliday" -> "saturday-holiday"
 *
 * @param calendar - ODPT calendar URI (e.g. "odpt.Calendar:Weekday").
 * @returns Lowercase service ID string.
 */
export function calendarToServiceId(calendar: string): string {
  const calendarName = calendar.split(':')[1];
  if (calendarName === 'SaturdayHoliday') {
    return 'saturday-holiday';
  }
  return calendarName.toLowerCase();
}

/** Number of years to add to `dct:issued` for calendar validity. */
const VALIDITY_YEARS = 2;

/**
 * Compute start/end dates from an ODPT issued date (dct:issued).
 * startDate = issued, endDate = issued + {@link VALIDITY_YEARS} years.
 *
 * ODPT API does not provide an explicit validity period for timetable
 * data. The spec (v4.15 §3.3.6) defines `dct:valid` (optional) as
 * the data validity expiry date, but current sources (e.g. Yurikamome)
 * do not provide it. We use issued + 2 years as a generous fallback:
 *
 * - GTFS sources typically provide calendar_dates covering up to
 *   ~1 year (some shorter, e.g. toei-bus covers only 2 months of
 *   a 3-year feed). Two years is more generous than most GTFS sources.
 * - Some ODPT sources are not updated promptly after ダイヤ改正,
 *   so a longer validity period avoids premature expiry.
 * - When `dct:valid` is available, it should be used as `endDate`
 *   instead of this fallback.
 *
 * @param issuedDate - Issued date in "YYYY-MM-DD" format.
 * @returns Object with `startDate` and `endDate` in "YYYYMMDD" format.
 */
export function computeDateRange(issuedDate: string): { startDate: string; endDate: string } {
  const startDate = issuedDate.replace(/-/g, '');
  const [y, m, d] = issuedDate.split('-').map(Number);
  const end = new Date(y + VALIDITY_YEARS, m - 1, d);
  if (end.getMonth() !== m - 1) {
    end.setDate(0);
  }
  const endY = end.getFullYear();
  const endM = String(end.getMonth() + 1).padStart(2, '0');
  const endD = String(end.getDate()).padStart(2, '0');
  return { startDate, endDate: `${endY}${endM}${endD}` };
}

/**
 * Compute the end date for holiday exception generation.
 *
 * Currently returns the calendar end date as-is to keep holiday
 * exceptions within the calendar service validity period. This avoids
 * a known issue where the WebApp's `getActiveServiceIds()` does not
 * check service [s,e] range for `t:1` (add) exceptions, which would
 * incorrectly re-activate expired services on holidays beyond the
 * calendar end date.
 *
 * This function exists as an extension point: if the WebApp is later
 * updated to enforce [s,e] range on add-exceptions, or if ODPT
 * sources begin providing `dct:valid`, the holiday range can be
 * extended independently of the calendar service period.
 *
 * @param calendarEndDate - Calendar end date in "YYYYMMDD" format.
 * @returns End date for holiday generation in "YYYYMMDD" format.
 */
export function computeHolidayEndDate(calendarEndDate: string): string {
  return calendarEndDate;
}

/**
 * Generate calendar_dates exceptions for Japanese holidays.
 *
 * ODPT API does not provide date-based calendar exceptions.
 * This function fills the gap by generating GTFS-style exceptions
 * so the WebApp can use the same date-based timetable selection
 * logic for both GTFS and ODPT sources.
 *
 * For each Japanese holiday that falls on a weekday within the
 * validity period:
 * - Remove weekday service (exception_type = 2)
 * - Add the appropriate holiday service (exception_type = 1)
 *
 * The holiday service is selected by priority:
 * 1. "holiday" — if the source provides a dedicated holiday calendar
 * 2. "saturday-holiday" — combined Saturday/Holiday calendar
 * 3. (none) — if neither exists, no add-exception is generated
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param calendarTypes - Set of service IDs discovered from timetable data.
 * @param startDate - Validity start date in "YYYYMMDD" format.
 * @param endDate - Validity end date in "YYYYMMDD" format.
 * @returns Array of calendar exception entries.
 */
export function buildHolidayExceptions(
  prefix: string,
  calendarTypes: Set<string>,
  startDate: string,
  endDate: string,
): CalendarExceptionJson[] {
  if (!calendarTypes.has('weekday')) {
    return [];
  }

  // Determine which service to add on holidays
  const holidayServiceId = calendarTypes.has('holiday')
    ? 'holiday'
    : calendarTypes.has('saturday-holiday')
      ? 'saturday-holiday'
      : undefined;

  const start = parseYYYYMMDD(startDate);
  const end = parseYYYYMMDD(endDate);
  const holidays = holiday_jp.between(start, end);

  const exceptions: CalendarExceptionJson[] = [];

  for (const holiday of holidays) {
    const day = holiday.date.getDay();
    // Skip weekends (Saturday=6, Sunday=0) — already on holiday schedule
    if (day === 0 || day === 6) {
      continue;
    }

    const dateStr = formatYYYYMMDD(holiday.date);

    // Remove weekday service on this holiday
    exceptions.push({
      i: `${prefix}:weekday`,
      d: dateStr,
      t: 2,
    });

    // Add holiday service on this holiday
    if (holidayServiceId) {
      exceptions.push({
        i: `${prefix}:${holidayServiceId}`,
        d: dateStr,
        t: 1,
      });
    }
  }

  return exceptions;
}

/** Parse "YYYYMMDD" to Date (local time). */
function parseYYYYMMDD(s: string): Date {
  return new Date(
    parseInt(s.slice(0, 4), 10),
    parseInt(s.slice(4, 6), 10) - 1,
    parseInt(s.slice(6, 8), 10),
  );
}

/** Format Date to "YYYYMMDD". */
function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
