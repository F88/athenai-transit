/**
 * @module timetable-entry-schedule
 *
 * Schedule reading helpers over a single {@link TimetableEntry}:
 * which time to display, dwell time, and remaining travel time.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';

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
