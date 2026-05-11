import type { TimetableEntry } from '../../types/app/transit-composed';
import { getDisplayMinutes } from './timetable-utils';

/**
 * Group entries into hour buckets keyed by displayed time.
 *
 * Both the bucket key and the within-bucket order are taken straight from
 * the input — entries land in the bucket of `floor(getDisplayMinutes / 60)`
 * in first-encounter order. Callers that need a chronological display
 * (Issue #63) should pre-sort with `sortTimetableEntriesByDisplayTime`;
 * both the hour-key iteration order and the within-bucket order then read
 * correctly because Map preserves insertion order.
 */
export function groupTimetableEntriesByHour<T extends TimetableEntry>(
  entries: readonly T[],
): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const entry of entries) {
    const hour = Math.floor(getDisplayMinutes(entry) / 60);
    const list = groups.get(hour);
    if (list) {
      list.push(entry);
    } else {
      groups.set(hour, [entry]);
    }
  }
  return groups;
}
