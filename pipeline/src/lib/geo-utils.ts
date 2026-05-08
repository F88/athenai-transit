import { getDistance } from 'geolib';

/**
 * Geographic utility functions for the pipeline.
 *
 * These are geographic utilities used by the pipeline.
 */
/**
 * Compute the distance between two points in kilometers.
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
