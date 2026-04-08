import type { RouteDirection } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from './get-effective-headsign';

/**
 * Build a stable grouping key for a route and its effective headsign.
 *
 * The null-byte separator avoids collisions between route IDs and
 * headsign strings while remaining opaque to UI callers.
 *
 * @param routeDirection - Route direction to identify.
 * @returns Stable route+headsign grouping key.
 */
export function getRouteHeadsignKey(routeDirection: RouteDirection): string {
  return `${routeDirection.route.route_id}\0${getEffectiveHeadsign(routeDirection)}`;
}
