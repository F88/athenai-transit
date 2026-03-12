/**
 * Default map center and zoom level.
 *
 * Center coordinates are read from `VITE_INITIAL_LAT_LNG` (comma-separated
 * "lat,lng") so that developers can override them per environment
 * (e.g. `.env.development`).
 */
// Fallback: Tokyo Station (東京駅) [35.6812, 139.7671]
const FALLBACK_CENTER: [number, number] = [35.6812, 139.7671];

function parseLatLng(value: string | undefined): [number, number] {
  if (!value) {
    return FALLBACK_CENTER;
  }
  const [lat, lng] = value.split(',').map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return FALLBACK_CENTER;
  }
  return [lat, lng];
}

export const INITIAL_CENTER: [number, number] = parseLatLng(import.meta.env.VITE_INITIAL_LAT_LNG);

export const INITIAL_ZOOM = 16;
