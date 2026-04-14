import type { ContextualTimetableEntry, TimetableEntry } from '../../types/app/transit-composed';
import { minutesToDate } from './calendar-utils';

/**
 * Sorts {@link TimetableEntry} items by the following keys:
 *
 * 1. `schedule.departureMinutes` ascending
 * 2. `patternPosition.stopIndex` ascending
 *    (Issue #47: separates consecutive duplicate stops within a pattern,
 *    e.g. kcbus:114410 三条京阪前 ss=3 and ss=4)
 * 3. `routeDirection.route.route_id` (string compare, ascending)
 *    (separates different routes departing at the same time)
 *
 * When all three keys tie, the order is unspecified.
 *
 * Used by `getFullDayTimetableEntries` where all entries belong to the
 * same GTFS service day and overnight interleaving is not required.
 *
 * Mutates the input array in place AND returns it (for chaining).
 */
export function sortTimetableEntriesByDepartureTime<T extends TimetableEntry>(entries: T[]): T[] {
  entries.sort((a, b) => {
    // 1. departure time ascending
    const depDiff = a.schedule.departureMinutes - b.schedule.departureMinutes;
    if (depDiff !== 0) {
      return depDiff;
    }
    // 2. stopIndex ascending — separates consecutive duplicate stops
    //    within a pattern (Issue #47, e.g. kcbus:114410 三条京阪前 ss=3/4)
    const siDiff = a.patternPosition.stopIndex - b.patternPosition.stopIndex;
    if (siDiff !== 0) {
      return siDiff;
    }
    // 3. route_id ascending — separates different routes that depart
    //    at the same time at the same stop (e.g. terminals)
    return a.routeDirection.route.route_id.localeCompare(b.routeDirection.route.route_id);
    // When all three keys tie, the order is unspecified.
  });
  return entries;
}

/**
 * Sorts {@link ContextualTimetableEntry} items by the following keys:
 *
 * 1. absolute departure time ascending (via {@link minutesToDate}).
 *    Simple `departureMinutes` comparison is insufficient because overnight
 *    entries from the previous service day (e.g., prevDay + 1900 min) must
 *    interleave correctly with today's entries (e.g., today + 400 min).
 *    See Issue #66.
 * 2. `patternPosition.stopIndex` ascending
 *    (Issue #47: separates consecutive duplicate stops within a pattern,
 *    e.g. kcbus:114410 三条京阪前 ss=3 and ss=4)
 * 3. `routeDirection.route.route_id` (string compare, ascending)
 *    (separates different routes departing at the same time)
 *
 * When all three keys tie, the order is unspecified.
 *
 * ### Use case
 *
 * Used by `getUpcomingTimetableEntries` where entries from different
 * GTFS service days (today vs previous day overnight) may be mixed.
 * Typical input spans up to ~48 hours (previous day's overnight extending
 * into today + today's full service day).
 *
 * ### Time range capability
 *
 * The function itself has no inherent upper bound on the time range:
 * `absMs` is computed as a JavaScript number (safe integer range
 * ≈ 285,000 years of milliseconds), so any practical time span can be
 * sorted correctly. The ~48-hour figure above is a use-case limit, not
 * a function limit.
 *
 * ### DST correctness
 *
 * `absMs` goes through `minutesToDate` rather than adding
 * `departureMinutes * 60_000` directly to `serviceDate.getTime()`.
 * Direct ms arithmetic ignores DST jumps: on a spring-forward day in
 * a DST-using timezone (e.g. Europe/Berlin, Europe/Rome for vagfr /
 * actvnav feeds), `02:30 local + N min` differs by one hour from
 * `midnight UTC + (150 + N) * 60_000 ms`. `minutesToDate` uses
 * `setHours` which is DST-aware, preserving wall-clock semantics.
 *
 * ### Performance
 *
 * Pre-computes the absolute time once per entry (O(n)) and sorts by the
 * cached number, avoiding allocation of Date objects inside the comparator.
 * This is a hot path called frequently for nearby stops / NearbyStop list,
 * so allocation pressure inside the sort comparator is deliberately avoided.
 *
 * Mutates the input array in place AND returns it (for chaining).
 */
export function sortTimetableEntriesChronologically<T extends ContextualTimetableEntry>(
  entries: T[],
): T[] {
  // Pre-compute absolute time per entry (once, not per comparison).
  // Uses `minutesToDate` to stay DST-aware: direct `+ minutes * 60_000`
  // arithmetic would diverge on spring-forward / fall-back days in
  // DST-using timezones (see the "DST correctness" section above).
  // The Date allocation cost is paid O(n) times, not O(n log n).
  const withTime = entries.map((entry) => ({
    entry,
    absMs: minutesToDate(entry.serviceDate, entry.schedule.departureMinutes).getTime(),
  }));
  withTime.sort((a, b) => {
    // 1. absolute departure time ascending
    const timeDiff = a.absMs - b.absMs;
    if (timeDiff !== 0) {
      return timeDiff;
    }
    // 2. stopIndex ascending — separates consecutive duplicate stops
    //    within a pattern (Issue #47, e.g. kcbus:114410 三条京阪前 ss=3/4)
    const siDiff = a.entry.patternPosition.stopIndex - b.entry.patternPosition.stopIndex;
    if (siDiff !== 0) {
      return siDiff;
    }
    // 3. route_id ascending — separates different routes that depart
    //    at the same time at the same stop (e.g. terminals)
    return a.entry.routeDirection.route.route_id.localeCompare(
      b.entry.routeDirection.route.route_id,
    );
    // When all three keys tie, the order is unspecified.
  });
  // Mutate the input array to reflect the sorted order.
  for (let i = 0; i < entries.length; i++) {
    entries[i] = withTime[i].entry;
  }
  return entries;
}
