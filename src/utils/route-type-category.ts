/**
 * UI category key for GTFS route types.
 */
export type RouteTypeCategory = 'bus' | 'subway' | 'train' | 'others';

/**
 * Route type groups used by the UI category toggles.
 */
export const ROUTE_TYPE_CATEGORY_GROUPS: Record<RouteTypeCategory, number[]> = {
  bus: [3, 11],
  subway: [1],
  train: [0, 2, 12],
  others: [-1, 4, 5, 6, 7],
};

/**
 * Resolve a GTFS route_type into a UI category.
 * Unknown and extended values are treated as "others".
 *
 * @param routeType - GTFS route_type value.
 * @returns Category key used by UI filters and badges.
 */
export function routeTypeCategory(routeType: number): RouteTypeCategory {
  if (routeType === 3 || routeType === 11) {
    return 'bus';
  }
  if (routeType === 1) {
    return 'subway';
  }
  if (routeType === 0 || routeType === 2 || routeType === 12) {
    return 'train';
  }
  return 'others';
}

/**
 * Get the full route_type group for the category of the given route_type.
 *
 * @param routeType - GTFS route_type value.
 * @returns Route types toggled together in the UI.
 */
export function routeTypeGroup(routeType: number): number[] {
  return ROUTE_TYPE_CATEGORY_GROUPS[routeTypeCategory(routeType)];
}

/**
 * Get the emoji for a route type category.
 *
 * @param category - UI category key.
 * @returns Emoji representing the category.
 */
export function getRouteTypeCategoryEmoji(category: RouteTypeCategory): string {
  switch (category) {
    case 'bus':
      return '🚌';
    case 'subway':
      return '🚇';
    case 'train':
      return '🚆';
    case 'others':
      return '🦄';
  }
}
