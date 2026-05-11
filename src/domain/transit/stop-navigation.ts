import type { Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';

export function findNavigableStopMeta(
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

export function resolveNavigableStopMeta(
  stopId: string,
  radiusStops: readonly StopWithMeta[],
  inBoundStops: readonly StopWithMeta[],
  fallbackStop?: Stop,
): StopWithMeta | null {
  return (
    findNavigableStopMeta(stopId, radiusStops, inBoundStops) ??
    (fallbackStop ? { stop: fallbackStop, agencies: [], routes: [] } : null)
  );
}
