/**
 * @module timetable-entry-for-transit-display
 *
 * Transit-display-perspective questions over a single
 * {@link TimetableEntry}: is this stop event presented as a departure
 * or an arrival on a transit display (departures / arrivals board).
 *
 * The board's selection policy currently matches the
 * passenger-perspective judgments in
 * `timetable-entry-for-passenger.ts`; if the board ever needs to
 * deviate from them, this module is where that policy difference
 * belongs.
 *
 * The delegated judgment rules themselves are PROVISIONAL (state
 * model: Issue #162; feed boundaries: Issue #145); see
 * `timetable-entry-for-passenger.ts` for the details.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';
import { isAlightableForPassenger, isBoardableForPassenger } from './timetable-entry-for-passenger';

/**
 * Whether this stop event is presented as a departure on a transit
 * display.
 *
 * Currently delegates to {@link isBoardableForPassenger}: a departures
 * board lists the services a passenger can actually ride from here.
 */
export function isDeparture(entry: TimetableEntry): boolean {
  return isBoardableForPassenger(entry);
}

/**
 * Whether this stop event is presented as an arrival on a transit
 * display.
 *
 * Currently delegates to {@link isAlightableForPassenger}: an arrivals
 * board lists the services a passenger can actually alight from here.
 */
export function isArrival(entry: TimetableEntry): boolean {
  return isAlightableForPassenger(entry);
}
