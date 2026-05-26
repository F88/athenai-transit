import type { StopWithMeta } from '../../types/app/transit-composed';

export function findVisibleStopMetaById(
  stopId: string,
  radiusStops: readonly StopWithMeta[],
  inBoundStops: readonly StopWithMeta[],
): StopWithMeta | null {
  return (
    radiusStops.find((stopMeta) => stopMeta.stop.stop_id === stopId) ??
    inBoundStops.find((stopMeta) => stopMeta.stop.stop_id === stopId) ??
    null
  );
}

/**
 * Look up a stop's live `StopWithMeta` from a pre-built map keyed by
 * `stop_id`. Returns `null` when the id is absent (rather than
 * `undefined` from `Map.get`) so call sites can fall through to
 * persisted-snapshot fallbacks consistently.
 *
 * Used to back curried lookup callbacks like `lookupAnchorStopMeta` /
 * `lookupHistoryStopMeta` in `App`: the call site captures the map in
 * a `useCallback` closure and exposes the `(stopId) => ...` signature
 * that consumers (Portal, StopHistory dropdown, navigation payload
 * builder) depend on.
 *
 * @param stopId - Persisted stop id to resolve.
 * @param metaMap - Pre-built map of currently resolvable
 * `StopWithMeta` entries.
 * @returns The matching `StopWithMeta`, or `null` when not present.
 */
export function lookupStopMetaFromMap(
  stopId: string,
  metaMap: ReadonlyMap<string, StopWithMeta>,
): StopWithMeta | null {
  return metaMap.get(stopId) ?? null;
}
