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
import { parseQueryLat, parseQueryLng, parseQueryZoom } from '../lib/query-params';
import { createLogger } from '../lib/logger';

/**
 * Curated locations for random initial display.
 *
 * Each entry is a place where multiple transit lines intersect or
 * interesting route patterns exist, giving first-time users an
 * immediate sense of "where can I go from here?".
 */
const HOME_LOCATIONS = [
  /** Tokyo, Japan */
  { name: 'Tokyo Station', lat: 35.6814, lng: 139.7674, zoom: 15 },
  { name: 'Kumano-mae', lat: 35.7485, lng: 139.7699, zoom: 15 },
  { name: 'Kinshicho Station', lat: 35.6967, lng: 139.814, zoom: 17 },
  { name: 'Tokyo Big Sight', lat: 35.6302, lng: 139.793, zoom: 18 },
  { name: 'Shibuya Station', lat: 35.6588, lng: 139.7012, zoom: 17 },
  { name: 'Otsuka Station', lat: 35.731, lng: 139.7291, zoom: 18 },
  { name: 'Nerima Station', lat: 35.7384, lng: 139.654, zoom: 18 },
  { name: 'Chiyoda City Hall', lat: 35.6948, lng: 139.7533, zoom: 16 },
  { name: 'Ikebukuro Station', lat: 35.73, lng: 139.7127, zoom: 16 },
  { name: 'Shinjuku Station West (North)', lat: 35.6919, lng: 139.6987, zoom: 18 },
  { name: 'Shinjuku Station West (South)', lat: 35.691, lng: 139.6985, zoom: 15 },
  { name: 'Shinagawa Seaside', lat: 35.6103, lng: 139.7483, zoom: 15 },
  { name: 'Shimbashi Station', lat: 35.6663, lng: 139.7596, zoom: 16 },
  { name: 'Ome Station', lat: 35.7879, lng: 139.258, zoom: 16 },
  /** Oshima, Tokyo, Japan */
  { name: 'Motomachi Port', lat: 34.7512, lng: 139.3546, zoom: 12 },
  /** Kanagawa, Japan */
  { name: 'Kannai Sta, Kanagawa, Japan', lat: 35.4444, lng: 139.6407, zoom: 15 },
  /** Nagoya, Japan */
  { name: 'Nagoya', lat: 35.1697, lng: 136.8954, zoom: 13 },
  /** Kyoto, Japan */
  { name: 'Kyoto Station', lat: 34.9868, lng: 135.7586, zoom: 19 },
  { name: 'Kinkakuji Temple', lat: 35.0392, lng: 135.7319, zoom: 17 },
  { name: 'Nishigamo Shako', lat: 35.06443711972482, lng: 135.74506404084843, zoom: 16 },
  /** Ehime, Japan */
  { name: 'Matsuyama (Okaido crossing)', lat: 33.8417, lng: 132.7703, zoom: 16 },
  { name: 'Matsuyama City Station', lat: 33.8361, lng: 132.7632, zoom: 18 },
  { name: 'Yawatahama Port', lat: 33.4605585, lng: 132.41714, zoom: 14 },
  /** Germany */
  { name: 'Freiburg Hauptbahnhof', lat: 47.99610302520502, lng: 7.840770083827948, zoom: 16 },
  /** Italy */
  { name: 'Venice Piazzale Roma', lat: 45.43391655307844, lng: 12.343352744453911, zoom: 16 },
  { name: 'Venezia Santa Lucia', lat: 45.441, lng: 12.321, zoom: 15 },
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
