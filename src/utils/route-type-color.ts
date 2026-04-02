/**
 * Background color for each GTFS route_type.
 */
const ROUTE_TYPE_COLORS: Record<number, string> = {
  0: '#f57f17',
  1: '#7b1fa2',
  2: '#1565c0',
  3: '#2e7d32',
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
