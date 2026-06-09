import type { Route } from '../../types/app/transit';

/**
 * Distinct-entity counts over a set of routes.
 *
 * The shared core of the stop / entry stat helpers: given any collection of
 * routes (duplicates allowed), it counts the distinct routes, agencies, and
 * route types. Agencies are taken from each route's `agency_id`.
 */
export interface RouteStats {
  /** Distinct routes (`route_id`). */
  routeCount: number;
  /** Distinct agencies (`agency_id`). */
  agencyCount: number;
  /** Distinct route types (a missing `route_type` is not counted). */
  routeTypeCount: number;
}

/**
 * Compute {@link RouteStats} for a set of routes in a single pass.
 *
 * Deduplicates by `route_id` / `agency_id` / `route_type`. The `route_type`
 * accumulation uses a `!= null` guard so valid 0 / -1 are kept while a missing
 * value is dropped.
 *
 * @param routes - The routes to summarize (duplicates allowed).
 * @returns The distinct-entity counts.
 */
export function computeRouteStats(routes: readonly Route[]): RouteStats {
  const routeIds = new Set<string>();
  const agencyIds = new Set<string>();
  const routeTypes = new Set<number>();

  for (const route of routes) {
    routeIds.add(route.route_id);
    agencyIds.add(route.agency_id);
    if (route.route_type != null) {
      routeTypes.add(route.route_type);
    }
  }

  return {
    routeCount: routeIds.size,
    agencyCount: agencyIds.size,
    routeTypeCount: routeTypes.size,
  };
}
