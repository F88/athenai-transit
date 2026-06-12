/**
 * @module timetable-entry-for-passenger
 *
 * Passenger-perspective questions over a single {@link TimetableEntry}.
 * The subject of every function here is the passenger: can they board,
 * can they alight, is this stop event a service they can actually ride
 * or actually alight from. The raw operator-declared facts live on
 * `entry.boarding` (pickup_type / drop_off_type) and need no wrapper;
 * this module interprets them for the passenger. How a stop event is
 * presented on a transit display (departure / arrival) is a separate
 * question -- see `timetable-entry-for-transit-display.ts`.
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
 * PROVISIONAL: whether a passenger can board this stop event as a
 * service they can actually ride. Unlike {@link canBoard} (signal
 * only), this combines the signal with the pattern position.
 *
 * The exact judgment rule is still being specified (state model:
 * Issue #162; feed boundaries: Issue #145). Interim rule: boardable
 * per the signal and not the pattern's last stop -- the same
 * inference as the former isDropOffOnly, which this function
 * replaces.
 */
export function isBoardableForPassenger(entry: TimetableEntry): boolean {
  // The last-stop rule below knowingly excludes two real-world classes
  // of boardable through-services (kept for reference; both measured on
  // the 2026-06-11 feed snapshots):
  //
  // 1. Single-stop patterns (isFirstStop && isLastStop): trips whose
  //    feed description is one served row -- below the GTFS definition
  //    of a trip ("a sequence of two or more stops"). Real instance:
  //    5 Tokyo Metro weekday trips through onto JR Joban, departing
  //    Ayase 05:45-06:33 toward Toride / Matsudo with pickup 0 /
  //    drop_off 1 (trip_id 50B0509K00 etc.). The operator writes the
  //    signals correctly there, so the signal alone could judge them.
  //
  // 2. Full-run last rows of through-services: the pattern's last stop
  //    is a feed boundary, not a terminus -- the train continues onto
  //    another operator's line. Real instances: Tokyo Metro at Ayase,
  //    e.g. 07:06 Toride / 07:10 Kashiwa (stop 19 of 19, pickup 0);
  //    TWR Rinkai at Osaki, 152 rows/day continuing onto JR toward
  //    Kawagoe etc. About 4,700 rows/day across the rail sources.
  //
  // Why class 1 is not exempted on its own: releasing only the 5
  // single-row departures while the far more numerous class-2 trains
  // stay hidden would render a misleading board at Ayase ("only 5
  // trains toward Toride all morning"). Both classes must be released
  // together, which requires the per-source signal-trust policy
  // tracked in Issue #145 (e.g. Yokohama Municipal Subway leaves
  // pickup_type 0 on real terminals, so a blanket signal-trust or a
  // route_type split alone is not safe).

  // Ideally this would be judged by canBoard alone, but current data
  // quality makes that impossible:
  // - For a source like Tokyo Metro, a last-stop row could safely be
  //   judged boardable (its signals are written reliably).
  // - But not every subway operator produces data of that quality
  //   (e.g. Yokohama Municipal Subway leaves pickup_type 0 on real
  //   terminals), so the decision cannot be made by route type alone.
  //
  // /** Implementation sketch: trust the signal in all cases */
  // return canBoard(entry)
  //
  // /** Implementation sketch: for subway / rail route types, judge a
  //  *  last-stop row boardable per the signal */
  //
  // const routeType = entry.routeDirection.route.route_type;
  // switch (routeType) {
  //   case 1: // Subway
  //     return canBoard(entry);
  //   case 2: // Rail
  //     return canBoard(entry);
  //   default:
  //     if (entry.patternPosition.isLastStop) {
  //       return false;
  //     } else {
  //       return canBoard(entry);
  //     }
  // }

  // For now, treating the last stop as not boardable is the realistic
  // implementation. Note that a last stop is NOT necessarily a terminus
  // (a through-service onto another line continues past it), but it is
  // still treated as not boardable here.

  if (entry.patternPosition.isLastStop) {
    return false;
  }

  if (!canBoard(entry)) {
    return false;
  }

  return true;
}

/**
 * PROVISIONAL: whether a passenger can alight from this stop event as
 * a service they actually arrive on. Unlike {@link canAlight} (signal
 * only), this combines the signal with the pattern position.
 *
 * Symmetric to {@link isBoardableForPassenger}; the rule is equally
 * interim. Interim rule: alightable per the signal and not the
 * pattern's first stop -- the same inference as the former
 * isBoardingOnly, which this function replaces.
 */
export function isAlightableForPassenger(entry: TimetableEntry): boolean {
  if (entry.patternPosition.isFirstStop) {
    return false;
  }

  if (!canAlight(entry)) {
    return false;
  }

  return true;
}
