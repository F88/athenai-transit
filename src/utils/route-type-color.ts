import { APP_ROUTE_TYPES } from '../config/route-types';

/**
 * Background color for each GTFS route_type.
 */
const ROUTE_TYPE_COLORS: Readonly<Record<number, string>> = APP_ROUTE_TYPES.reduce<
  Record<number, string>
>((acc, { value, color }) => {
  acc[value] = color;
  return acc;
}, {});

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
