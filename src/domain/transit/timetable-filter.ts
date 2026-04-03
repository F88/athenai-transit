/**
 * @module timetable-filter
 *
 * Pure functions for filtering {@link TimetableEntry} arrays and
 * computing omitted entry statistics.
 *
 * Used by timetable modal handlers to prepare display data with
 * accurate per-scope omitted counts.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';
import type { TimetableOmitted } from '../../types/app/repository';
import { getEffectiveHeadsign } from './get-effective-headsign';

/**
 * Filter and compute omitted stats for a stop timetable.
 *
 * When `includeTerminals` is false (simple/normal), terminal entries are
 * removed and their count is reported in `omitted.terminal`.
 *
 * @param allEntries - All entries from getFullDayTimetableEntries (unfiltered).
 * @param includeTerminals - true at detailed+, false at simple/normal.
 * @returns Filtered entries and omitted terminal count.
 */
export function prepareStopTimetable(
  allEntries: TimetableEntry[],
  includeTerminals: boolean,
): { entries: TimetableEntry[]; omitted: TimetableOmitted } {
  if (includeTerminals) {
    return { entries: allEntries, omitted: { terminal: 0 } };
  }
  const entries = allEntries.filter((e) => !e.patternPosition.isTerminal);
  return { entries, omitted: { terminal: allEntries.length - entries.length } };
}

/**
 * Filter and compute omitted stats for a route+headsign timetable.
 *
 * Unlike {@link prepareStopTimetable}, this first narrows to a specific
 * route+headsign, then applies terminal filtering. The resulting
 * `omitted.terminal` is scoped to that route+headsign — it does not
 * include terminal counts from other routes at the same stop.
 *
 * @param allEntries - All entries from getFullDayTimetableEntries (unfiltered).
 * @param routeId - Target route ID.
 * @param headsign - Target headsign.
 * @param includeTerminals - true at detailed+, false at simple/normal.
 * @returns Filtered entries and omitted terminal count for this route+headsign.
 */
export function prepareRouteHeadsignTimetable(
  allEntries: TimetableEntry[],
  routeId: string,
  headsign: string,
  includeTerminals: boolean,
): { entries: TimetableEntry[]; omitted: TimetableOmitted } {
  const routeEntries = allEntries.filter(
    (e) =>
      e.routeDirection.route.route_id === routeId &&
      getEffectiveHeadsign(e.routeDirection) === headsign,
  );
  if (includeTerminals) {
    return { entries: routeEntries, omitted: { terminal: 0 } };
  }
  const entries = routeEntries.filter((e) => !e.patternPosition.isTerminal);
  return { entries, omitted: { terminal: routeEntries.length - entries.length } };
}
