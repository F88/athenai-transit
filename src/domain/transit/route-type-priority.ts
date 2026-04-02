/**
 * Select the primary route_type from multiple types.
 *
 * Bus (3) is prioritized as this is a bus-first app.
 * Falls back to the largest value among the remaining types.
 *
 * @param routeTypes - Array of GTFS route_type values.
 * @returns The primary route_type for display purposes.
 */
export function primaryRouteType(routeTypes: number[]): number {
  if (routeTypes.length === 0) {
    return 3;
  }
  if (routeTypes.includes(3)) {
    return 3;
  }
  return Math.max(...routeTypes);
}
