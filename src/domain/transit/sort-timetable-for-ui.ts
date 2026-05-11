/**
 * @module sort-timetable-for-ui
 *
 * UI-facing sort helpers for timetable entries.
 *
 * Unlike {@link ./sort-timetable-entries} which provides canonical
 * data-layer orderings keyed on `schedule.departureMinutes`, the helpers
 * here key on the time value that the UI actually renders for each entry
 * (`getDisplayMinutes` — `arrivalMinutes` for terminal stops, otherwise
 * `departureMinutes`). Use them at the UI consumer just before render so
 * the visible `:MM` labels read chronologically (Issue #63).
 */

import type { ContextualTimetableEntry, TimetableEntry } from '../../types/app/transit-composed';
import { minutesToDate } from './calendar-utils';
import { getDisplayMinutes } from './timetable-utils';

/**
 * Sort entries so their visible `:MM` labels read chronologically.
 *
 * Keys are UI-meaningful only — time values plus origin / terminal flags.
 * Pattern and route identity (route_id, stopIndex, etc.) is intentionally
 * excluded as it has no meaning for the visible ordering. See Issue #63
 * for the underlying display-vs-departure mismatch this corrects.
 *
 * Mutates the input array in place AND returns it (for chaining).
 */
export function sortTimetableEntriesByDisplayTime<T extends TimetableEntry>(entries: T[]): T[] {
  entries.sort((a, b) => {
    // 1. display minute ascending (arrival for terminals, else departure)
    const displayDiff = getDisplayMinutes(a) - getDisplayMinutes(b);
    if (displayDiff !== 0) {
      return displayDiff;
    }
    // 2. arrival minute ascending — earlier arrival first
    const arrivalDiff = a.schedule.arrivalMinutes - b.schedule.arrivalMinutes;
    if (arrivalDiff !== 0) {
      return arrivalDiff;
    }
    // 3. departure minute ascending — earlier departure first
    const departureDiff = a.schedule.departureMinutes - b.schedule.departureMinutes;
    if (departureDiff !== 0) {
      return departureDiff;
    }
    // 4. isOrigin first — true (origin) sorts before false
    if (a.patternPosition.isOrigin !== b.patternPosition.isOrigin) {
      return a.patternPosition.isOrigin ? -1 : 1;
    }
    // 5. isTerminal first — true (terminal) sorts before false
    if (a.patternPosition.isTerminal !== b.patternPosition.isTerminal) {
      return a.patternPosition.isTerminal ? -1 : 1;
    }
    // When all five keys tie, the order is unspecified.
    return 0;
  });
  return entries;
}

/**
 * Cross-service-day variant of {@link sortTimetableEntriesByDisplayTime}.
 *
 * Each entry is projected to absolute time via
 * `minutesToDate(serviceDate, ...)` before comparison, so a list that
 * interleaves the previous service day's overnight tail with today's
 * entries (typical for `getUpcomingTimetableEntries`) reads in true
 * chronological order. `minutesToDate` is DST-aware, matching the
 * behaviour of {@link ./sort-timetable-entries.sortTimetableEntriesChronologically}.
 *
 * Sort keys mirror the within-day variant but operate on absolute time:
 * display → arrival → departure → isOrigin (true first) → isTerminal
 * (true first). When all five keys tie, the order is unspecified.
 *
 * Mutates the input array in place AND returns it (for chaining).
 */
export function sortTimetableEntriesByDisplayTimeChronologically<
  T extends ContextualTimetableEntry,
>(entries: T[]): T[] {
  // Pre-compute each entry's absolute display / arrival / departure times
  // once (O(n)) and sort by the cached numbers, mirroring the allocation
  // discipline of `sortTimetableEntriesChronologically`.
  const decorated = entries.map((entry) => ({
    entry,
    displayMs: minutesToDate(entry.serviceDate, getDisplayMinutes(entry)).getTime(),
    arrivalMs: minutesToDate(entry.serviceDate, entry.schedule.arrivalMinutes).getTime(),
    departureMs: minutesToDate(entry.serviceDate, entry.schedule.departureMinutes).getTime(),
  }));
  decorated.sort((a, b) => {
    // 1. absolute display time ascending
    const displayDiff = a.displayMs - b.displayMs;
    if (displayDiff !== 0) {
      return displayDiff;
    }
    // 2. absolute arrival time ascending
    const arrivalDiff = a.arrivalMs - b.arrivalMs;
    if (arrivalDiff !== 0) {
      return arrivalDiff;
    }
    // 3. absolute departure time ascending
    const departureDiff = a.departureMs - b.departureMs;
    if (departureDiff !== 0) {
      return departureDiff;
    }
    // 4. isOrigin first — true (origin) sorts before false
    if (a.entry.patternPosition.isOrigin !== b.entry.patternPosition.isOrigin) {
      return a.entry.patternPosition.isOrigin ? -1 : 1;
    }
    // 5. isTerminal first — true (terminal) sorts before false
    if (a.entry.patternPosition.isTerminal !== b.entry.patternPosition.isTerminal) {
      return a.entry.patternPosition.isTerminal ? -1 : 1;
    }
    // When all five keys tie, the order is unspecified.
    return 0;
  });
  // Mutate the input array to reflect the sorted order.
  for (let i = 0; i < entries.length; i++) {
    entries[i] = decorated[i].entry;
  }
  return entries;
}
