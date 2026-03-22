/**
 * Geographic utility functions for the pipeline.
 *
 * These are Node.js pipeline utilities, separate from the client-side
 * distance functions in `src/domain/transit/distance.ts`.
 */

/** Mean radius of the Earth in kilometers (WGS-84). */
const EARTH_RADIUS_KM = 6371;

/**
 * Compute the great-circle distance between two points using the
 * Haversine formula.
 *
 * @param lat1 - Latitude of point 1 (degrees).
 * @param lon1 - Longitude of point 1 (degrees).
 * @param lat2 - Latitude of point 2 (degrees).
 * @param lon2 - Longitude of point 2 (degrees).
 * @returns Distance in kilometers (always >= 0).
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
