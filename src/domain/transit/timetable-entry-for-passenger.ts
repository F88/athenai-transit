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

import type { StopServiceType, TimetableEntry } from '../../types/app/transit-composed';
import type { Route } from '../../types/app/transit';
import { extractPrefix } from './prefixed-id';

/**
 * Source prefixes whose Last-stop / First-stop signal is trusted
 * directly: the boarding/drop-off signal alone decides at endpoints,
 * without the pattern-position fallback.
 *
 * A prefix belongs here when BOTH hold:
 *  1. The feed sets pickup_type / drop_off_type at the Last stop and the
 *     First stop per the GTFS spec -- true terminals marked pickup_type 1,
 *     true origins drop_off_type 1 -- so the endpoint signal is correct.
 *  2. It is a railway / subway whose real operation runs beyond the
 *     feed's trip (inter-operator through-running), so a Last/First stop
 *     can be a feed boundary rather than a real terminus / origin.
 *
 * This is NOT a data-reliability ranking, and absence does NOT mean a
 * source is less reliable: most buses satisfy (1) but not (2) -- no
 * through-running, so nothing to release -- and are excluded with no
 * loss. (A per-feed property: Toei Train `toaran` qualifies; Toei Bus
 * `minkuru`, same brand different feed, does not.)
 *
 * A counter-example for (1): Yokohama Municipal Subway `yht` leaves
 * pickup_type 0 on its real terminals -- all 1,901 last-stop rows are
 * pickup_type 0 (2026-06-14: Shonandai, Azamino, Nakayama, Hiyoshi, plus
 * short-turn terminals), and the network is self-contained (no
 * through-running). Adding it here would wrongly release every terminus
 * as boardable, so it fails (1) and (2) both.
 *
 * TEMPORARY / local prototype, each entry verified individually. Toei
 * Train checked at the terminal level (2026-06-13): through lines
 * (Asakusa / Mita / Shinjuku) carry pickup_type 0 only at real
 * boundaries (Oshiage, Sengakuji, Meguro, Shinjuku); the non-through
 * Oedo line marks every terminal pickup_type 1. See Issue #145.
 */
const THROUGH_RUNNING_SIGNAL_TRUSTED_PREFIXES: ReadonlySet<string> = new Set<string>([
  'tome', // Tokyo Metro
  'twrr', // TWR Rinkai
  'toaran', // Toei Train
]);

/**
 * Whether the endpoint signal is trusted for the given source prefix.
 * Core, source-level check (see {@link THROUGH_RUNNING_SIGNAL_TRUSTED_PREFIXES}).
 * For callers that already hold a prefix; otherwise use
 * {@link isEndpointSignalTrustedByRoute}.
 */
export function isEndpointSignalTrustedByPrefix(prefix: string): boolean {
  return THROUGH_RUNNING_SIGNAL_TRUSTED_PREFIXES.has(prefix);
}

/**
 * Whether the endpoint signal is trusted for the given route. Resolves
 * the source prefix from `route_id` and delegates to
 * {@link isEndpointSignalTrustedByPrefix}.
 *
 * The judgment currently keys on the source prefix only, but taking the
 * whole {@link Route} lets a future criterion (e.g. `route_type` /
 * `agency_id`) be absorbed here without changing the call sites.
 */
export function isEndpointSignalTrustedByRoute(route: Route): boolean {
  const prefix = extractPrefix(route.route_id);
  return isEndpointSignalTrustedByPrefix(prefix);
}

/**
 * PROVISIONAL: boardability judged by the GTFS pickup_type signal ALONE
 * -- the pattern position is ignored. Applied when the source's endpoint
 * signals are trusted (see {@link isEndpointSignalTrustedByRoute}), so a
 * last-stop through-service row is released as boardable.
 *
 * Scalar form (no {@link TimetableEntry}) so repositories can call it
 * while scanning raw timetable rows. Arrangement-required values 2 (phone
 * agency) and 3 (coordinate with driver) count as boardable; combine with
 * `requiresArrangement` in `timetable-entry-boarding.ts` to tell them
 * apart from a regular pickup.
 */
export function isBoardableForPassengerBySignal(pickupType: StopServiceType): boolean {
  switch (pickupType) {
    case 0: // GTFS: Regularly scheduled pickup.
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
 * PROVISIONAL: boardability judged by the pickup signal AND the pattern
 * position -- a last stop is treated as not boardable. This is the
 * conservative default for sources whose endpoint signals are not trusted;
 * for trusted sources the selector {@link isBoardableForPassenger} uses
 * {@link isBoardableForPassengerBySignal} (the signal alone) instead.
 *
 * Scalar form (no {@link TimetableEntry}) so repositories can call it
 * while scanning raw timetable rows.
 *
 * The exact judgment rule is still being specified (state model:
 * Issue #162; feed boundaries: Issue #145). Interim rule: boardable per
 * the signal and not the pattern's last stop -- the same inference as the
 * former isDropOffOnly, which this rule replaces. A last stop is not
 * necessarily a true terminus: a through-service onto another operator
 * continues past a feed boundary (e.g. Tokyo Metro at Ayase, TWR Rinkai
 * at Osaki), but without a trusted endpoint signal it is treated as not
 * boardable here. See Issue #145.
 */
export function isBoardableForPassengerBySignalAndPosition(
  pickupType: StopServiceType,
  isLastStop: boolean,
): boolean {
  if (isLastStop) {
    return false;
  }

  if (!isBoardableForPassengerBySignal(pickupType)) {
    return false;
  }

  return true;
}

/**
 * PROVISIONAL: whether a passenger can board this stop event as a
 * service they can actually ride.
 *
 * Picks the judgment by per-source policy:
 * - endpoint-signal-trusted source ({@link isEndpointSignalTrustedByRoute}):
 *   {@link isBoardableForPassengerBySignal} (signal alone).
 * - otherwise: {@link isBoardableForPassengerBySignalAndPosition}
 *   (signal AND pattern position).
 *
 * TEMPORARY local prototype; the trusted set is hardcoded. See Issue #145.
 */
export function isBoardableForPassenger(entry: TimetableEntry): boolean {
  const { pickupType } = entry.boarding;
  if (isEndpointSignalTrustedByRoute(entry.routeDirection.route)) {
    return isBoardableForPassengerBySignal(pickupType);
  }
  return isBoardableForPassengerBySignalAndPosition(pickupType, entry.patternPosition.isLastStop);
}

/**
 * PROVISIONAL: alightability judged by the GTFS drop_off_type signal
 * ALONE -- the pattern position is ignored. Applied when the source's
 * endpoint signals are trusted (see {@link isEndpointSignalTrustedByRoute}),
 * so a first-stop through-service row (a feed-boundary arrival continuing
 * from another operator) is released as alightable.
 *
 * Mirror of {@link isBoardableForPassengerBySignal}. Scalar form (no
 * {@link TimetableEntry}) so repositories can call it while scanning raw
 * timetable rows. Arrangement-required values 2 and 3 count as
 * alightable.
 */
export function isAlightableForPassengerBySignal(dropOffType: StopServiceType): boolean {
  switch (dropOffType) {
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
 * PROVISIONAL: alightability judged by the drop_off signal AND the
 * pattern position -- a first stop is treated as not alightable. This is
 * the conservative default for sources whose endpoint signals are not
 * trusted; for trusted sources the selector {@link isAlightableForPassenger}
 * uses {@link isAlightableForPassengerBySignal} (the signal alone) instead.
 *
 * Mirror of {@link isBoardableForPassengerBySignalAndPosition}. Scalar
 * form so repositories can call it while scanning raw timetable rows.
 * Interim rule: alightable per the signal and not the pattern's first stop
 * -- the same inference as the former isBoardingOnly, which this rule
 * replaces. A first stop is not necessarily a true origin: a
 * through-service arriving from another operator continues past a feed
 * boundary, but without a trusted endpoint signal it is treated as not
 * alightable here. See Issue #145.
 */
export function isAlightableForPassengerBySignalAndPosition(
  dropOffType: StopServiceType,
  isFirstStop: boolean,
): boolean {
  if (isFirstStop) {
    return false;
  }

  if (!isAlightableForPassengerBySignal(dropOffType)) {
    return false;
  }

  return true;
}

/**
 * PROVISIONAL: whether a passenger can alight from this stop event as
 * a service they actually arrive on.
 *
 * Mirror of {@link isBoardableForPassenger}; picks the judgment by the
 * same per-source policy:
 * - endpoint-signal-trusted source ({@link isEndpointSignalTrustedByRoute}):
 *   {@link isAlightableForPassengerBySignal} (signal alone).
 * - otherwise: {@link isAlightableForPassengerBySignalAndPosition}
 *   (signal AND pattern position).
 *
 * TEMPORARY local prototype; the trusted set is hardcoded. See Issue #145.
 */
export function isAlightableForPassenger(entry: TimetableEntry): boolean {
  const { dropOffType } = entry.boarding;
  if (isEndpointSignalTrustedByRoute(entry.routeDirection.route)) {
    return isAlightableForPassengerBySignal(dropOffType);
  }
  return isAlightableForPassengerBySignalAndPosition(
    dropOffType,
    entry.patternPosition.isFirstStop,
  );
}
