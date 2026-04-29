/**
 * @module timetable-utils
 *
 * Domain logic for {@link TimetableEntry} and timetable query metadata.
 * Pure functions that derive boarding status, stop role, schedule
 * characteristics, and stop-level service state from timetable data.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';
import type {
  FilteredTimetableEntriesState,
  StopServiceState,
  StopServiceStateInput,
  TimetableEntriesState,
} from '../../types/app/transit';

/**
 * Get the display time in minutes for a timetable entry.
 *
 * Terminal entries show arrival time; all others show departure time.
 * This is a key domain rule: the time shown to the user depends on
 * whether the stop is the last stop in the pattern.
 */
export function getDisplayMinutes(entry: TimetableEntry): number {
  return entry.patternPosition.isTerminal
    ? entry.schedule.arrivalMinutes
    : entry.schedule.departureMinutes;
}

/**
 * Derive the stop service state from service day signals.
 *
 * Signals are passed as a narrow structural object (see
 * {@link StopServiceStateInput}) rather than the full `TimetableQueryMeta`,
 * which allows the repository layer to compute the state during meta
 * construction without a circular type dependency.
 *
 * @param input - Minimal service day signals.
 * @returns The service state of the stop for that service day.
 */
export function getStopServiceState(input: StopServiceStateInput): StopServiceState {
  if (input.totalEntries === 0) {
    return 'no-service';
  }
  if (!input.isBoardableOnServiceDay) {
    return 'drop-off-only';
  }
  return 'boardable';
}

/**
 * Derive the service state from a collection of timetable entries.
 *
 * Unlike {@link getStopServiceState} which takes pre-computed signals,
 * this function inspects the entries directly. It can be applied to
 * any subset: full-day, upcoming, filtered by route/headsign, or a
 * specific time window.
 *
 * @param entries - The timetable entries to evaluate.
 * @returns The service state of the entries collection.
 */
export function getTimetableEntriesState(entries: TimetableEntry[]): TimetableEntriesState {
  if (entries.length === 0) {
    return 'no-service';
  }
  if (!entries.some((entry) => !isDropOffOnly(entry))) {
    return 'drop-off-only';
  }
  return 'boardable';
}

/**
 * Combine the repo's full-day {@link StopServiceState} with the state
 * of the pre-filter upcoming entries and the state of the post-filter
 * entries into a unified {@link FilteredTimetableEntriesState} for UI
 * display.
 *
 * Distinguishes the three "empty display" scenarios that the simpler
 * two-state check in {@link getTimetableEntriesState} cannot tell apart:
 *
 * 1. `stopServiceState === 'no-service'` → `'no-service'`
 *    (repo has no timetable data for this stop at all)
 * 2. `upcomingEntriesState === 'no-service'` → `'service-ended'`
 *    (repo has data today but the upcoming window is already empty
 *    pre-filter — late-night / service ended for today)
 * 3. `filteredEntriesState === 'no-service'` → `'filter-hidden'`
 *    (pre-filter upcoming had entries but the user's UI filters removed
 *    everything)
 * 4. otherwise → `filteredEntriesState` (`'boardable'` or
 *    `'drop-off-only'`)
 *
 * All three inputs are already-derived state values, so the function is
 * purely combinatorial and has no entry-scanning cost. Callers typically
 * compute `upcomingEntriesState` / `filteredEntriesState` via
 * {@link getTimetableEntriesState}.
 *
 * @param stopServiceState - Full-day service state (from repo meta via
 *   {@link getStopServiceState}).
 * @param upcomingEntriesState - Pre-filter upcoming entries state.
 * @param filteredEntriesState - Post-filter entries state.
 * @returns Unified display state for the filtered view.
 */
export function getFilteredTimetableEntriesState(
  stopServiceState: StopServiceState,
  upcomingEntriesState: TimetableEntriesState,
  filteredEntriesState: TimetableEntriesState,
): FilteredTimetableEntriesState {
  if (stopServiceState === 'no-service') {
    return 'no-service';
  }
  if (upcomingEntriesState === 'no-service') {
    return 'service-ended';
  }
  if (filteredEntriesState === 'no-service') {
    return 'filter-hidden';
  }
  return filteredEntriesState;
}

/**
 * Whether this stop is drop-off only (passengers cannot board).
 *
 * Combines two signals with different trust levels:
 * 1. Source data (GTFS pickup_type): pickupType === 1 means the
 *    source explicitly declares boarding is not available. This is
 *    the authoritative signal and should always be trusted.
 * 2. Pattern inference: isTerminal (last stop in the pattern).
 *    Used as a fallback when the source does not set pickup_type
 *    (defaults to 0). This handles sources like Toei Bus where
 *    pickup_type is not set on terminal stops.
 *
 * Note: pickupType === 0 is ambiguous — it can mean either
 * "source explicitly allows boarding" or "source did not provide
 * data (defaulted to 0)". There is no way to distinguish these
 * cases from the data alone. When pickupType is 0, pattern
 * inference (isTerminal) provides the best available estimate.
 */
export function isDropOffOnly(entry: TimetableEntry): boolean {
  if (entry.boarding.pickupType === 1) {
    return true;
  }
  if (entry.patternPosition.isTerminal) {
    return true;
  }
  return false;
}

/**
 * Whether this stop is boarding only (passengers cannot alight).
 *
 * Same two-signal approach as {@link isDropOffOnly}:
 * 1. Source data: dropOffType === 1 (explicitly not available)
 * 2. Pattern inference: isOrigin (first stop — no one is on the bus yet)
 *
 * See {@link isDropOffOnly} for details on signal trust levels and
 * the ambiguity of default value 0.
 */
export function isBoardingOnly(entry: TimetableEntry): boolean {
  if (entry.boarding.dropOffType === 1) {
    return true;
  }
  if (entry.patternPosition.isOrigin) {
    return true;
  }
  return false;
}

/**
 * Whether the vehicle dwells at this stop (arrival and departure differ).
 *
 * Most bus stops have arrivalMinutes === departureMinutes.
 * Rail stations may have dwell time where the train waits.
 */
export function hasDwellTime(entry: TimetableEntry): boolean {
  return entry.schedule.arrivalMinutes !== entry.schedule.departureMinutes;
}

/**
 * Get the dwell time in minutes (departure - arrival).
 * Returns 0 for most bus stops.
 */
export function getDwellMinutes(entry: TimetableEntry): number {
  return entry.schedule.departureMinutes - entry.schedule.arrivalMinutes;
}

/**
 * Get remaining travel time to the terminal in minutes.
 * Returns null if insights data is not loaded.
 */
export function getRemainingMinutes(entry: TimetableEntry): number | null {
  return entry.insights?.remainingMinutes ?? null;
}

/**
 * Whether this entry requires special boarding arrangement
 * (phone reservation or driver coordination).
 */
export function requiresArrangement(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType >= 2 || entry.boarding.dropOffType >= 2;
}

/**
 * Whether this is a pass-through stop where the vehicle neither
 * picks up nor drops off passengers.
 */
export function isPassThrough(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType === 1 && entry.boarding.dropOffType === 1;
}

/**
 * Whether at least one entry in the list is boardable (not drop-off only).
 *
 * Works at any grouping level:
 * - **Stop level**: pass all entries for a stop → "is this stop boardable?"
 * - **Route+headsign level**: pass grouped entries → "is this group boardable?"
 *
 * Returns false for an empty list (no stop times = nothing to board).
 */
export function hasBoardable(entries: TimetableEntry[]): boolean {
  return entries.some((entry) => !isDropOffOnly(entry));
}
