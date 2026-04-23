/**
 * @module calendar-utils
 *
 * Pure utility functions for GTFS calendar operations.
 *
 * Shared between v1 (AthenaiRepository) and v2 (AthenaiRepositoryV2).
 * All functions are stateless and side-effect free.
 */

import type { CalendarExceptionJson, CalendarServiceJson } from '../../types/data/transit-json';

/**
 * Find the index of the first element >= target in a sorted number array.
 *
 * Used for efficient departure time lookup in sorted timetable arrays.
 *
 * @param sorted - Array sorted in ascending order.
 * @param target - Value to search for.
 * @returns Index of the first element >= target, or sorted.length if none.
 */
export function binarySearchFirstGte(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Format a Date as "YYYYMMDD" string for GTFS calendar comparison.
 *
 * @param serviceDate - Date to format.
 * @returns 8-digit date string (e.g. "20260324").
 */
export function formatDateKey(serviceDate: Date): string {
  const y = serviceDate.getFullYear();
  const m = String(serviceDate.getMonth() + 1).padStart(2, '0');
  const d = String(serviceDate.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Get the GTFS day-of-week index from a Date.
 *
 * GTFS calendar uses 0=Monday .. 6=Sunday, whereas JavaScript's
 * Date.getDay() returns 0=Sunday .. 6=Saturday.
 *
 * @param serviceDate - Date to convert.
 * @returns GTFS day index (0=Mon, 1=Tue, ..., 6=Sun).
 */
export function getDayIndex(serviceDate: Date): number {
  const jsDay = serviceDate.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Convert minutes-from-midnight to a Date on the same day as baseDate.
 *
 * Handles overnight times: minutes >= 1440 produce next-day dates,
 * which is correct for GTFS overnight departures (e.g. 25:30 = 1:30 AM
 * the next calendar day).
 *
 * @param baseDate - Reference date for the service day.
 * @param minutes - Minutes from midnight (may exceed 1440 for overnight).
 * @returns Date with hours/minutes set accordingly.
 */
export function minutesToDate(baseDate: Date, minutes: number): Date {
  const result = new Date(baseDate);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

/**
 * Compute the set of active GTFS service IDs for a given service date.
 *
 * Evaluates calendar services (date range + day-of-week) and applies
 * calendar_dates exceptions (type 1 = add, type 2 = remove).
 *
 * This is a pure function — callers are responsible for caching the
 * result if repeated calls with the same date are expected.
 *
 * @param serviceDate - The GTFS service day.
 * @param calendarServices - Calendar service definitions.
 * @param calendarExceptions - Calendar exception entries, keyed by service ID.
 * @returns Set of active service IDs.
 */
export function computeActiveServiceIds(
  serviceDate: Date,
  calendarServices: CalendarServiceJson[],
  calendarExceptions: Map<string, CalendarExceptionJson[]>,
): Set<string> {
  const key = formatDateKey(serviceDate);
  const dayIndex = getDayIndex(serviceDate);
  const active = new Set<string>();

  // Check calendar: date range + day-of-week
  for (const svc of calendarServices) {
    if (key >= svc.s && key <= svc.e && svc.d[dayIndex] === 1) {
      active.add(svc.i);
    }
  }

  // Apply calendar_dates exceptions
  for (const [serviceId, exceptions] of calendarExceptions) {
    for (const ex of exceptions) {
      if (ex.d !== key) {
        continue;
      }
      if (ex.t === 1) {
        active.add(serviceId); // Added
      } else if (ex.t === 2) {
        active.delete(serviceId); // Removed
      }
    }
  }

  return active;
}
