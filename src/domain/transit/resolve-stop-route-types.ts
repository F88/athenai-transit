import type { AppRouteTypeValue, Route } from '../../types/app/transit';

/**
 * Policy for handling unresolved stop route types.
 */
export type UnknownRouteTypePolicy = 'include-unknown' | 'exclude-unknown';

/**
 * Arguments for {@link resolveStopRouteTypes}.
 */
export interface ResolveStopRouteTypesArgs {
  /** GTFS stop_id. */
  stopId: string;
  /** Precomputed stop_id -> route_types lookup map. */
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>;
  /** Optional routes associated with the stop (used as fallback source). */
  routes: ReadonlyArray<Pick<Route, 'route_type'>> | null;
  /** Required policy for unresolved route type handling. */
  unknownPolicy: UnknownRouteTypePolicy;
}

/**
 * Resolve route types for a stop from lookup map and optional route list.
 *
 * Resolution order:
 * 1. `routeTypeMap` entry for stopId (when non-empty)
 * 2. deduplicated + ascending route_type values from `routes`
 * 3. unknown fallback by `unknownPolicy`
 *
 * @param args - Resolution inputs and unknown handling policy.
 * @returns Resolved route type array.
 */
export function resolveStopRouteTypes(args: ResolveStopRouteTypesArgs): AppRouteTypeValue[] {
  const fromMap = args.routeTypeMap.get(args.stopId);
  if (fromMap && fromMap.length > 0) {
    return fromMap;
  }

  if (args.routes && args.routes.length > 0) {
    return [...new Set(args.routes.map((route) => route.route_type))].sort((a, b) => a - b);
  }

  if (args.unknownPolicy === 'include-unknown') {
    return [-1];
  }

  return [];
}
