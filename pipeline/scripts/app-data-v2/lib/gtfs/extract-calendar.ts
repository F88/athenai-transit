/**
 * Extract CalendarJson from GTFS SQLite database (v2).
 *
 * Same structure as v1 — CalendarJson is an unchanged section.
 */

import type Database from 'better-sqlite3';

import type { CalendarJson } from '../../../../../src/types/data/transit-json';

/**
 * Extract calendar services and exceptions from the GTFS database.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @returns CalendarJson with prefixed service IDs.
 */
export function extractCalendarV2(db: Database.Database, prefix: string): CalendarJson {
  const calendar = db
    .prepare(
      `SELECT service_id, monday, tuesday, wednesday, thursday,
              friday, saturday, sunday, start_date, end_date
       FROM calendar
       ORDER BY service_id`,
    )
    .all() as Array<{
    service_id: string;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    start_date: string;
    end_date: string;
  }>;

  const calendarDates = db
    .prepare(
      `SELECT service_id, date, exception_type
       FROM calendar_dates
       ORDER BY service_id, date`,
    )
    .all() as Array<{
    service_id: string;
    date: string;
    exception_type: number;
  }>;

  console.log(`  [${prefix}] ${calendar.length} services, ${calendarDates.length} exceptions`);

  return {
    services: calendar.map((c) => ({
      i: `${prefix}:${c.service_id}`,
      d: [c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday],
      s: c.start_date,
      e: c.end_date,
    })),
    exceptions: calendarDates.map((e) => ({
      i: `${prefix}:${e.service_id}`,
      d: e.date,
      t: e.exception_type,
    })),
  };
}
