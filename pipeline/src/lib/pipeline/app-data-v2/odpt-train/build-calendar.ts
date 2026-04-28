/**
 * Build CalendarJson from ODPT StationTimetable data.
 *
 * Generates calendar_dates exceptions for Japanese holidays so that
 * the WebApp can select the correct timetable using the same date-based
 * logic as GTFS sources (weekday + calendar_dates).
 */

import type { CalendarJson } from '../../../../../../src/types/data/transit-json';
import type { OdptStationTimetable } from '../../../../types/odpt-train';
import {
  buildHolidayExceptions,
  calendarToServiceId,
  computeDateRange,
  computeHolidayEndDate,
} from '../../../odpt-calendar-utils';

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

  // Holiday exceptions are generated for the same validity period as
  // the calendar services. See computeHolidayEndDate for details.
  const holidayEndDate = computeHolidayEndDate(endDate);
  const exceptions = buildHolidayExceptions(prefix, calendarTypes, startDate, holidayEndDate);

  return { services, exceptions };
}
