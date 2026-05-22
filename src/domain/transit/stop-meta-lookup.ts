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
