import type L from 'leaflet';
import type { RouteType, Stop } from '../types/app/transit';
import type { EdgeMarker } from '../types/app/map';
import { createLogger } from '../utils/logger';

const logger = createLogger('EdgeMarker');

/** Padding in pixels from the viewport edge. */
const EDGE_PADDING = 20;

/**
 * Calculate screen-space positions for edge markers representing
 * off-screen transit stops.
 *
 * Each stop is projected onto the nearest point on the viewport edge,
 * preserving the angular direction from the screen center. This lets
 * users see which direction to walk to reach the stop.
 *
 * @param map - Leaflet map instance (used for coordinate projection).
 * @param edgeStops - Stops that are outside the current viewport.
 * @param routeTypeMap - Map from stop_id to GTFS route_type array.
 * @param topPadding - Extra top padding in pixels (e.g. for iOS safe-area-inset-top).
 * @param bottomPadding - Extra bottom padding in pixels (e.g. for a bottom sheet).
 * @returns Array of {@link EdgeMarker} with screen coordinates and metadata.
 */
export function buildEdgeMarkers(
  map: L.Map,
  edgeStops: Stop[],
  routeTypeMap: Map<string, RouteType[]>,
  topPadding: number,
  bottomPadding: number,
): EdgeMarker[] {
  const size = map.getSize();
  const cx = size.x / 2;
  const cy = size.y / 2;

  // Effective top boundary accounts for safe-area (Dynamic Island / notch).
  const minY = Math.min(cy - 1, Math.max(EDGE_PADDING, topPadding));
  // Effective bottom boundary accounts for the bottom sheet.
  // Clamp so that maxY never goes above the center (prevents negative bottomHalf).
  const maxY = Math.max(cy + 1, size.y - bottomPadding - EDGE_PADDING);

  const center = map.getCenter();
  const inViewCount = { value: 0 };
  const result = edgeStops.flatMap((stop) => {
    const point = map.latLngToContainerPoint([stop.stop_lat, stop.stop_lon]);

    // Skip stops that are currently within the viewport
    if (point.x >= 0 && point.x <= size.x && point.y >= 0 && point.y <= size.y) {
      inViewCount.value++;
      return [];
    }

    const dx = point.x - cx;
    const dy = point.y - cy;
    const angle = Math.atan2(dy, dx);

    // Scale factor to reach viewport edge from center
    const halfW = cx - EDGE_PADDING;
    // Use the distance from center to the effective top/bottom boundaries
    const topHalf = cy - minY;
    const bottomHalf = maxY - cy;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Avoid division by zero when stop is exactly at center
    let scale: number;
    if (absDx < 1 && absDy < 1) {
      scale = 1;
    } else {
      const scaleX = absDx > 0 ? halfW / absDx : Infinity;
      const halfH = dy > 0 ? bottomHalf : topHalf;
      const scaleY = absDy > 0 ? halfH / absDy : Infinity;
      scale = Math.min(scaleX, scaleY);
    }

    const x = Math.max(EDGE_PADDING, Math.min(size.x - EDGE_PADDING, cx + dx * scale));
    const y = Math.max(minY, Math.min(maxY, cy + dy * scale));

    const hAlign =
      x <= EDGE_PADDING + 1
        ? ('left' as const)
        : x >= size.x - EDGE_PADDING - 1
          ? ('right' as const)
          : ('center' as const);

    const routeTypes = routeTypeMap.get(stop.stop_id) ?? [3 as RouteType];
    // Recalculate distance here instead of reusing StopWithMeta.distance because:
    // 1. The center shifts on every pan, so the repo's snapshot distance is stale.
    // 2. map.distance() uses haversine, which is more accurate than the repo's flat-earth approximation.
    const distance = map.distance(center, [stop.stop_lat, stop.stop_lon]);
    return [{ stop, routeTypes, x, y, angle, hAlign, distance }];
  });

  logger.verbose(
    `total=${edgeStops.length} inView=${inViewCount.value} edge=${result.length}`,
    result.map((m) => `${m.stop.stop_name}(${m.hAlign},${Math.round(m.x)},${Math.round(m.y)})`),
  );

  // Sort by distance descending so that closer markers are rendered last
  // (appearing on top in both DOM z-order and Canvas paint order).
  result.sort((a, b) => b.distance - a.distance);

  return result;
}
