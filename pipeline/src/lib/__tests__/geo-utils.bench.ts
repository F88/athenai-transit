/**
 * Performance benchmarks for geo-utils distance functions.
 *
 * Run with:
 *   npx vitest bench pipeline/src/lib/__tests__/geo-utils.bench.ts
 *
 * Compares {@link getDistanceKmLight} (inline Haversine, allocation-free)
 * against {@link getDistanceKm} (geolib/Vincenty via object arguments) on
 * a pairwise scan that mirrors the global stopGeo build's O(N²) hot loop.
 *
 * @vitest-environment node
 */

import { bench, describe } from 'vitest';

import { getDistanceKm, getDistanceKmLight } from '../geo-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Number of points in the synthetic dataset. */
const POINT_COUNT = 500;

/**
 * Pre-generate a fixed pseudo-random scatter of lat/lon points so both
 * benchmarks see the same workload. Bounded around the Tokyo metro
 * area so distances span a realistic urban range (sub-km to ~50 km).
 */
function generatePoints(count: number): { lat: number; lon: number }[] {
  // Linear congruential generator for deterministic output without
  // pulling in a seedrandom dependency.
  let seed = 0xc0ffee;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      lat: 35.5 + next() * 0.7, // ~ 35.5 .. 36.2
      lon: 139.4 + next() * 0.8, // ~ 139.4 .. 140.2
    });
  }
  return pts;
}

const POINTS = generatePoints(POINT_COUNT);

/**
 * Object-style copy of {@link POINTS} for the {@link getDistanceKm}
 * benchmark, mirroring how production code holds stop coordinates.
 */
const POINTS_OBJ = POINTS.map((p) => ({
  lat: p.lat,
  lng: p.lon,
  stop_lat: p.lat,
  stop_lon: p.lon,
}));

// ---------------------------------------------------------------------------
// Pairwise scan — emulates the global stopGeo O(N²) hot loop
// ---------------------------------------------------------------------------

describe(`pairwise scan (${POINT_COUNT} × ${POINT_COUNT} = ${POINT_COUNT ** 2} calls)`, () => {
  bench('getDistanceKmLight (numeric args, inline Haversine)', () => {
    let acc = 0;
    for (let i = 0; i < POINT_COUNT; i++) {
      const a = POINTS[i];
      for (let j = 0; j < POINT_COUNT; j++) {
        const b = POINTS[j];
        acc += getDistanceKmLight(a.lat, a.lon, b.lat, b.lon);
      }
    }
    // Prevent the optimizer from eliminating the loop body.
    if (acc === Number.NEGATIVE_INFINITY) {
      throw new Error('unreachable');
    }
  });

  bench('getDistanceKm (object args, geolib/Vincenty)', () => {
    let acc = 0;
    for (let i = 0; i < POINT_COUNT; i++) {
      const a = POINTS_OBJ[i];
      for (let j = 0; j < POINT_COUNT; j++) {
        const b = POINTS_OBJ[j];
        acc += getDistanceKm(a, b);
      }
    }
    if (acc === Number.NEGATIVE_INFINITY) {
      throw new Error('unreachable');
    }
  });
});
