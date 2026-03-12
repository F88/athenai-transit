import L from 'leaflet';
import type { Bounds, LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import { createInfoLevel } from '../utils/create-info-level';
import { routeTypeLabel } from '../domain/transit/route-type-label';

/**
 * Escape HTML special characters to prevent XSS when embedding in HTML strings.
 *
 * @param text - Raw text to escape.
 * @returns HTML-safe string.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create a simple route-type icon with a single-char label (B/M/T/駅).
 *
 * @param routeType - GTFS route_type value.
 * @param selected - Whether the stop is currently selected.
 * @returns A configured Leaflet {@link L.DivIcon}.
 */
function createStopIconSimple(routeType: number, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 24;
  const selectedClass = selected ? 'stop-icon-selected' : '';

  let iconClass: string;
  if (routeType === 3) {
    iconClass = 'stop-icon-bus';
  } else if (routeType === 1) {
    iconClass = 'stop-icon-subway';
  } else if (routeType === 0) {
    iconClass = 'stop-icon-tram';
  } else {
    iconClass = 'stop-icon-station';
  }
  const rawLabel = routeTypeLabel(routeType);
  // Tram label needs a wrapping span for styling
  const label =
    routeType === 0 ? `<span class="stop-icon-tram-label">${rawLabel}</span>` : rawLabel;

  return L.divIcon({
    className: '',
    html: `<div class="${iconClass} ${selectedClass}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Create a square icon with 4-char truncated stop name and full label below.
 *
 * @param routeType - GTFS route_type value (used for background color).
 * @param selected - Whether the stop is currently selected.
 * @param stopName - Stop name to display.
 * @param infoLevel - Controls marker appearance based on verbosity level.
 * @returns A configured Leaflet {@link L.DivIcon}.
 */
function createStopIconDetailed(
  routeType: number,
  selected: boolean,
  stopName: string,
  infoLevel: InfoLevel,
): L.DivIcon {
  const safe = escapeHtml(stopName);
  const chars = safe.slice(0, 4);
  const line1 = chars.slice(0, 2);
  const line2 = chars.slice(2);
  const label = line2 ? `${line1}<br>${line2}` : line1;
  const color = getRouteTypeColor(routeType);
  const cls = selected ? 'stop-icon-name stop-icon-name-selected' : 'stop-icon-name';
  const nameLabel = createInfoLevel(infoLevel).isDetailedEnabled
    ? `<span class="stop-icon-label">${safe}</span>`
    : '';
  const size = selected ? 40 : 32;
  return L.divIcon({
    className: '',
    html: `<div class="${cls}" style="background:${color}">${label}</div>${nameLabel}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Create a Leaflet DivIcon for a transit stop marker.
 *
 * Delegates to {@link createStopIconSimple} or {@link createStopIconDetailed}
 * based on the current info level.
 *
 * @param routeType - GTFS route_type value.
 * @param selected - Whether the stop is currently selected.
 * @param stopName - Stop name to display.
 * @param infoLevel - Controls marker appearance based on verbosity level.
 * @returns A configured Leaflet {@link L.DivIcon}.
 */
export function createStopIcon(
  routeType: number,
  selected: boolean,
  stopName: string,
  infoLevel: InfoLevel,
): L.DivIcon {
  return createInfoLevel(infoLevel).isNormalEnabled
    ? createStopIconDetailed(routeType, selected, stopName, infoLevel)
    : createStopIconSimple(routeType, selected);
}

/**
 * Map a GTFS route_type to its display color.
 *
 * Colors are kept in sync with the CSS classes used by {@link createStopIcon}.
 *
 * @param routeType - GTFS route_type value (0–3).
 * @returns Hex color string.
 */
export function getRouteTypeColor(routeType: number): string {
  switch (routeType) {
    case 0:
      return '#f57f17'; // tram
    case 1:
      return '#7b1fa2'; // subway
    case 2:
      return '#1565c0'; // rail
    case 3:
      return '#2e7d32'; // bus
    default:
      return '#616161'; // unknown
  }
}

/** Threshold in degrees (~50m) below which flyTo is skipped to avoid jitter. */
const SMOOTH_MOVE_THRESHOLD = 0.0005;

/**
 * Pan or fly the map to a target position, choosing the appropriate
 * animation based on distance.
 *
 * If the map center is already within ~50 m of the target (and zoom
 * matches), `setView` is used to avoid unnecessary animation jitter.
 * Otherwise, `flyTo` provides a smooth transition.
 *
 * @param map - Leaflet map instance.
 * @param target - Target coordinates as `[lat, lng]`.
 * @param zoom - Desired zoom level.
 */
export function smoothMoveTo(map: L.Map, target: [number, number], zoom: number): void {
  const c = map.getCenter();
  const dist = Math.abs(c.lat - target[0]) + Math.abs(c.lng - target[1]);
  if (dist < SMOOTH_MOVE_THRESHOLD && map.getZoom() === zoom) {
    map.setView(target, zoom);
  } else {
    map.flyTo(target, zoom, { duration: 1.0 });
  }
}

/**
 * Extract the current map viewport as a {@link Bounds} object.
 *
 * @param map - Leaflet map instance.
 * @returns Bounding box with north/south/east/west coordinates.
 */
export function toBounds(map: L.Map): Bounds {
  const b = map.getBounds();
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

/**
 * Extract the current map center as a {@link LatLng} object.
 *
 * @param map - Leaflet map instance.
 * @returns Center point with `lat` and `lng` properties.
 */
export function toCenter(map: L.Map): LatLng {
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}
