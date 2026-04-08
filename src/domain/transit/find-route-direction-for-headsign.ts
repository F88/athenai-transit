import type { RouteDirection, TimetableEntry } from '../../types/app/transit-composed';

/**
 * Find a stable representative routeDirection for a selected raw headsign.
 *
 * For one grouped route+headsign bucket, entries may share the same effective
 * headsign even when some entries match via `stop_headsign` and others match
 * via `trip_headsign`. This helper makes the representative choice
 * deterministic by preferring a stop-headsign match first, then a trip-headsign
 * match, and finally falling back to the first entry when no raw source
 * matches.
 *
 * @param timetableEntries - Candidate timetable entries for one grouped headsign.
 * @param selectedHeadsign - Raw effective headsign key used for grouping.
 * @returns A representative routeDirection, or `undefined` when no entries exist.
 */
export function findRouteDirectionForHeadsign(
  timetableEntries: readonly TimetableEntry[],
  selectedHeadsign: string,
): RouteDirection | undefined {
  for (const entry of timetableEntries) {
    if (entry.routeDirection.stopHeadsign?.name === selectedHeadsign) {
      return entry.routeDirection;
    }
  }

  for (const entry of timetableEntries) {
    if (entry.routeDirection.tripHeadsign.name === selectedHeadsign) {
      return entry.routeDirection;
    }
  }

  return timetableEntries[0]?.routeDirection;
}
