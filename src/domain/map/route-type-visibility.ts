/**
 * Whether a stop with the given route types should be visible
 * given the set of visible types.
 *
 * Returns true if at least one route type is in the visible set.
 *
 * @param routeTypes - Array of GTFS route_type values for the stop.
 * @param visibleTypes - Set of route_type values currently visible.
 * @returns True if at least one route type is visible.
 */
export function isRouteTypeVisible(routeTypes: number[], visibleTypes: Set<number>): boolean {
  return routeTypes.some((routeType) => visibleTypes.has(routeType));
}
