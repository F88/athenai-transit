/**
 * Tests for build-trip-pattern-geo.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { StopV2Json, TripPatternJson } from '../../../../../../src/types/data/transit-v2-json';
import { buildTripPatternGeo } from '../build-trip-pattern-geo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStop(id: string, lat: number, lon: number): StopV2Json {
  return { v: 2, i: id, n: `Stop ${id}`, a: lat, o: lon, l: 0 };
}

function makePattern(id: string, stopIds: string[]): Record<string, TripPatternJson> {
  return {
    [id]: { v: 2, r: 'r1', h: 'Terminal', stops: stopIds },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTripPatternGeo', () => {
  it('computes dist and pathDist for a 2-stop linear pattern', () => {
    const stops = [
      makeStop('s1', 35.6812, 139.7671), // Tokyo Station
      makeStop('s2', 35.6896, 139.7006), // Shinjuku Station
    ];
    const patterns = makePattern('p1', ['s1', 's2']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1'].cl).toBe(false);
    // dist and pathDist should be equal for 2-stop pattern
    expect(result['p1'].dist).toBeCloseTo(result['p1'].pathDist, 3);
    // ~6.4 km
    expect(result['p1'].dist).toBeGreaterThan(5);
    expect(result['p1'].dist).toBeLessThan(8);
  });

  it('pathDist > dist for multi-stop non-linear pattern', () => {
    // 3 stops forming a triangle
    const stops = [
      makeStop('s1', 35.68, 139.76),
      makeStop('s2', 35.7, 139.78), // detour
      makeStop('s3', 35.68, 139.8),
    ];
    const patterns = makePattern('p1', ['s1', 's2', 's3']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1'].cl).toBe(false);
    expect(result['p1'].pathDist).toBeGreaterThan(result['p1'].dist);
    expect(result['p1'].dist).toBeGreaterThan(0);
  });

  it('sets dist=0 and cl=true for circular pattern', () => {
    const stops = [
      makeStop('s1', 35.68, 139.76),
      makeStop('s2', 35.69, 139.77),
      makeStop('s3', 35.7, 139.78),
    ];
    // Circular: s1 → s2 → s3 → s1
    const patterns = makePattern('p1', ['s1', 's2', 's3', 's1']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1'].cl).toBe(true);
    expect(result['p1'].dist).toBe(0);
    expect(result['p1'].pathDist).toBeGreaterThan(0);
  });

  it('handles same-coordinate stops (dist=0)', () => {
    const stops = [makeStop('s1', 35.68, 139.76), makeStop('s2', 35.68, 139.76)];
    const patterns = makePattern('p1', ['s1', 's2']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1'].dist).toBe(0);
    expect(result['p1'].pathDist).toBe(0);
    expect(result['p1'].cl).toBe(false);
  });

  it('handles single-stop pattern', () => {
    const stops = [makeStop('s1', 35.68, 139.76)];
    const patterns = makePattern('p1', ['s1']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1']).toEqual({ dist: 0, pathDist: 0, cl: false });
  });

  it('handles empty stops pattern', () => {
    const patterns = makePattern('p1', []);

    const result = buildTripPatternGeo(patterns, []);

    expect(result['p1']).toEqual({ dist: 0, pathDist: 0, cl: false });
  });

  it('handles missing stop coordinates gracefully', () => {
    const stops = [makeStop('s1', 35.68, 139.76)];
    // s2 is not in stops array
    const patterns = makePattern('p1', ['s1', 's2']);

    const result = buildTripPatternGeo(patterns, stops);

    // dist = 0 because s2 coords are missing
    expect(result['p1'].dist).toBe(0);
    expect(result['p1'].pathDist).toBe(0);
    expect(result['p1'].cl).toBe(false);
  });

  it('processes multiple patterns', () => {
    const stops = [
      makeStop('s1', 35.68, 139.76),
      makeStop('s2', 35.69, 139.77),
      makeStop('s3', 35.7, 139.78),
    ];
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
      p2: { v: 2, r: 'r1', h: 'B', stops: ['s1', 's2', 's3'] },
    };

    const result = buildTripPatternGeo(patterns, stops);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['p1']).toBeDefined();
    expect(result['p2']).toBeDefined();
    // p2 should have longer pathDist
    expect(result['p2'].pathDist).toBeGreaterThan(result['p1'].pathDist);
  });

  it('returns empty record when patterns map is empty', () => {
    const result = buildTripPatternGeo({}, []);

    expect(result).toEqual({});
  });

  it('detects 2-stop circular pattern (same stop ID for origin and terminal)', () => {
    const stops = [makeStop('s1', 35.68, 139.76)];
    const patterns = makePattern('p1', ['s1', 's1']);

    const result = buildTripPatternGeo(patterns, stops);

    expect(result['p1'].cl).toBe(true);
    expect(result['p1'].dist).toBe(0);
    expect(result['p1'].pathDist).toBe(0);
  });

  it('returns dist=0 and pathDist=0 when all stop coordinates are missing', () => {
    // Pattern references stops not in the stops array
    const patterns = makePattern('p1', ['x1', 'x2', 'x3']);

    const result = buildTripPatternGeo(patterns, []);

    expect(result['p1'].dist).toBe(0);
    expect(result['p1'].pathDist).toBe(0);
    expect(result['p1'].cl).toBe(false);
  });

  it('computes pathDist but not dist when only middle stop coordinates are missing', () => {
    // s1 and s3 have coords, s2 does not
    const stops = [makeStop('s1', 35.68, 139.76), makeStop('s3', 35.7, 139.78)];
    const patterns = makePattern('p1', ['s1', 's2', 's3']);

    const result = buildTripPatternGeo(patterns, stops);

    // dist uses first and last stop — both have coords
    expect(result['p1'].dist).toBeGreaterThan(0);
    // pathDist: s1→s2 = 0 (s2 missing), s2→s3 = 0 (s2 missing)
    expect(result['p1'].pathDist).toBe(0);
    expect(result['p1'].cl).toBe(false);
  });

  it('rounds values to 3 decimal places', () => {
    const stops = [makeStop('s1', 35.681234, 139.767123), makeStop('s2', 35.689612, 139.700612)];
    const patterns = makePattern('p1', ['s1', 's2']);

    const result = buildTripPatternGeo(patterns, stops);

    // Check that values have at most 3 decimal places
    const distStr = result['p1'].dist.toString();
    const pathDistStr = result['p1'].pathDist.toString();
    const distDecimals = distStr.includes('.') ? distStr.split('.')[1].length : 0;
    const pathDistDecimals = pathDistStr.includes('.') ? pathDistStr.split('.')[1].length : 0;
    expect(distDecimals).toBeLessThanOrEqual(3);
    expect(pathDistDecimals).toBeLessThanOrEqual(3);
  });
});
