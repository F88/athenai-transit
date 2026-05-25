import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';

/**
 * Build a stop_id -> route_types lookup from {@link StopWithMeta} array.
 *
 * Synchronously derives route types from each stop's `routes` field
 * (same data the repo's internal `stopRouteTypeMap` is built from in
 * `merge-sources-v2.ts`), so the result can be committed in the same
 * React render as the stops themselves — avoiding the marker-color
 * flash that an async lookup would cause.
 *
 * - Stops with empty `routes` are omitted from the map. Callers fall
 *   back to `[-1]` (Unknown) via `routeTypeMap.get(stopId) ?? [-1]` at
 *   marker render time.
 * - When the same `stop_id` appears multiple times in the input, the
 *   last occurrence wins (Map.set semantics). Callers that pass a
 *   concatenation of `inBoundStops` and `radiusStops` should be aware
 *   that the radius pass overrides the in-bounds pass for shared ids.
 * - Output `AppRouteTypeValue[]` values are deduplicated and sorted
 *   ascending so callers can compare them without re-normalizing.
 *
 * @param stops - Source stops to derive lookup entries from.
 * @returns Fresh `Map` — input is never mutated.
 */
export function buildStopRouteTypeMap(
  stops: readonly StopWithMeta[],
): Map<string, AppRouteTypeValue[]> {
  const map = new Map<string, AppRouteTypeValue[]>();
  for (const meta of stops) {
    if (meta.routes.length === 0) {
      continue;
    }
    const types = [...new Set(meta.routes.map((r) => r.route_type))].sort((a, b) => a - b);
    map.set(meta.stop.stop_id, types);
  }
  return map;
}
