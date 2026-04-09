/**
 * @module timetable-utils
 *
 * Domain logic for {@link TimetableEntry} and timetable query metadata.
 * Pure functions that derive boarding status, stop role, schedule
 * characteristics, and stop-level service state from timetable data.
 */

import type { TimetableQueryMeta } from '../../types/app/repository';
import type { TimetableEntry } from '../../types/app/transit-composed';

/**
 * High-level service state of a stop on a given service day.
 *
 * Used to drive UI labels and filtering without inspecting multiple
 * boolean/count fields ad hoc. New states can be added here as the
 * set of user-visible stop conditions grows, and exhaustive handling
 * at call sites can be enforced with `satisfies never` in switch blocks.
 *
 * - `boardable`: Stop has at least one boardable entry today
 *   (normal case for an operating stop).
 * - `drop-off-only`: Stop has entries today but none are boardable
 *   (all entries are terminal or pickup_type === 1).
 * - `no-service`: Stop has no entries today. This covers both:
 *   - Orphan stops declared in `stops.txt` but never referenced by
 *     `stop_times.txt` in the source GTFS.
 *   - Stops whose scheduled services do not operate on this day.
 *   The distinction between these two sub-cases is intentionally not
 *   made here — it is not derivable from a single-day query.
 */
export type StopServiceState = 'boardable' | 'drop-off-only' | 'no-service';

/**
 * Derive the stop service state from timetable query metadata.
 *
 * Takes the full {@link TimetableQueryMeta} so that future state
 * additions can reference additional meta fields without changing
 * this function's signature.
 *
 * @param meta - Timetable query meta describing the full service day.
 * @returns The service state of the stop for that service day.
 */
export function getStopServiceState(meta: TimetableQueryMeta): StopServiceState {
  if (meta.totalEntries === 0) {
    return 'no-service';
  }
  if (!meta.isBoardableOnServiceDay) {
    return 'drop-off-only';
  }
  return 'boardable';
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
 * Returns false for an empty list (no departures = nothing to board).
 */
export function hasBoardableDeparture(entries: TimetableEntry[]): boolean {
  return entries.some((entry) => !isDropOffOnly(entry));
}

/**
 * Filter out drop-off-only entries, returning only boardable departures.
 *
 * Used to exclude terminal arrivals and pickup-unavailable stops
 * from the NearbyStop display in non-verbose mode.
 *
 * Each entry's boardability is determined by {@link isDropOffOnly}
 * (pickupType === 1 OR isTerminal).
 */
export function filterBoardable(entries: TimetableEntry[]): TimetableEntry[] {
  return entries.filter((entry) => !isDropOffOnly(entry));
}

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
