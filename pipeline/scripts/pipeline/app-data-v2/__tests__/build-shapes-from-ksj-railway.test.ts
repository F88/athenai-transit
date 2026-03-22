/**
 * Integration tests for build-shapes-from-ksj.ts ShapesBundle assembly.
 *
 * Uses in-memory GeoJSON data to verify the full pipeline from
 * shape extraction through ShapesBundle write.
 *
 * @vitest-environment node
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShapesBundle } from '../../../../../src/types/data/transit-v2-json';
import { buildShapesForTarget } from '../../../../src/lib/pipeline/extract-shapes-from-ksj';
import type {
  GeoJsonCollection,
  GeoJsonFeature,
  ShapeTarget,
} from '../../../../src/lib/pipeline/extract-shapes-from-ksj';
import { writeShapesBundle } from '../../../../src/lib/pipeline/app-data-v2/bundle-writer';

const TMP_DIR = join(import.meta.dirname, '.tmp-build-shapes-ksj-test');

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

function makeTarget(operator: string, lineToRouteId: Record<string, string>): ShapeTarget {
  return {
    name: 'test-railway',
    prefix: 'test',
    nameEn: 'Test Railway',
    mapping: { operator, lineToRouteId },
  };
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('KSJ ShapesBundle assembly', () => {
  it('produces a valid ShapesBundle from GeoJSON features', () => {
    const geojson = makeGeojson([
      makeFeature('TestOp', 'Line A', [
        [139.76, 35.68],
        [139.77, 35.69],
      ]),
      makeFeature('TestOp', 'Line A', [
        [139.78, 35.7],
        [139.79, 35.71],
      ]),
      makeFeature('TestOp', 'Line B', [
        [139.74, 35.66],
        [139.75, 35.67],
      ]),
    ]);

    const target = makeTarget('TestOp', {
      'Line A': 'test:A',
      'Line B': 'test:B',
    });

    const shapes = buildShapesForTarget(target, geojson);

    expect(Object.keys(shapes)).toHaveLength(2);
    expect(shapes['test:A']).toHaveLength(2); // 2 segments
    expect(shapes['test:B']).toHaveLength(1);

    // Write and read back
    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const filePath = join(outDir, 'shapes.json');
    expect(existsSync(filePath)).toBe(true);

    const bundle = JSON.parse(readFileSync(filePath, 'utf-8')) as ShapesBundle;
    expect(bundle.bundle_version).toBe(2);
    expect(bundle.kind).toBe('shapes');
    expect(bundle.shapes.v).toBe(2);
    expect(Object.keys(bundle.shapes.data)).toHaveLength(2);

    // Verify coordinate conversion [lon, lat] -> [lat, lon]
    expect(bundle.shapes.data['test:A'][0][0]).toEqual([35.68, 139.76]);
  });

  it('writes empty shapes when no features match', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const geojson = makeGeojson([makeFeature('OtherOp', 'Line X', [[139.0, 35.0]])]);

    const target = makeTarget('TestOp', { 'Line X': 'test:X' });
    const shapes = buildShapesForTarget(target, geojson);

    expect(Object.keys(shapes)).toHaveLength(0);

    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const bundle = JSON.parse(readFileSync(join(outDir, 'shapes.json'), 'utf-8')) as ShapesBundle;
    expect(bundle.shapes.data).toEqual({});

    logSpy.mockRestore();
  });

  it('excludes unmapped lines from ShapesBundle', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const geojson = makeGeojson([
      makeFeature('TestOp', 'Mapped Line', [
        [139.76, 35.68],
        [139.77, 35.69],
      ]),
      makeFeature('TestOp', 'Unknown Line', [[140.0, 36.0]]),
    ]);

    const target = makeTarget('TestOp', { 'Mapped Line': 'test:M' });
    const shapes = buildShapesForTarget(target, geojson);

    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const bundle = JSON.parse(readFileSync(join(outDir, 'shapes.json'), 'utf-8')) as ShapesBundle;

    expect(Object.keys(bundle.shapes.data)).toHaveLength(1);
    expect(bundle.shapes.data).toHaveProperty('test:M');
    expect(bundle.shapes.data).not.toHaveProperty('test:Unknown Line');

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('all output route IDs come from lineToRouteId mapping values', () => {
    const lineToRouteId = {
      'Line A': 'test:A',
      'Line B': 'test:B',
    };

    const geojson = makeGeojson([
      makeFeature('TestOp', 'Line A', [
        [139.76, 35.68],
        [139.77, 35.69],
      ]),
      makeFeature('TestOp', 'Line B', [[139.78, 35.7]]),
    ]);

    const target = makeTarget('TestOp', lineToRouteId);
    const shapes = buildShapesForTarget(target, geojson);

    const validRouteIds = new Set(Object.values(lineToRouteId));
    for (const routeId of Object.keys(shapes)) {
      expect(validRouteIds.has(routeId)).toBe(true);
    }
  });
});
