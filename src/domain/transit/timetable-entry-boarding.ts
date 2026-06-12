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
 */
export function isNoPassengerService(entry: TimetableEntry): boolean {
  return entry.boarding.pickupType === 1 && entry.boarding.dropOffType === 1;
}
