import type L from 'leaflet';

/**
 * Set the map zoom level, clamped to the allowed range.
 * Does nothing if the target zoom equals the current zoom.
 *
 * @param map - Leaflet map instance.
 * @param zoom - Desired zoom level.
 */
export function setZoomLevel(map: L.Map, zoom: number): void {
  const currentZoom = map.getZoom();
  const nextZoom = Math.max(map.getMinZoom(), Math.min(zoom, map.getMaxZoom()));
  if (nextZoom === currentZoom) {
    return;
  }

  map.setZoom(nextZoom, { animate: true });
}

/**
 * Change the map zoom by a relative delta (+1 or -1), clamped to the allowed range.
 *
 * @param map - Leaflet map instance.
 * @param delta - Zoom increment: `1` to zoom in, `-1` to zoom out.
 */
export function changeZoom(map: L.Map, delta: 1 | -1): void {
  setZoomLevel(map, map.getZoom() + delta);
}
