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
 * When `includeNonBoardable` is false (simple/normal), non-boardable
 * entries (= terminal arrivals and `pickup_type === 1` mid-route stops,
 * see {@link isDropOffOnly}) are removed and their count is reported in
 * `omitted.nonBoardable`.
 *
 * @param allEntries - All entries from getFullDayTimetableEntries (unfiltered).
 * @param includeNonBoardable - true at detailed+, false at simple/normal.
 * @returns Filtered entries and omitted non-boardable count.
 */
export function prepareStopTimetable(
  allEntries: TimetableEntry[],
  includeNonBoardable: boolean,
): { entries: TimetableEntry[]; omitted: TimetableOmitted } {
  if (includeNonBoardable) {
    return { entries: allEntries, omitted: { nonBoardable: 0 } };
  }
  const entries = filterBoardable(allEntries);
  return { entries, omitted: { nonBoardable: allEntries.length - entries.length } };
}

/**
 * Filter and compute omitted stats for a route+headsign timetable.
 *
 * Unlike {@link prepareStopTimetable}, this first narrows to a specific
 * route+headsign, then applies the boardability filter. The resulting
 * `omitted.nonBoardable` is scoped to that route+headsign — it does
 * not include non-boardable counts from other routes at the same stop.
 *
 * @param allEntries - All entries from getFullDayTimetableEntries (unfiltered).
 * @param routeId - Target route ID.
 * @param headsign - Target headsign.
 * @param includeNonBoardable - true at detailed+, false at simple/normal.
 * @returns Filtered entries and omitted non-boardable count for this route+headsign.
 */
export function prepareRouteHeadsignTimetable(
  allEntries: TimetableEntry[],
  routeId: string,
  headsign: string,
  includeNonBoardable: boolean,
): { entries: TimetableEntry[]; omitted: TimetableOmitted } {
  const routeEntries = allEntries.filter(
    (e) =>
      e.routeDirection.route.route_id === routeId &&
      getEffectiveHeadsign(e.routeDirection) === headsign,
  );
  if (includeNonBoardable) {
    return { entries: routeEntries, omitted: { nonBoardable: 0 } };
  }
  const entries = filterBoardable(routeEntries);
  return { entries, omitted: { nonBoardable: routeEntries.length - entries.length } };
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

/**
 * Filter to entries where this stop is the trip's origin (= 始発).
 *
 * Keeps every entry with `entry.patternPosition.isOrigin === true`,
 * including ones that are also non-boardable (= the bus departs from a
 * depot or yard with `pickup_type === 1` / `drop_off_type === 1`). Those
 * entries are visually distinguished by `乗×` / `降×` markers in the
 * grid, so hiding them at the filter layer would suppress legitimate
 * GTFS-described "起点運用" data the viewer is meant to surface.
 *
 * Callers that want only boardable origins should compose this with
 * {@link filterBoardable} (= apply both filters) rather than baking a
 * combined predicate into a single function.
 */
export function filterOrigin(entries: TimetableEntry[]): TimetableEntry[] {
  return entries.filter((entry) => entry.patternPosition.isOrigin);
}
