import type { LatLng } from '../../types/app/map';

/** Meters per degree of latitude (constant worldwide). */
const METERS_PER_DEGREE_LAT = 111_000;

/**
 * Calculate the approximate distance in meters between two points
 * using a flat-earth approximation with latitude-adjusted longitude.
 *
 * @param a - First point as {@link LatLng}.
 * @param b - Second point with `stop_lat` / `stop_lon` fields.
 * @returns Distance in meters (may include decimals).
 */
export function distanceM(a: LatLng, b: { stop_lat: number; stop_lon: number }): number {
  const midLat = ((a.lat + b.stop_lat) / 2) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(midLat);
  const dlat = b.stop_lat - a.lat;
  const dlng = b.stop_lon - a.lng;
  return Math.sqrt((dlat * METERS_PER_DEGREE_LAT) ** 2 + (dlng * metersPerDegreeLng) ** 2);
}

/**
 * Format a distance value for human-readable display, locale-aware.
 *
 * - Under 1 km: rounded to the nearest integer, then formatted via
 *   `toLocaleString(lang)` so large values (e.g. `999.5 → 1000`) carry
 *   the correct thousands separator for the UI language
 *   (`"1,000m"` for en, `"1 000m"` for fr, `"1.000m"` for de, etc.).
 *   The `"m"` unit suffix is always concatenated with no extra spacing.
 *   With unit: `"450m"`, without: `"450"`.
 * - 1 km and above: always one decimal place, formatted via
 *   `toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })`
 *   so the decimal separator follows the locale (`"1.5km"` / `"1,5km"`).
 *   The `"km"` unit suffix is also concatenated without spacing.
 *
 * Callers should pass `i18n.language` (react-i18next) as `lang`.
 *
 * @param meters - Distance in meters (may include decimals).
 * @param lang - BCP 47 language code for number formatting (e.g. `"ja"`, `"en"`).
 * @param unit - Whether to append "m" unit for distances under 1 km. Defaults to true.
 * @returns Formatted distance string.
 *
 * @example
 * ```ts
 * formatDistance(450, 'en');          // => "450m"
 * formatDistance(450, 'en', false);   // => "450"
 * formatDistance(1000, 'en');         // => "1.0km"
 * formatDistance(1500, 'de');         // => "1,5km"
 * ```
 */
export function formatDistance(meters: number, lang: string, unit = true): string {
  if (meters < 1000) {
    const rounded = Math.round(meters).toLocaleString(lang);
    return unit ? `${rounded}m` : rounded;
  }
  const km = (meters / 1000).toLocaleString(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km}km`;
}

/**
 * Calculate the geographic bearing (azimuth) from point `a` to point `b`
 * using a flat-earth approximation with latitude-adjusted longitude.
 *
 * Returns degrees clockwise from north: 0 = north, 90 = east, 180 = south, 270 = west.
 *
 * @param a - Origin point as {@link LatLng}.
 * @param b - Destination point with `stop_lat` / `stop_lon` fields.
 * @returns Bearing in degrees [0, 360).
 */
export function bearingDeg(a: LatLng, b: { stop_lat: number; stop_lon: number }): number {
  const midLat = ((a.lat + b.stop_lat) / 2) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(midLat);
  const dy = (b.stop_lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dx = (b.stop_lon - a.lng) * metersPerDegreeLng;
  // atan2(dx, dy) gives angle from north (Y-axis), clockwise positive
  const rad = Math.atan2(dx, dy);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Format a distance compactly for small badges, locale-aware.
 *
 * - Under 1 km: rounded integer formatted via `toLocaleString(lang)`,
 *   no unit (caller typically paints a unit suffix separately).
 * - 1 km and above: one decimal formatted via `toLocaleString(lang, ...)`
 *   with the `"km"` suffix attached.
 *
 * Callers should pass `i18n.language` as `lang`.
 *
 * @param meters - Distance in meters.
 * @param lang - BCP 47 language code for number formatting.
 * @returns Formatted distance string.
 */
export function formatDistanceCompact(meters: number, lang: string): string {
  if (meters < 1000) {
    return Math.round(meters).toLocaleString(lang);
  }
  const km = (meters / 1000).toLocaleString(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km}km`;
}
