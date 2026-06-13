/**
 * @module timetable-entry-boarding
 *
 * Signal-derived predicates over a single {@link TimetableEntry}'s
 * `boarding` field (pickup_type / drop_off_type). Facts only -- no
 * pattern-role inference. Passenger-perspective judgments (departure /
 * arrival, with position inference) live in
 * `timetable-entry-for-passenger.ts`.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';

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
 *
 * CAUTION: the real-world meaning of 1/1 is source- AND trip-dependent,
 * so a true return does NOT guarantee "no passenger service" in reality.
 * Measured on the 2026-06-13 feed (tome / Tokyo Metro): 1/1 also marks
 * the through-service feed boundary where a Metro pattern hands off to
 * another operator. Two distinct realities collapse onto 1/1 there:
 *   - Express through-runs (e.g. Metro Hakone Romancecar, pattern
 *     tome:p117) genuinely pass Yoyogi-Uehara without serving it -- a
 *     real no-stop.
 *   - Local through-runs (e.g. tome:p107 toward Hon-Atsugi) mark
 *     Yoyogi-Uehara 1/1 even though it is a real, used interchange
 *     stop -- a feed-boundary artifact, not a real no-service.
 * Do not treat this predicate as a standalone "is this a pass-through"
 * test across sources; pair it with source/trip context. See Issue #162
 * (state model) and Issue #145 (per-source feed-boundary policy).
 */
export function isNoPassengerService(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType === 1 && entry.boarding.dropOffType === 1;
}
