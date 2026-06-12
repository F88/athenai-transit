/**
 * @module timetable-entry-for-passenger
 *
 * Passenger-perspective questions over a single {@link TimetableEntry}.
 * The subject of every function here is the passenger: can they board,
 * can they alight, does this stop event work as a departure or an
 * arrival for them. The raw operator-declared facts live on
 * `entry.boarding` (pickup_type / drop_off_type) and need no wrapper;
 * this module interprets them for the passenger.
 *
 * The judgment rules are PROVISIONAL: the state model is being
 * specified in Issue #162 and the feed-boundary refinement in
 * Issue #145.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';

/**
 * Whether a passenger can board at this stop event, judged from the
 * GTFS pickup_type signal alone (no pattern-role inference).
 *
 * Arrangement-required values 2 (phone agency) and 3 (coordinate with
 * driver) count as boardable; combine with `requiresArrangement` in
 * `timetable-entry-boarding.ts` to tell them apart from a regular
 * pickup.
 */
export function canBoard(entry: TimetableEntry): boolean {
  switch (entry.boarding.pickupType) {
    case 0: // GTFS: Regularly scheduled pickup
      return true;
    case 1: // GTFS: No pickup available.
      return false;
    case 2: // GTFS: Must phone agency to arrange pickup.
      return true;
    case 3: // GTFS: Must coordinate with driver to arrange pickup.
      return true;
  }
}

/**
 * Whether a passenger can alight at this stop event, judged from the
 * GTFS drop_off_type signal alone (no pattern-role inference).
 *
 * Arrangement-required values 2 and 3 count as alightable; see
 * {@link canBoard}.
 */
export function canAlight(entry: TimetableEntry): boolean {
  switch (entry.boarding.dropOffType) {
    case 0: // GTFS: Regularly scheduled drop off.
      return true;
    case 1: // GTFS: No drop off available.
      return false;
    case 2: // GTFS: Must phone agency to arrange drop off.
      return true;
    case 3: // GTFS: Must coordinate with driver to arrange drop off.
      return true;
  }
}

/**
 * PROVISIONAL: whether this stop event is presented as a departure.
 *
 * The exact judgment rule is still being specified (state model:
 * Issue #162; feed boundaries: Issue #145). Interim rule: boardable
 * per the signal and not the pattern's last stop -- the same
 * inference as the existing isDropOffOnly, so introducing this
 * function changes no behavior anywhere.
 */
export function isDeparture(entry: TimetableEntry): boolean {
  if (entry.patternPosition.isLastStop) {
    return false;
  }

  if (!canBoard(entry)) {
    return false;
  }

  return true;
}

/**
 * PROVISIONAL: whether this stop event is presented as an arrival.
 *
 * Symmetric to {@link isDeparture}; the rule is equally interim.
 * Interim rule: alightable per the signal and not the pattern's
 * first stop -- the same inference as the existing isBoardingOnly.
 */
export function isArrival(entry: TimetableEntry): boolean {
  if (entry.patternPosition.isFirstStop) {
    return false;
  }

  if (!canAlight(entry)) {
    return false;
  }

  return true;
}
