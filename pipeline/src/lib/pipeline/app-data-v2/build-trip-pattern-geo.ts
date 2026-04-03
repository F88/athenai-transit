/**
 * Build tripPatternGeo section of InsightsBundle.
 *
 * Computes geographic metrics for each trip pattern:
 * - `dist`: straight-line distance (Haversine km) from first to last stop
 * - `pathDist`: sum of consecutive Haversine distances along the stop sequence
 * - `cl`: whether the pattern is circular (first stop === last stop)
 *
 * Service-group independent — geographic metrics do not change by day type.
 */

import type {
  StopV2Json,
  TripPatternGeoJson,
  TripPatternJson,
} from '../../../../../src/types/data/transit-v2-json';
import { haversineKm } from '../../geo-utils';

/**
 * Build per-pattern geographic metrics from trip patterns and stop coordinates.
 *
 * @param patterns - Trip patterns keyed by pattern ID.
 * @param stops - Stop records (used for lat/lon lookup).
 * @returns Map of pattern ID to geographic metrics.
 */
export function buildTripPatternGeo(
  patterns: Record<string, TripPatternJson>,
  stops: StopV2Json[],
): Record<string, TripPatternGeoJson> {
  // Build stop coordinate lookup
  const stopCoords = new Map<string, { lat: number; lon: number }>();
  for (const stop of stops) {
    stopCoords.set(stop.i, { lat: stop.a, lon: stop.o });
  }

  const result: Record<string, TripPatternGeoJson> = {};

  for (const [patternId, pattern] of Object.entries(patterns)) {
    const { stops } = pattern;

    if (stops.length === 0) {
      result[patternId] = { dist: 0, pathDist: 0, cl: false };
      continue;
    }

    if (stops.length === 1) {
      result[patternId] = { dist: 0, pathDist: 0, cl: false };
      continue;
    }

    const cl = stops[0].id === stops[stops.length - 1].id;

    // Straight-line distance: 0 for circular routes
    let dist = 0;
    if (!cl) {
      const first = stopCoords.get(stops[0].id);
      const last = stopCoords.get(stops[stops.length - 1].id);
      if (first && last) {
        dist = haversineKm(first.lat, first.lon, last.lat, last.lon);
      }
    }

    // Path distance: sum of consecutive stop distances
    let pathDist = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stopCoords.get(stops[i].id);
      const b = stopCoords.get(stops[i + 1].id);
      if (a && b) {
        pathDist += haversineKm(a.lat, a.lon, b.lat, b.lon);
      }
    }

    // Round to 3 decimal places (meter precision)
    result[patternId] = {
      dist: Math.round(dist * 1000) / 1000,
      pathDist: Math.round(pathDist * 1000) / 1000,
      cl,
    };
  }

  return result;
}
