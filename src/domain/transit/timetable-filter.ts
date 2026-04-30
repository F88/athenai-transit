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
 * When `includeNonBoardable` is false (simple/normal), non-boardable
 * entries (= entries with `pickup_type !== 0` or `isTerminal`) are
 * removed and their count is reported in `omitted.nonBoardable`.
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
  const entries = filterByStopEventAttributes(allEntries, {
    pickUpState: new Set(['boardable']),
    position: new Set(['origin', 'middle']),
  });
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
  const entries = filterByStopEventAttributes(routeEntries, {
    pickUpState: new Set(['boardable']),
    position: new Set(['origin', 'middle']),
  });
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

// ---------------------------------------------------------------------------
// filterByStopEventAttributes
// ---------------------------------------------------------------------------

/** Pattern position values an entry can match. */
export type PatternPosition = 'origin' | 'terminal' | 'middle';

/**
 * Pick-up state values an entry can match. Maps 1:1 to GTFS
 * `pickup_type` values (= boarding side, no `drop_off_type` involvement):
 *
 * - `'boardable'` — `pickup_type === 0` (regular pickup).
 * - `'nonBoardable'` — `pickup_type === 1` (no pickup available).
 * - `'phoneArrangement'` — `pickup_type === 2` (phone agency to arrange).
 * - `'driverArrangement'` — `pickup_type === 3` (coordinate with driver).
 */
export type PickUpState = 'boardable' | 'nonBoardable' | 'phoneArrangement' | 'driverArrangement';

/**
 * Schedule range filter for departure / arrival times.
 *
 * Both bounds are inclusive and expressed in minutes from midnight of
 * the service day (so values >= 1440 represent overnight times, which
 * compare correctly as numbers). Omit a bound to leave that side open.
 */
export interface ScheduleRangeFilter {
  /** Time field to apply the range to. @default 'departure' */
  field?: 'departure' | 'arrival';
  /** Inclusive lower bound. Omit for no lower bound. */
  fromMinutes?: number;
  /** Inclusive upper bound. Omit for no upper bound. */
  toMinutes?: number;
}

/**
 * Bundle of stop-event attribute axes for {@link filterByStopEventAttributes}.
 *
 * "Stop event" = a single occurrence of a trip visiting a stop. Trip
 * identity (route, headsign, agency, service_id) is intentionally NOT
 * part of this filter; use {@link filterByAgency} / {@link filterByRouteType}
 * for those.
 *
 * Each field is independent and additively narrows the result set
 * (AND semantics across axes); an undefined field disables that axis.
 * An empty Set yields no matches (literal interpretation).
 *

 * Semantics:
 * - 'origin' / 'terminal' map to `patternPosition.isOrigin` /
 *   `.isTerminal`; 'middle' = neither. Single-stop trips
 *   (isOrigin AND isTerminal) match both 'origin' and 'terminal'.
 * - 'boardable' / 'nonBoardable' / 'phoneArrangement' /
 *   'driverArrangement' map 1:1 to `boarding.pickupType` (0 / 1 / 2 / 3).
 *   `isTerminal` is NOT mixed in (use the position axis if needed).
 * - Schedule range is inclusive on both ends. `field` selects
 *   `entry.schedule.departureMinutes` (default) or
 *   `entry.schedule.arrivalMinutes`.
 */
export interface StopEventAttributeFilters {
  /** Schedule time range to keep. Omit to disable. */
  schedule?: ScheduleRangeFilter;
  /** Pick-up states to keep. Omit to disable. */
  pickUpState?: ReadonlySet<PickUpState>;
  /** Pattern positions to keep. Omit to disable. */
  position?: ReadonlySet<PatternPosition>;
}

function matchesPosition(entry: TimetableEntry, allowed: ReadonlySet<PatternPosition>): boolean {
  const { isOrigin, isTerminal } = entry.patternPosition;
  if (isOrigin && allowed.has('origin')) {
    return true;
  }
  if (isTerminal && allowed.has('terminal')) {
    return true;
  }
  if (!isOrigin && !isTerminal && allowed.has('middle')) {
    return true;
  }
  return false;
}

function matchesPickUpState(entry: TimetableEntry, allowed: ReadonlySet<PickUpState>): boolean {
  switch (entry.boarding.pickupType) {
    case 0:
      return allowed.has('boardable');
    case 1:
      return allowed.has('nonBoardable');
    case 2:
      return allowed.has('phoneArrangement');
    case 3:
      return allowed.has('driverArrangement');
  }
}

function matchesSchedule(entry: TimetableEntry, range: ScheduleRangeFilter): boolean {
  const value =
    range.field === 'arrival' ? entry.schedule.arrivalMinutes : entry.schedule.departureMinutes;
  if (range.fromMinutes !== undefined && value < range.fromMinutes) {
    return false;
  }
  if (range.toMinutes !== undefined && value > range.toMinutes) {
    return false;
  }
  return true;
}

/**
 * Filter entries by stop-event-level attributes (schedule / pick-up
 * state / pattern position) in a single array pass.
 *
 * Trip-level attributes (route, headsign, agency) are NOT considered —
 * use {@link filterByAgency} / {@link filterByRouteType} for those.
 *
 * When all axes are undefined, the input reference is returned
 * unchanged (no allocation), so this is safe to call with an empty
 * filter bundle from `useMemo` etc.
 */
export function filterByStopEventAttributes<T extends TimetableEntry>(
  entries: readonly T[],
  filters: StopEventAttributeFilters,
): T[] {
  const { position, pickUpState, schedule } = filters;
  if (!position && !pickUpState && !schedule) {
    return entries as T[];
  }
  return entries.filter((entry) => {
    if (position && !matchesPosition(entry, position)) {
      return false;
    }
    if (pickUpState && !matchesPickUpState(entry, pickUpState)) {
      return false;
    }
    if (schedule && !matchesSchedule(entry, schedule)) {
      return false;
    }
    return true;
  });
}

/** Toggle bundle for {@link applyStopEventAttributeToggles}. */
export interface StopEventAttributeToggles {
  /**
   * When true, narrows to entries where this stop is the trip's origin
   * (= `entry.patternPosition.isOrigin === true`). Includes
   * non-boardable origins; combine with `showBoardableOnly` to
   * intersect.
   */
  showOriginOnly: boolean;
  /**
   * When true, narrows to entries with `pickup_type === 0` whose
   * `patternPosition` is `'origin'` or `'middle'` (i.e. not a pure
   * terminal). Composes with `showOriginOnly` (AND) when both are on.
   */
  showBoardableOnly: boolean;
}

/**
 * Apply the user-facing entry-attribute toggles
 * (`showOriginOnly` / `showBoardableOnly`) to a list of entries.
 *
 * Each enabled toggle narrows the result via
 * {@link filterByStopEventAttributes} (AND across toggles). When both
 * toggles are false, the input reference is returned unchanged.
 *
 * Used by both BottomSheet (per-stop entries) and TimetableModal (the
 * stop's full timetable) so the toggle semantics stay aligned across
 * surfaces.
 */
export function applyStopEventAttributeToggles<T extends TimetableEntry>(
  entries: readonly T[],
  toggles: StopEventAttributeToggles,
): T[] {
  let result = entries as T[];
  if (toggles.showOriginOnly) {
    result = filterByStopEventAttributes(result, {
      position: new Set(['origin']),
    });
  }
  if (toggles.showBoardableOnly) {
    result = filterByStopEventAttributes(result, {
      pickUpState: new Set(['boardable']),
      position: new Set(['origin', 'middle']),
    });
  }
  return result;
}
