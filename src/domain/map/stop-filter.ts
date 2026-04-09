import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import { isRouteTypeVisible } from './route-type-visibility';

/** Default route_types used when a stop has no entry in routeTypeMap. */
const DEFAULT_ROUTE_TYPES: AppRouteTypeValue[] = [-1];

/**
 * Filters stops to only those with at least one visible route type.
 *
 * Stops not found in `routeTypeMap` are treated as route_type `[-1]` (unknown).
 */
export function filterStopsByType(
  stops: StopWithMeta[],
  routeTypeMap: Map<string, AppRouteTypeValue[]>,
  visibleTypes: Set<number>,
): StopWithMeta[] {
  return stops.filter((s) =>
    isRouteTypeVisible(routeTypeMap.get(s.stop.stop_id) ?? DEFAULT_ROUTE_TYPES, visibleTypes),
  );
}

/**
 * Excludes stops whose stop_id is in the given set.
 */
export function excludeStopsByIds(stops: StopWithMeta[], ids: Set<string>): StopWithMeta[] {
  return stops.filter((s) => !ids.has(s.stop.stop_id));
}
