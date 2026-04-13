/**
 * Tests for bundle-writer.ts.
 *
 * @vitest-environment node
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  DataBundle,
  InsightsBundle,
  ShapesBundle,
} from '../../../../../../src/types/data/transit-v2-json';
import { writeDataBundle, writeInsightsBundle, writeShapesBundle } from '../bundle-writer';

const TMP_DIR = join(import.meta.dirname, '.tmp-bundle-writer-test');

/** Minimal DataBundle for testing. */
function makeBundle(): DataBundle {
  return {
    bundle_version: 2,
    kind: 'data',
    stops: { v: 2, data: [] },
    routes: { v: 2, data: [] },
    agency: { v: 2, data: [] },
    calendar: { v: 1, data: { services: [], exceptions: [] } },
    feedInfo: { v: 1, data: { pn: '', pu: '', l: '', s: '', e: '', v: '' } },
    timetable: { v: 2, data: {} },
    tripPatterns: { v: 2, data: {} },
    translations: {
      v: 1,
      data: {
        agency_names: {},
        route_long_names: {},
        route_short_names: {},
        stop_names: {},
        trip_headsigns: {},
        stop_headsigns: {},
      },
    },
    lookup: { v: 2, data: {} },
  };
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('writeDataBundle', () => {
  it('creates directory and writes data.json', () => {
    const dir = join(TMP_DIR, 'test-prefix');
    const bundle = makeBundle();

    writeDataBundle(dir, bundle);

    const filePath = join(dir, 'data.json');
    expect(existsSync(filePath)).toBe(true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8')) as DataBundle;
    expect(written.bundle_version).toBe(2);
    expect(written.kind).toBe('data');
  });

  it('does not leave a temp file after successful write', () => {
    const dir = join(TMP_DIR, 'test-prefix');
    writeDataBundle(dir, makeBundle());

    expect(existsSync(join(dir, 'data.json.tmp'))).toBe(false);
  });

  it('overwrites existing data.json', () => {
    const dir = join(TMP_DIR, 'test-prefix');

    const bundle1 = makeBundle();
    bundle1.stops = { v: 2, data: [{ v: 2, i: 'a:1', n: 'Stop1', a: 35, o: 139, l: 0 }] };
    writeDataBundle(dir, bundle1);

    const bundle2 = makeBundle();
    bundle2.stops = { v: 2, data: [{ v: 2, i: 'a:2', n: 'Stop2', a: 36, o: 140, l: 0 }] };
    writeDataBundle(dir, bundle2);

    const written = JSON.parse(readFileSync(join(dir, 'data.json'), 'utf-8')) as DataBundle;
    expect(written.stops.data).toHaveLength(1);
    expect(written.stops.data[0].i).toBe('a:2');
  });

  it('creates nested directories recursively', () => {
    const dir = join(TMP_DIR, 'a', 'b', 'c');
    writeDataBundle(dir, makeBundle());

    expect(existsSync(join(dir, 'data.json'))).toBe(true);
  });
});

describe('writeShapesBundle', () => {
  it('creates directory and writes shapes.json', () => {
    const dir = join(TMP_DIR, 'shapes-test');
    const shapes = {
      'pfx:R1': [
        [
          [35.68, 139.76],
          [35.69, 139.77],
        ] as [number, number][],
      ],
    };

    writeShapesBundle(dir, shapes);

    const filePath = join(dir, 'shapes.json');
    expect(existsSync(filePath)).toBe(true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8')) as ShapesBundle;
    expect(written.bundle_version).toBe(2);
    expect(written.kind).toBe('shapes');
    expect(written.shapes.v).toBe(2);
    expect(written.shapes.data['pfx:R1']).toHaveLength(1);
    expect(written.shapes.data['pfx:R1'][0]).toEqual([
      [35.68, 139.76],
      [35.69, 139.77],
    ]);
  });

  it('does not leave a temp file after successful write', () => {
    const dir = join(TMP_DIR, 'shapes-test');
    writeShapesBundle(dir, {});

    expect(existsSync(join(dir, 'shapes.json.tmp'))).toBe(false);
  });

  it('overwrites existing shapes.json', () => {
    const dir = join(TMP_DIR, 'shapes-test');

    writeShapesBundle(dir, { 'pfx:R1': [[[35.0, 139.0]]] });
    writeShapesBundle(dir, { 'pfx:R2': [[[36.0, 140.0]]] });

    const written = JSON.parse(readFileSync(join(dir, 'shapes.json'), 'utf-8')) as ShapesBundle;
    expect(written.shapes.data).not.toHaveProperty('pfx:R1');
    expect(written.shapes.data).toHaveProperty('pfx:R2');
  });

  it('writes empty shapes', () => {
    const dir = join(TMP_DIR, 'shapes-test');
    writeShapesBundle(dir, {});

    const written = JSON.parse(readFileSync(join(dir, 'shapes.json'), 'utf-8')) as ShapesBundle;
    expect(written.shapes.data).toEqual({});
  });
});

describe('writeInsightsBundle', () => {
  it('creates directory and writes insights.json', () => {
    const dir = join(TMP_DIR, 'insights-test');
    const serviceGroups = [
      { key: 'wd', serviceIds: ['svc-1', 'svc-2'] },
      { key: 'sa', serviceIds: ['svc-3'] },
    ];

    writeInsightsBundle(dir, serviceGroups);

    const filePath = join(dir, 'insights.json');
    expect(existsSync(filePath)).toBe(true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8')) as InsightsBundle;
    expect(written.bundle_version).toBe(2);
    expect(written.kind).toBe('insights');
    expect(written.serviceGroups.v).toBe(1);
    expect(written.serviceGroups.data).toEqual(serviceGroups);
  });

  it('does not leave a temp file after successful write', () => {
    const dir = join(TMP_DIR, 'insights-test');
    writeInsightsBundle(dir, []);

    expect(existsSync(join(dir, 'insights.json.tmp'))).toBe(false);
  });

  it('writes empty service groups', () => {
    const dir = join(TMP_DIR, 'insights-test');
    writeInsightsBundle(dir, []);

    const written = JSON.parse(readFileSync(join(dir, 'insights.json'), 'utf-8')) as InsightsBundle;
    expect(written.serviceGroups.data).toEqual([]);
  });

  it('does not include optional sections when not provided', () => {
    const dir = join(TMP_DIR, 'insights-test');
    writeInsightsBundle(dir, [{ key: 'wd', serviceIds: ['svc-1'] }]);

    const written = JSON.parse(readFileSync(join(dir, 'insights.json'), 'utf-8')) as InsightsBundle;
    expect(written).not.toHaveProperty('tripPatternStats');
    expect(written).not.toHaveProperty('tripPatternGeo');
    expect(written).not.toHaveProperty('stopStats');
  });

  it('includes optional sections when provided', () => {
    const dir = join(TMP_DIR, 'insights-optional');
    const serviceGroups = [{ key: 'wd', serviceIds: ['svc-1'] }];
    const tripPatternGeo = { p1: { dist: 5.0, pathDist: 6.5, cl: false } };
    const tripPatternStats = { wd: { p1: { freq: 10, rd: [20, 10, 0] } } };
    const stopStats = {
      wd: { s1: { freq: 15, rc: 2, rtc: 1, ed: 360, ld: 1380 } },
    };

    writeInsightsBundle(dir, serviceGroups, {
      tripPatternGeo,
      tripPatternStats,
      stopStats,
    });

    const written = JSON.parse(readFileSync(join(dir, 'insights.json'), 'utf-8')) as InsightsBundle;
    expect(written.tripPatternGeo).toEqual({ v: 1, data: tripPatternGeo });
    expect(written.tripPatternStats).toEqual({ v: 1, data: tripPatternStats });
    expect(written.stopStats).toEqual({ v: 1, data: stopStats });
  });

  it('includes only provided optional sections', () => {
    const dir = join(TMP_DIR, 'insights-partial');
    writeInsightsBundle(dir, [{ key: 'wd', serviceIds: ['svc-1'] }], {
      tripPatternGeo: { p1: { dist: 1.0, pathDist: 1.5, cl: false } },
    });

    const written = JSON.parse(readFileSync(join(dir, 'insights.json'), 'utf-8')) as InsightsBundle;
    expect(written.tripPatternGeo).toBeDefined();
    expect(written).not.toHaveProperty('tripPatternStats');
    expect(written).not.toHaveProperty('stopStats');
  });
});
