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
 * Format a distance value for human-readable display.
 *
 * - Under 1 km: rounded to the nearest integer. With unit: `"450m"`, without: `"450"`.
 * - 1 km and above: rounded to one decimal place, always `"N.Nkm"`.
 *
 * When `unit` is false and distance is under 1 km, numbers >= 1000
 * are formatted with comma separator (e.g. `"1,234"`).
 *
 * @param meters - Distance in meters (may include decimals).
 * @param unit - Whether to append "m" unit for distances under 1 km. Defaults to true.
 * @returns Formatted distance string.
 *
 * @example
 * ```ts
 * formatDistance(450);            // => "450m"
 * formatDistance(450, false);     // => "450"
 * formatDistance(1000);           // => "1.0km"
 * formatDistance(1000, false);    // => "1.0km"
 * ```
 */
export function formatDistance(meters: number, unit = true): string {
  if (meters < 1000) {
    const rounded = Math.round(meters);
    return unit ? `${rounded}m` : rounded.toLocaleString('en-US');
  }
  return `${(meters / 1000).toFixed(1)}km`;
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
 * Format a distance compactly without unit suffix for small badges.
 *
 * - Under 1 km: rounded integer with comma separator, no unit.
 * - 1 km and above: rounded to one decimal, with "km".
 *
 * @param meters - Distance in meters.
 * @returns Formatted distance string.
 */
export function formatDistanceCompact(meters: number): string {
  if (meters < 1000) {
    return Math.round(meters).toLocaleString('en-US');
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
