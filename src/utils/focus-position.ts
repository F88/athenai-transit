import type { LatLng } from '../types/app/map';
import type { StopWithMeta } from '../types/app/transit-composed';

/**
 * Resolves the map focus position based on direct focus and selected stop.
 *
 * Priority:
 * 1. `directFocusPosition` if set (from focusStop — search/history).
 * 2. The position of the selected stop (looked up in radiusStops then inBoundStops).
 * 3. `null` if nothing is selected.
 *
 * @param directFocusPosition - Position set by focusStop, or null.
 * @param selectedStopId - Currently selected stop ID, or null.
 * @param radiusStops - Stops within the nearby radius.
 * @param inBoundStops - Stops within the current map viewport.
 * @returns The resolved focus position, or null.
 */
export function resolveFocusPosition(
  directFocusPosition: LatLng | null,
  selectedStopId: string | null,
  radiusStops: StopWithMeta[],
  inBoundStops: StopWithMeta[],
): LatLng | null {
  if (directFocusPosition) {
    return directFocusPosition;
  }
  if (!selectedStopId) {
    return null;
  }
  const meta = radiusStops.find((s) => s.stop.stop_id === selectedStopId);
  if (meta) {
    return { lat: meta.stop.stop_lat, lng: meta.stop.stop_lon };
  }
  const inBound = inBoundStops.find((s) => s.stop.stop_id === selectedStopId);
  if (!inBound) {
    return null;
  }
  return { lat: inBound.stop.stop_lat, lng: inBound.stop.stop_lon };
}
