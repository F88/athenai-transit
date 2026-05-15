/**
 * Shared calendar-walking utilities for v2 pipeline builders.
 *
 * GTFS `calendar.txt` plus `calendar_dates.txt` together define which
 * `service_id` values are active on each calendar date. Several v2
 * builders need to walk dates and aggregate per-day metrics from active
 * services — for example computing `maxTripsPerDay` for the catalog or
 * `freq` for `tripPatternStats` / `stopStats`.
 *
 * These primitives are intentionally calendar-agnostic: callers receive
 * the raw active `service_id` set for each date and apply whatever
 * aggregation logic they need.
 */

import type {
  CalendarExceptionJson,
  CalendarJson,
  CalendarServiceJson,
} from '@contracts/data/transit-json';

import { parseGtfsDate } from '../../gtfs-date-utils';

/**
 * Group calendar_dates exceptions by `service_id` for fast lookup.
 */
export function buildExceptionMap(
  exceptions: CalendarExceptionJson[],
): Map<string, CalendarExceptionJson[]> {
  const map = new Map<string, CalendarExceptionJson[]>();
  for (const exception of exceptions) {
    const list = map.get(exception.i) ?? [];
    list.push(exception);
    map.set(exception.i, list);
  }
  return map;
}

/**
 * Format a `Date` to a GTFS date key (YYYYMMDD, zero-padded, UTC).
 */
export function formatGtfsDateKey(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Map a `Date` to a Monday-first day index suitable for GTFS
 * `CalendarServiceJson.d` (`[mon, tue, wed, thu, fri, sat, sun]`).
 */
export function getMondayFirstDayIndex(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

/**
 * Add `deltaDays` to a UTC date and return a new `Date`.
 */
export function addUtcDays(date: Date, deltaDays: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
}

/**
 * Compute the minimum and maximum dates referenced by a calendar.
 *
 * Considers `calendar.services` start/end and `calendar_dates.exceptions`
 * dates. Returns `null` when neither contains any parseable date.
 */
export function getCalendarDateRange(
  services: CalendarServiceJson[],
  exceptions: CalendarExceptionJson[],
): { min: Date; max: Date } | null {
  const parsedDates: Date[] = [];

  for (const service of services) {
    const start = parseGtfsDate(service.s);
    const end = parseGtfsDate(service.e);
    if (start) {
      parsedDates.push(start);
    }
    if (end) {
      parsedDates.push(end);
    }
  }

  for (const exception of exceptions) {
    const date = parseGtfsDate(exception.d);
    if (date) {
      parsedDates.push(date);
    }
  }

  if (parsedDates.length === 0) {
    return null;
  }

  let min = parsedDates[0];
  let max = parsedDates[0];
  for (const date of parsedDates) {
    if (date < min) {
      min = date;
    }
    if (date > max) {
      max = date;
    }
  }

  return { min, max };
}

/**
 * Compute the set of `service_id` values active on a given UTC date.
 *
 * Combines `calendar.services` weekly patterns and `calendar_dates`
 * exceptions (`t=1` adds, `t=2` removes) following GTFS semantics.
 */
export function computeActiveServiceIds(
  date: Date,
  services: CalendarServiceJson[],
  exceptionsByServiceId: Map<string, CalendarExceptionJson[]>,
): Set<string> {
  const key = formatGtfsDateKey(date);
  const dayIndex = getMondayFirstDayIndex(date);
  const active = new Set<string>();

  for (const service of services) {
    if (key >= service.s && key <= service.e && service.d[dayIndex] === 1) {
      active.add(service.i);
    }
  }

  for (const [serviceId, exceptions] of exceptionsByServiceId) {
    for (const exception of exceptions) {
      if (exception.d !== key) {
        continue;
      }
      if (exception.t === 1) {
        active.add(serviceId);
      } else if (exception.t === 2) {
        active.delete(serviceId);
      }
    }
  }

  return active;
}

/**
 * Walk every UTC date in a calendar's range and invoke `callback` once
 * per date with the set of active `service_id` values for that date.
 *
 * Returns early without invoking `callback` when the calendar has no
 * parseable dates.
 */
export function walkCalendarDates(
  calendar: CalendarJson,
  callback: (date: Date, activeServiceIds: Set<string>) => void,
): void {
  const { services, exceptions } = calendar;
  const dateRange = getCalendarDateRange(services, exceptions);
  if (!dateRange) {
    return;
  }

  const exceptionsByServiceId = buildExceptionMap(exceptions);
  for (let date = dateRange.min; date <= dateRange.max; date = addUtcDays(date, 1)) {
    const activeServiceIds = computeActiveServiceIds(date, services, exceptionsByServiceId);
    callback(date, activeServiceIds);
  }
}
