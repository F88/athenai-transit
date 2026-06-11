/**
 * @module timetable-service-state
 *
 * Service-state derivation for timetable display. Lifts the entry-level
 * boarding judgments to collections ({@link hasBoardable}) and derives
 * the {@link StopServiceState} / {@link TimetableEntriesState} /
 * {@link FilteredTimetableEntriesState} values the UI renders.
 */

import type { TimetableEntry } from '../../types/app/transit-composed';
import type {
  FilteredTimetableEntriesState,
  StopServiceState,
  StopServiceStateInput,
  TimetableEntriesState,
} from '../../types/app/transit';
import { isDropOffOnly } from './timetable-entry-boarding';

/**
 * Whether at least one entry in the list is boardable (not drop-off only).
 *
 * Works at any grouping level:
 * - **Stop level**: pass all entries for a stop → "is this stop boardable?"
 * - **Route+headsign level**: pass grouped entries → "is this group boardable?"
 *
 * Returns false for an empty list (no stop times = nothing to board).
 */
export function hasBoardable(entries: TimetableEntry[]): boolean {
  return entries.some((entry) => !isDropOffOnly(entry));
}

/**
 * Derive the service state from a collection of timetable entries.
 *
 * Unlike {@link getStopServiceState} which takes pre-computed signals,
 * this function inspects the entries directly. It can be applied to
 * any subset: full-day, upcoming, filtered by route/headsign, or a
 * specific time window.
 *
 * @param entries - The timetable entries to evaluate.
 * @returns The service state of the entries collection.
 */
export function getTimetableEntriesState(entries: TimetableEntry[]): TimetableEntriesState {
  if (entries.length === 0) {
    return 'no-service';
  }
  if (!hasBoardable(entries)) {
    return 'drop-off-only';
  }
  return 'boardable';
}

/**
 * Derive the stop service state from service day signals.
 *
 * Signals are passed as a narrow structural object (see
 * {@link StopServiceStateInput}) rather than the full `TimetableQueryMeta`,
 * which allows the repository layer to compute the state during meta
 * construction without a circular type dependency.
 *
 * @param input - Minimal service day signals.
 * @returns The service state of the stop for that service day.
 */
export function getStopServiceState(input: StopServiceStateInput): StopServiceState {
  if (input.totalEntries === 0) {
    return 'no-service';
  }
  if (!input.isBoardableOnServiceDay) {
    return 'drop-off-only';
  }
  return 'boardable';
}

/**
 * Combine the repo's full-day {@link StopServiceState} with the state
 * of the pre-filter upcoming entries and the state of the post-filter
 * entries into a unified {@link FilteredTimetableEntriesState} for UI
 * display.
 *
 * Distinguishes the three "empty display" scenarios that the simpler
 * two-state check in {@link getTimetableEntriesState} cannot tell apart:
 *
 * 1. `stopServiceState === 'no-service'` → `'no-service'`
 *    (repo has no timetable data for this stop at all)
 * 2. `upcomingEntriesState === 'no-service'` → `'service-ended'`
 *    (repo has data today but the upcoming window is already empty
 *    pre-filter — late-night / service ended for today)
 * 3. `filteredEntriesState === 'no-service'` → `'filter-hidden'`
 *    (pre-filter upcoming had entries but the user's UI filters removed
 *    everything)
 * 4. otherwise → `filteredEntriesState` (`'boardable'` or
 *    `'drop-off-only'`)
 *
 * All three inputs are already-derived state values, so the function is
 * purely combinatorial and has no entry-scanning cost. Callers typically
 * compute `upcomingEntriesState` / `filteredEntriesState` via
 * {@link getTimetableEntriesState}.
 *
 * @param stopServiceState - Full-day service state (from repo meta via
 *   {@link getStopServiceState}).
 * @param upcomingEntriesState - Pre-filter upcoming entries state.
 * @param filteredEntriesState - Post-filter entries state.
 * @returns Unified display state for the filtered view.
 */
export function getFilteredTimetableEntriesState(
  stopServiceState: StopServiceState,
  upcomingEntriesState: TimetableEntriesState,
  filteredEntriesState: TimetableEntriesState,
): FilteredTimetableEntriesState {
  if (stopServiceState === 'no-service') {
    return 'no-service';
  }
  if (upcomingEntriesState === 'no-service') {
    return 'service-ended';
  }
  if (filteredEntriesState === 'no-service') {
    return 'filter-hidden';
  }
  return filteredEntriesState;
}
