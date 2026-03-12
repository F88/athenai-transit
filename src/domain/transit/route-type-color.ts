/**
 * Background color for each GTFS route_type.
 *
 * Used for route type filter buttons, edge markers, and other UI elements
 * that need color-coding by transit mode.
 */
const ROUTE_TYPE_COLORS: Record<number, string> = {
  0: '#f57f17', // tram (amber)
  1: '#7b1fa2', // subway (purple)
  2: '#1565c0', // rail (blue)
  3: '#2e7d32', // bus (green)
};

const DEFAULT_ROUTE_TYPE_COLOR = '#616161';

/**
 * Return the display color for a GTFS route_type.
 *
 * @param routeType - GTFS route_type value.
 * @returns Hex color string.
 */
export function routeTypeColor(routeType: number): string {
  return ROUTE_TYPE_COLORS[routeType] ?? DEFAULT_ROUTE_TYPE_COLOR;
}

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
  return routeTypes.some((rt) => visibleTypes.has(rt));
}
