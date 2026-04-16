/**
 * Check whether any stop time entry contains an empty headsign,
 * indicating that destination information is missing.
 *
 * GTFS `trip_headsign` is optional, so some data sources omit it.
 * This function is used to display a user-facing annotation when
 * routes with unknown destinations are present at a stop.
 *
 * TODO: Empty headsign does not always mean "unknown destination".
 * Circular routes (e.g. community buses like Kazaguruma) intentionally
 * have no destination because the route loops back to the origin.
 * To distinguish these cases, add a `circular` flag to RouteJson
 * (determined by whether the first and last stop_id in stop_times
 * are the same) and use it here to show different annotations:
 * - circular route → "巡回" or no annotation
 * - non-circular + empty headsign → destination unknown
 *
 * @param groups - Array of objects with a `headsign` property.
 * @returns `true` if at least one group has an empty headsign.
 */
export function hasUnknownDestination(groups: { headsign: string }[]): boolean {
  return groups.some((g) => g.headsign === '');
}
