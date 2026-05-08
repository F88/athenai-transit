import { getDistance } from 'geolib';

/**
 * Geographic utility functions for the pipeline.
 *
 * Two distance functions are provided:
 *
 * - {@link getDistanceKmLight}: inline Haversine, allocation-free. Use in
 *   O(N²) hot loops where allocation pressure matters; precision is
 *   sufficient for transit stop distances.
 * - {@link getDistanceKm}: geolib (Vincenty) on the WGS-84 ellipsoid
 *   via object arguments. Higher accuracy; allocates per call.
 */

/** Mean Earth radius in kilometers (spherical approximation). */
const EARTH_RADIUS_KM = 6371;

/**
 * Compute the great-circle distance between two points in kilometers
 * using the inline Haversine formula.
 *
 * Allocation-free, suitable for O(N²) hot loops (e.g. global stopGeo
 * connectivity scan). Numerical precision is sufficient for transit
 * stop distances (within ~0.5% of {@link getDistanceKm} for short
 * urban distances).
 *
 * Performance: ~25M ops/sec single-call, ~22× faster than
 * {@link getDistanceKm} in pairwise hot loops (geo-utils.bench.ts).
 *
 * @param lat1 - Latitude of point 1 (degrees).
 * @param lon1 - Longitude of point 1 (degrees).
 * @param lat2 - Latitude of point 2 (degrees).
 * @param lon2 - Longitude of point 2 (degrees).
 * @returns Distance in kilometers (always >= 0).
 */
export function getDistanceKmLight(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  // Normalize longitude difference to [-180, 180] for dateline crossing.
  const dLon = (((lon2 - lon1 + 540) % 360) - 180) * toRad;

  // Clamp to [0, 1] to guard against floating-point overshoot near
  // antipodal points, which would make Math.asin return NaN.
  const a = Math.min(
    1,
    Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2,
  );

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Compute the distance between two points in kilometers using geolib's
 * Vincenty formula on the WGS-84 ellipsoid.
 *
 * Higher accuracy than {@link getDistanceKmLight}, but allocates two literal
 * objects per call (passed to `geolib.getDistance`).
 *
 * Performance: ~1.7M ops/sec single-call, ~22× slower than
 * {@link getDistanceKmLight} in pairwise hot loops — avoid in O(N²) scans.
 *
 * @param a - First point with `lat` / `lng` fields.
 * @param b - Second point with `stop_lat` / `stop_lon` fields.
 * @returns Distance in kilometers.
 */
export function getDistanceKm(
  a: { lat: number; lng: number },
  b: { stop_lat: number; stop_lon: number },
): number {
  if (a.lat === b.stop_lat && a.lng === b.stop_lon) {
    return 0;
  }
  return (
    getDistance(
      { latitude: a.lat, longitude: a.lng },
      { latitude: b.stop_lat, longitude: b.stop_lon },
      0.01,
    ) / 1000
  );
}
