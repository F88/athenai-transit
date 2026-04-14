/**
 * Integration tests for build-insights.ts InsightsBundle assembly.
 *
 * Creates a minimal DataBundle on disk, reads it back via
 * buildServiceGroups + writeInsightsBundle, and verifies the output.
 *
 * @vitest-environment node
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DataBundle, InsightsBundle } from '../../../../../src/types/data/transit-v2-json';
import { buildServiceGroups } from '../../../../src/lib/pipeline/app-data-v2/build-service-groups';
import { buildStopStats } from '../../../../src/lib/pipeline/app-data-v2/build-stop-stats';
import { buildTripPatternGeo } from '../../../../src/lib/pipeline/app-data-v2/build-trip-pattern-geo';
import { buildTripPatternStats } from '../../../../src/lib/pipeline/app-data-v2/build-trip-pattern-stats';
import {
  writeDataBundle,
  writeInsightsBundle,
} from '../../../../src/lib/pipeline/app-data-v2/bundle-writer';

const TMP_DIR = join(import.meta.dirname, '.tmp-build-insights-test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal DataBundle with the given calendar services. */
function makeDataBundle(services: { id: string; d: number[] }[]): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: { v: 2, data: [] },
    routes: { v: 2, data: [] },
    agency: { v: 2, data: [] },
    calendar: {
      v: 1,
      data: {
        services: services.map((s) => ({
          i: s.id,
          d: s.d,
          s: '20260101',
          e: '20261231',
        })),
        exceptions: [],
      },
    },
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

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InsightsBundle assembly', () => {
  it('produces a valid InsightsBundle from a DataBundle with standard patterns', () => {
    const outDir = join(TMP_DIR, 'test-prefix');

    // Write a DataBundle with weekday/saturday/sunday services
    const dataBundle = makeDataBundle([
      { id: 'svc-wd-1', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-wd-2', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-sa', d: [0, 0, 0, 0, 0, 1, 0] },
      { id: 'svc-su', d: [0, 0, 0, 0, 0, 0, 1] },
    ]);
    writeDataBundle(outDir, dataBundle);

    // Read back and build insights (same flow as the script)
    const raw = readFileSync(join(outDir, 'data.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DataBundle;
    const serviceGroups = buildServiceGroups(parsed.calendar.data);
    writeInsightsBundle(outDir, serviceGroups);

    // Verify output
    const insightsPath = join(outDir, 'insights.json');
    expect(existsSync(insightsPath)).toBe(true);

    const insights = JSON.parse(readFileSync(insightsPath, 'utf-8')) as InsightsBundle;
    expect(insights.bundle_version).toBe(3);
    expect(insights.kind).toBe('insights');
    expect(insights.serviceGroups.v).toBe(1);
    expect(insights.serviceGroups.data).toHaveLength(3);
    expect(insights.serviceGroups.data[0].key).toBe('wd');
    expect(insights.serviceGroups.data[0].serviceIds).toEqual(['svc-wd-1', 'svc-wd-2']);
    expect(insights.serviceGroups.data[1].key).toBe('sa');
    expect(insights.serviceGroups.data[2].key).toBe('su');
  });

  it('all service_ids in the DataBundle appear exactly once in InsightsBundle groups', () => {
    const outDir = join(TMP_DIR, 'coverage-check');

    const dataBundle = makeDataBundle([
      { id: 'a', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'b', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'c', d: [0, 0, 0, 0, 0, 1, 0] },
      { id: 'd', d: [0, 0, 0, 0, 0, 0, 1] },
      { id: 'e', d: [1, 0, 1, 0, 1, 0, 0] },
    ]);
    writeDataBundle(outDir, dataBundle);

    const raw = readFileSync(join(outDir, 'data.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DataBundle;
    const serviceGroups = buildServiceGroups(parsed.calendar.data);
    writeInsightsBundle(outDir, serviceGroups);

    const insights = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as InsightsBundle;

    // Every service_id from the DataBundle must appear
    const inputIds = new Set(parsed.calendar.data.services.map((s) => s.i));
    const outputIds = new Set(insights.serviceGroups.data.flatMap((g) => g.serviceIds));
    expect(outputIds).toEqual(inputIds);

    // No duplicates
    const allIds = insights.serviceGroups.data.flatMap((g) => g.serviceIds);
    expect(allIds).toHaveLength(outputIds.size);
  });

  it('handles a DataBundle with no calendar services', () => {
    const outDir = join(TMP_DIR, 'empty-calendar');

    const dataBundle = makeDataBundle([]);
    writeDataBundle(outDir, dataBundle);

    const raw = readFileSync(join(outDir, 'data.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DataBundle;
    const serviceGroups = buildServiceGroups(parsed.calendar.data);
    writeInsightsBundle(outDir, serviceGroups);

    const insights = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as InsightsBundle;
    expect(insights.serviceGroups.data).toEqual([]);
  });

  it('does not overwrite existing data.json when writing insights.json', () => {
    const outDir = join(TMP_DIR, 'no-overwrite');

    const dataBundle = makeDataBundle([{ id: 'svc-1', d: [1, 1, 1, 1, 1, 1, 1] }]);
    writeDataBundle(outDir, dataBundle);

    const raw = readFileSync(join(outDir, 'data.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DataBundle;
    const serviceGroups = buildServiceGroups(parsed.calendar.data);
    writeInsightsBundle(outDir, serviceGroups);

    // data.json must still exist and be unchanged
    expect(existsSync(join(outDir, 'data.json'))).toBe(true);
    const dataAfter = JSON.parse(readFileSync(join(outDir, 'data.json'), 'utf-8')) as DataBundle;
    expect(dataAfter.calendar.data.services).toHaveLength(1);
    expect(dataAfter.calendar.data.services[0].i).toBe('svc-1');
  });

  it('produces all insight sections from a DataBundle with timetable data', () => {
    const outDir = join(TMP_DIR, 'full-insights');

    const dataBundle = makeDataBundle([{ id: 'svc-wd', d: [1, 1, 1, 1, 1, 0, 0] }]);

    // Add stops, routes, patterns, and timetable
    dataBundle.stops = {
      v: 2,
      data: [
        { v: 2, i: 's1', n: 'Stop 1', a: 35.68, o: 139.76, l: 0 },
        { v: 2, i: 's2', n: 'Stop 2', a: 35.69, o: 139.77, l: 0 },
      ],
    };
    dataBundle.routes = {
      v: 2,
      data: [{ v: 2, i: 'r1', s: 'R1', l: 'Route 1', t: 3, c: '000000', tc: 'FFFFFF', ai: 'a1' }],
    };
    dataBundle.tripPatterns = {
      v: 2,
      data: {
        p1: { v: 2, r: 'r1', h: 'Stop 2', stops: [{ id: 's1' }, { id: 's2' }] },
      },
    };
    dataBundle.timetable = {
      v: 2,
      data: {
        s1: [{ v: 2, tp: 'p1', si: 0, d: { 'svc-wd': [480, 540] }, a: { 'svc-wd': [480, 540] } }],
        s2: [{ v: 2, tp: 'p1', si: 1, d: { 'svc-wd': [490, 550] }, a: { 'svc-wd': [490, 550] } }],
      },
    };

    writeDataBundle(outDir, dataBundle);

    const raw = readFileSync(join(outDir, 'data.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DataBundle;
    const serviceGroups = buildServiceGroups(parsed.calendar.data);
    const tripPatternGeo = buildTripPatternGeo(parsed.tripPatterns.data, parsed.stops.data);
    const tripPatternStats = buildTripPatternStats(
      parsed.tripPatterns.data,
      parsed.timetable.data,
      serviceGroups,
    );
    const stopStats = buildStopStats(
      parsed.timetable.data,
      parsed.tripPatterns.data,
      parsed.routes.data,
      serviceGroups,
    );
    writeInsightsBundle(outDir, serviceGroups, { tripPatternGeo, tripPatternStats, stopStats });

    const insights = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as InsightsBundle;

    // serviceGroups
    expect(insights.serviceGroups.data).toHaveLength(1);
    expect(insights.serviceGroups.data[0].key).toBe('wd');

    // tripPatternGeo
    expect(insights.tripPatternGeo).toBeDefined();
    expect(insights.tripPatternGeo!.v).toBe(1);
    expect(insights.tripPatternGeo!.data['p1'].dist).toBeGreaterThan(0);
    expect(insights.tripPatternGeo!.data['p1'].cl).toBe(false);

    // tripPatternStats
    expect(insights.tripPatternStats).toBeDefined();
    expect(insights.tripPatternStats!.v).toBe(1);
    expect(insights.tripPatternStats!.data['wd']['p1'].freq).toBe(2);
    expect(insights.tripPatternStats!.data['wd']['p1'].rd).toHaveLength(2);
    expect(insights.tripPatternStats!.data['wd']['p1'].rd[1]).toBe(0);

    // stopStats
    expect(insights.stopStats).toBeDefined();
    expect(insights.stopStats!.v).toBe(1);
    expect(insights.stopStats!.data['wd']['s1'].freq).toBe(2);
    expect(insights.stopStats!.data['wd']['s1'].rc).toBe(1);
  });
});
