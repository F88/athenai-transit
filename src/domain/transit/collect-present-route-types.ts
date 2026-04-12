import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';

/**
 * Collects unique route types present across all stops, in a stable
 * display order.
 *
 * Types listed in `routeTypeOrder` appear first, in the caller's order.
 * Duplicate values in `routeTypeOrder` are ignored after the first match.
 * Stop encounter order only determines whether a type is present; it does
 * not affect the relative order of types that are listed in `routeTypeOrder`.
 * Types not listed (extras) appear after, sorted numerically to give
 * a deterministic ordering for unknown/new route types.
 *
 * Intended for populating route-type filter UI from the current
 * nearby stops snapshot — always run on the pre-filtered list so
 * filter buttons remain visible after the user toggles a type off.
 *
 * @param stops - The list of stops to collect route types from.
 * @param routeTypeOrder - Preferred display order. Types outside this
 *   list are appended after, sorted numerically. Duplicate values are
 *   ignored after their first occurrence.
 * @returns Unique route types in display order: known types follow
 *   `routeTypeOrder`, and extras are appended in ascending numeric order.
 */
export function collectPresentRouteTypes(
  stops: readonly StopWithContext[],
  routeTypeOrder: readonly AppRouteTypeValue[],
): AppRouteTypeValue[] {
  const presentTypes = new Set<AppRouteTypeValue>();
  for (const swc of stops) {
    for (const rt of swc.routeTypes) {
      presentTypes.add(rt);
    }
  }

  const orderedTypes: AppRouteTypeValue[] = [];
  const emittedTypes = new Set<AppRouteTypeValue>();

  for (const rt of routeTypeOrder) {
    if (presentTypes.has(rt) && !emittedTypes.has(rt)) {
      emittedTypes.add(rt);
      orderedTypes.push(rt);
    }
  }

  const extras = [...presentTypes].filter((rt) => !emittedTypes.has(rt)).sort((a, b) => a - b);

  return [...orderedTypes, ...extras];
}
