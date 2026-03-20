/**
 * Build CalendarJson from ODPT StationTimetable data.
 *
 * Generates calendar_dates exceptions for Japanese holidays so that
 * the WebApp can select the correct timetable using the same date-based
 * logic as GTFS sources (weekday + calendar_dates).
 */

import holiday_jp from '@holiday-jp/holiday_jp';

import type {
  CalendarExceptionJson,
  CalendarJson,
} from '../../../../../src/types/data/transit-json';
import type { OdptStationTimetable } from '../../../../types/odpt-train';

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

/**
 * Compute start/end dates from an issued date string.
 * end = issued + 1 year.
 *
 * @param issuedDate - Issued date in "YYYY-MM-DD" format.
 * @returns Object with `startDate` and `endDate` in "YYYYMMDD" format.
 */
export function computeDateRange(issuedDate: string): { startDate: string; endDate: string } {
  const startDate = issuedDate.replace(/-/g, '');
  const [y, m, d] = issuedDate.split('-').map(Number);
  const end = new Date(y + 1, m - 1, d);
  if (end.getMonth() !== m - 1) {
    end.setDate(0);
  }
  const endY = end.getFullYear();
  const endM = String(end.getMonth() + 1).padStart(2, '0');
  const endD = String(end.getDate()).padStart(2, '0');
  return { startDate, endDate: `${endY}${endM}${endD}` };
}

/**
 * Build CalendarJson from ODPT timetable data.
 *
 * Discovers unique calendar types from actual data and builds
 * day-of-week flags.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param timetables - ODPT station timetable data.
 * @param issuedDate - Issued date string (YYYY-MM-DD).
 * @returns CalendarJson with services and empty exceptions.
 */
export function buildCalendarV2(
  prefix: string,
  timetables: OdptStationTimetable[],
  issuedDate: string,
): CalendarJson {
  const { startDate, endDate } = computeDateRange(issuedDate);

  const calendarTypes = new Set<string>();
  for (const tt of timetables) {
    calendarTypes.add(calendarToServiceId(tt['odpt:calendar']));
  }

  const DAY_FLAGS: Record<string, number[]> = {
    weekday: [1, 1, 1, 1, 1, 0, 0],
    'saturday-holiday': [0, 0, 0, 0, 0, 1, 1],
    saturday: [0, 0, 0, 0, 0, 1, 0],
    holiday: [0, 0, 0, 0, 0, 0, 1],
  };

  const services = [...calendarTypes].sort().map((serviceId) => ({
    i: `${prefix}:${serviceId}`,
    d: DAY_FLAGS[serviceId] ?? [1, 1, 1, 1, 1, 1, 1],
    s: startDate,
    e: endDate,
  }));

  const exceptions = buildHolidayExceptions(prefix, calendarTypes, startDate, endDate);

  return { services, exceptions };
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
