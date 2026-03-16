/**
 * Default map center and zoom level.
 *
 * Resolution priority:
 * 1. URL query params (`?lat=...&lng=...&zm=...`)
 * 2. Env variables (`VITE_INITIAL_LAT_LNG`, `VITE_INITIAL_ZOOM_LEVEL`)
 * 3. Random selection from {@link HOME_LOCATIONS}
 *
 * Each param is resolved independently — e.g. `?zm=14` with no lat/lng
 * will use random center but override zoom to 14.
 */

import { parseQueryLat, parseQueryLng, parseQueryZoom } from '../utils/query-params';
import { createLogger } from '../utils/logger';

/**
 * Curated locations for random initial display.
 *
 * Each entry is a place where multiple transit lines intersect or
 * interesting route patterns exist, giving first-time users an
 * immediate sense of "where can I go from here?".
 */
const HOME_LOCATIONS = [
  { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671, zoom: 15 },
  { name: 'Kumano-mae', lat: 35.7485, lng: 139.7699, zoom: 15 },
  { name: 'Kinshicho Station', lat: 35.6967, lng: 139.8139, zoom: 17 },
  { name: 'Tokyo Big Sight', lat: 35.6302, lng: 139.793, zoom: 18 },
  { name: 'Shibuya Station', lat: 35.6591, lng: 139.7026, zoom: 16 },
  { name: 'Otsuka Station', lat: 35.731, lng: 139.7291, zoom: 18 },
  { name: 'Nerima Station', lat: 35.7379, lng: 139.6542, zoom: 18 },
  { name: 'Chiyoda City Hall', lat: 35.6948, lng: 139.7533, zoom: 16 },
  { name: 'Ikebukuro Station', lat: 35.7299, lng: 139.7108, zoom: 16 },
  { name: 'Shinjuku Station West', lat: 35.6913, lng: 139.6985, zoom: 17 },
] as const;

const logger = createLogger('MapDefaults');

function parseEnvLatLng(value: string | undefined): [number, number] | null {
  if (!value) {
    return null;
  }
  const parts = value.split(',');
  const lat = parseQueryLat(parts[0]);
  const lng = parseQueryLng(parts[1]);
  if (lat == null || lng == null) {
    return null;
  }
  return [lat, lng];
}

function parseEnvZoom(value: string | undefined): number | null {
  return parseQueryZoom(value);
}

/**
 * Pick a random location from HOME_LOCATIONS.
 * Returns center and zoom.
 */
export function pickRandomHome(): { center: [number, number]; zoom: number } {
  const loc = HOME_LOCATIONS[Math.floor(Math.random() * HOME_LOCATIONS.length)];
  return { center: [loc.lat, loc.lng], zoom: loc.zoom };
}

// --- Resolution: query params > env > random ---

const params = new URLSearchParams(window.location.search);
const qLat = parseQueryLat(params.get('lat'));
const qLng = parseQueryLng(params.get('lng'));
const qZoom = parseQueryZoom(params.get('zm'));
const qCenter: [number, number] | null = qLat != null && qLng != null ? [qLat, qLng] : null;

const envCenter = parseEnvLatLng(import.meta.env.VITE_INITIAL_LAT_LNG);
const envZoom = parseEnvZoom(import.meta.env.VITE_INITIAL_ZOOM_LEVEL);

const DEFAULT_ZOOM = 16;
const randomHome = (qCenter ?? envCenter) ? null : pickRandomHome();

const resolvedCenter: [number, number] = qCenter ?? envCenter ?? randomHome!.center;
const resolvedZoom: number = qZoom ?? envZoom ?? randomHome?.zoom ?? DEFAULT_ZOOM;

// Log resolution source
if (qCenter) {
  logger.info(
    `Initial position from query params: [${resolvedCenter.join(', ')}] zoom=${String(resolvedZoom)}`,
  );
} else if (envCenter) {
  logger.info(
    `Initial position from env: [${resolvedCenter.join(', ')}] zoom=${String(resolvedZoom)}`,
  );
} else if (randomHome) {
  const name = HOME_LOCATIONS.find((l) => l.lat === randomHome.center[0])?.name ?? 'unknown';
  logger.info(
    `Initial position from random: ${name} [${resolvedCenter.join(', ')}] zoom=${String(resolvedZoom)}`,
  );
}

/**
 * Initial map center, evaluated once at module load.
 */
export const INITIAL_CENTER: [number, number] = resolvedCenter;

/**
 * Initial map zoom level.
 */
export const INITIAL_ZOOM: number = resolvedZoom;
