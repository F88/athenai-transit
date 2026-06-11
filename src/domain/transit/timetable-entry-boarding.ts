/**
 * @module timetable-entry-boarding
 *
 * Boarding / alighting judgments over a single {@link TimetableEntry}.
 * Pure predicates that interpret the `boarding` source signals
 * (pickup_type / drop_off_type), combining them with `patternPosition`
 * role inference where the signals alone are ambiguous.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';

/**
 * Whether this stop is drop-off only (passengers cannot board).
 *
 * Combines two signals with different trust levels:
 * 1. Source data (GTFS pickup_type): pickupType === 1 means the
 *    source explicitly declares boarding is not available. This is
 *    the authoritative signal and should always be trusted.
 * 2. Pattern inference: isLastStop (last stop in the pattern).
 *    Used as a fallback when the source does not set pickup_type
 *    (defaults to 0). This handles sources like Toei Bus where
 *    pickup_type is not set on terminal stops.
 *
 * Note: pickupType === 0 is ambiguous — it can mean either
 * "source explicitly allows boarding" or "source did not provide
 * data (defaulted to 0)". There is no way to distinguish these
 * cases from the data alone. When pickupType is 0, pattern
 * inference (isLastStop) provides the best available estimate.
 */
export function isDropOffOnly(entry: TimetableEntry): boolean {
  if (entry.patternPosition.isLastStop) {
    return true;
  }
  if (entry.boarding.pickupType === 1) {
    return true;
  }
  return false;
}

/**
 * Whether this stop is boarding only (passengers cannot alight).
 *
 * Same two-signal approach as {@link isDropOffOnly}:
 * 1. Source data: dropOffType === 1 (explicitly not available)
 * 2. Pattern inference: isFirstStop (first stop — no one is on the bus yet)
 *
 * See {@link isDropOffOnly} for details on signal trust levels and
 * the ambiguity of default value 0.
 */
export function isBoardingOnly(entry: TimetableEntry): boolean {
  if (entry.patternPosition.isFirstStop) {
    return true;
  }
  if (entry.boarding.dropOffType === 1) {
    return true;
  }
  return false;
}

/**
 * Whether this entry requires special boarding arrangement
 * (phone reservation or driver coordination).
 */
export function requiresArrangement(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType >= 2 || entry.boarding.dropOffType >= 2;
}

/**
 * Whether this stop event provides no passenger service at all
 * (explicit signals only: pickup_type === 1 && drop_off_type === 1).
 *
 * The GTFS spec guarantees only this much: no pickup and no drop off at
 * this stop event. It says nothing about whether the vehicle physically
 * stops here -- do not present it as "passing". GTFS Schedule Best
 * Practices (a recommendation, not the spec) suggests marking deadhead
 * trips, internal timing points, and garages this way, so those are
 * typical -- but not guaranteed -- referents (stop_times.txt section,
 * snapshot 2026-06-11):
 * https://gtfs.org/documentation/schedule/schedule-best-practices/#stop_timestxt
 */
export function isNoPassengerService(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType === 1 && entry.boarding.dropOffType === 1;
}
