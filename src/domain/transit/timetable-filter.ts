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
import { isDropOffOnly } from './timetable-utils';

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

/**
 * Filter out timetable entries whose route belongs to a hidden agency.
 *
 * Each entry is classified by `routeDirection.route.agency_id`.
 * Entries whose agency is in `hiddenAgencyIds` are removed.
 *
 * When `hiddenAgencyIds` is empty, the input is returned as-is.
 *
 * @param entries - All entries.
 * @param hiddenAgencyIds - Set of agency IDs to hide.
 * @returns Entries whose route.agency_id is NOT in hiddenAgencyIds.
 */
export function filterByAgency<T extends TimetableEntry>(
  entries: readonly T[],
  hiddenAgencyIds: ReadonlySet<string>,
): T[] {
  if (hiddenAgencyIds.size === 0) {
    return entries as T[];
  }
  return entries.filter((e) => !hiddenAgencyIds.has(e.routeDirection.route.agency_id));
}

/**
 * Filter out timetable entries whose route_type is hidden.
 *
 * Each entry is classified by `routeDirection.route.route_type` (the GTFS
 * route_type category: bus, tram, subway, rail, etc.). Entries whose
 * route_type is in `hiddenRouteTypes` are removed.
 *
 * When `hiddenRouteTypes` is empty, the input is returned as-is.
 *
 * Used by the bottom sheet route-type filter: toggling off a type
 * (e.g. tram) should hide tram stop times even when the stop also
 * serves other types (so the stop itself remains visible as long as
 * at least one stop time of another type stays).
 *
 * @param entries - All entries.
 * @param hiddenRouteTypes - Set of route_type values to hide.
 * @returns Entries whose route.route_type is NOT in hiddenRouteTypes.
 */
export function filterByRouteType<T extends TimetableEntry>(
  entries: readonly T[],
  hiddenRouteTypes: ReadonlySet<number>,
): T[] {
  if (hiddenRouteTypes.size === 0) {
    return entries as T[];
  }
  return entries.filter((e) => !hiddenRouteTypes.has(e.routeDirection.route.route_type));
}

/**
 * Filter out drop-off-only entries, returning only boardable stop times.
 *
 * Each entry's boardability is determined by {@link isDropOffOnly}
 * (pickupType === 1 OR isTerminal).
 */
export function filterBoardable(entries: TimetableEntry[]): TimetableEntry[] {
  return entries.filter((entry) => !isDropOffOnly(entry));
}
