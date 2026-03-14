/**
 * Check whether any departure group contains an empty headsign,
 * indicating that destination information is missing.
 *
 * GTFS `trip_headsign` is optional, so some data sources omit it.
 * This function is used to display a user-facing annotation when
 * routes with unknown destinations are present at a stop.
 *
 * @param groups - Array of objects with a `headsign` property.
 * @returns `true` if at least one group has an empty headsign.
 */
export function hasUnknownDestination(groups: { headsign: string }[]): boolean {
  return groups.some((g) => g.headsign === '');
}
