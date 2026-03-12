import type { RouteType, StopWithMeta } from '../../types/app/transit';
import { isRouteTypeVisible } from './route-type-color';

/** Default GTFS route_types used when a stop has no entry in routeTypeMap. */
const DEFAULT_ROUTE_TYPES: RouteType[] = [3];

/**
 * Filters stops to only those with at least one visible route type.
 *
 * Stops not found in `routeTypeMap` are treated as route_type `[3]` (bus).
 *
 * @param stops - The list of stops to filter.
 * @param routeTypeMap - Map of stop ID to GTFS route_type array.
 * @param visibleTypes - Set of route_type values to include.
 * @returns The filtered list of stops.
 */
export function filterStopsByType(
  stops: StopWithMeta[],
  routeTypeMap: Map<string, RouteType[]>,
  visibleTypes: Set<number>,
): StopWithMeta[] {
  return stops.filter((s) =>
    isRouteTypeVisible(routeTypeMap.get(s.stop.stop_id) ?? DEFAULT_ROUTE_TYPES, visibleTypes),
  );
}

/**
 * Excludes stops whose stop_id is in the given set.
 *
 * @param stops - The list of stops to filter.
 * @param ids - Set of stop IDs to exclude.
 * @returns The filtered list of stops.
 */
export function excludeStopsByIds(stops: StopWithMeta[], ids: Set<string>): StopWithMeta[] {
  return stops.filter((s) => !ids.has(s.stop.stop_id));
}
