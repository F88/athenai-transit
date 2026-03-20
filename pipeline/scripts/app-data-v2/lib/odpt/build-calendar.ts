/**
 * Build CalendarJson from ODPT StationTimetable data.
 */

import type { CalendarJson } from '../../../../../src/types/data/transit-json';
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

  return { services, exceptions: [] };
}
