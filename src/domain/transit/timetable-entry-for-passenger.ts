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
 * inference as the former isDropOffOnly, which this function
 * replaces.
 */
export function isDeparture(entry: TimetableEntry): boolean {
  // Last-stop inference with a single-stop exemption -- `!isFirstStop`
  // is NOT an oversight:
  // - Normal patterns: the last stop is judged not to be a departure,
  //   compensating for sources that leave pickup_type at 0 on real
  //   terminals (e.g. Toei Bus).
  // - Single-stop patterns (isFirstStop && isLastStop): the premise
  //   "last stop = the journey ends here" has no basis. A trip is, per
  //   the GTFS spec, "a sequence of two or more stops", so these are
  //   feed-boundary artifacts -- e.g. Tokyo Metro weekday trips through
  //   onto JR Joban consist of one served row at Ayase (pickup 0 /
  //   drop_off 1) -- and the operator writes the signals correctly
  //   there. The signal decides.

  // 本来は canBoard だけで判定したいが、現状のデータ品質では不可能である
  // - 東京メトロ(例) の場合は LastStop であっても乗車可と判断することは可能
  // - 但し、全ての事事業者の地下鉄が同様のデータではないため、路線種別で判定することは出来ない
  //
  // /** 実装例: All cases */
  // return canBoard(entry)
  //
  // /** 実装例: 路線種別が地下鉄の場合は、LastStop であっても乗車可と判断する */
  //
  // const routeType = entry.routeDirection.route.route_type;
  // switch (routeType) {
  //   case 1: // Subway
  //     return canBoard(entry);
  //   case 2: // Rail
  //     return canBoard(entry);
  //   default:
  //     if (entry.patternPosition.isFirstStop) {
  //       return false;
  //     } else {
  //       return canBoard(entry);
  //     }
  // }

  // 現時点では LastStop を乗車不可と判断することが現実的な実装である.
  // LastStop(!=終点(他路線乗り入れでは終点ではない)) を乗車不可とみなす.

  if (entry.patternPosition.isFirstStop) {
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
 * first stop -- the same inference as the former isBoardingOnly,
 * which this function replaces.
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
