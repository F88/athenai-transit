/**
 * @module timetable-utils
 *
 * Domain logic for {@link TimetableEntry}.
 * Pure functions that derive boarding status, stop role, and
 * schedule characteristics from timetable data.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';

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
