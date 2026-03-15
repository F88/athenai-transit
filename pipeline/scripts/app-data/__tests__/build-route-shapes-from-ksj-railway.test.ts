/**
 * Tests for build-route-shapes-from-ksj-railway.ts buildShapesForTarget function.
 *
 * Uses in-memory GeoJSON data to verify shape generation from MLIT
 * National Land Numerical Information railway section data.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  GeoJsonCollection,
  GeoJsonFeature,
  ShapeTarget,
} from '../build-route-shapes-from-ksj-railway';
import { buildShapesForTarget } from '../build-route-shapes-from-ksj-railway';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal GeoJSON feature for testing. */
function makeFeature(
  operator: string,
  lineName: string,
  coordinates: [number, number][],
): GeoJsonFeature {
  return {
    type: 'Feature',
    properties: {
      N02_001: '1',
      N02_002: '1',
      N02_003: lineName,
      N02_004: operator,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

function makeGeojson(features: GeoJsonFeature[]): GeoJsonCollection {
  return { type: 'FeatureCollection', features };
}

function makeTarget(
  operator: string,
  lineToRouteId: Record<string, string>,
  prefix = 'test',
): ShapeTarget {
  return {
    name: 'test-source',
    prefix,
    nameEn: 'Test Railway',
    mapping: { operator, lineToRouteId },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildShapesForTarget', () => {
  it('filters features by operator name', () => {
    const geojson = makeGeojson([
      makeFeature('OperatorA', 'Line1', [[139.0, 35.0], [139.1, 35.1]]),
      makeFeature('OperatorB', 'Line2', [[140.0, 36.0], [140.1, 36.1]]),
    ]);

    const target = makeTarget('OperatorA', { Line1: 'test:L1' });
    const result = buildShapesForTarget(target, geojson);

    expect(result).toHaveProperty('test:L1');
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('maps line names to route IDs', () => {
    const geojson = makeGeojson([
      makeFeature('Op', 'Alpha Line', [[139.0, 35.0], [139.1, 35.1]]),
      makeFeature('Op', 'Beta Line', [[140.0, 36.0], [140.1, 36.1]]),
    ]);

    const target = makeTarget('Op', {
      'Alpha Line': 'pfx:A',
      'Beta Line': 'pfx:B',
    });
    const result = buildShapesForTarget(target, geojson);

    expect(result).toHaveProperty('pfx:A');
    expect(result).toHaveProperty('pfx:B');
    expect(result['pfx:A']).toHaveLength(1);
    expect(result['pfx:B']).toHaveLength(1);
  });

  it('converts [lon, lat] to [lat, lon]', () => {
    const geojson = makeGeojson([
      makeFeature('Op', 'Line1', [[139.5, 35.5]]),
    ]);

    const target = makeTarget('Op', { Line1: 'pfx:L1' });
    const result = buildShapesForTarget(target, geojson);

    // Input is [lon=139.5, lat=35.5], output should be [lat=35.5, lon=139.5]
    expect(result['pfx:L1'][0][0]).toEqual([35.5, 139.5]);
  });

  it('rounds coordinates to 5 decimal places', () => {
    const geojson = makeGeojson([
      makeFeature('Op', 'Line1', [[139.123456789, 35.987654321]]),
    ]);

    const target = makeTarget('Op', { Line1: 'pfx:L1' });
    const result = buildShapesForTarget(target, geojson);

    const [lat, lon] = result['pfx:L1'][0][0];
    expect(lat).toBe(35.98765);
    expect(lon).toBe(139.12346);
  });

  it('reports unmapped lines (does not include them in output)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const geojson = makeGeojson([
      makeFeature('Op', 'Mapped Line', [[139.0, 35.0]]),
      makeFeature('Op', 'Unknown Line', [[140.0, 36.0]]),
    ]);

    const target = makeTarget('Op', { 'Mapped Line': 'pfx:M' });
    const result = buildShapesForTarget(target, geojson);

    expect(result).toHaveProperty('pfx:M');
    expect(result).not.toHaveProperty('pfx:Unknown Line');
    expect(Object.keys(result)).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown Line'));

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('returns empty object when no features match operator', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const geojson = makeGeojson([
      makeFeature('Other', 'Line1', [[139.0, 35.0]]),
    ]);

    const target = makeTarget('NonExistent', { Line1: 'pfx:L1' });
    const result = buildShapesForTarget(target, geojson);

    expect(result).toEqual({});

    logSpy.mockRestore();
  });
});
