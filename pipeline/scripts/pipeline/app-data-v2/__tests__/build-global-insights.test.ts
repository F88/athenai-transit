/**
 * Integration tests for build-global-insights.ts GlobalInsightsBundle assembly.
 *
 * Creates minimal DataBundles on disk, runs the same logic flow as the
 * script (findSundayServiceIds → extractStopEntries → buildStopGeo →
 * buildParentStopGeo → writeGlobalInsightsBundle), and verifies output.
 *
 * @vitest-environment node
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataBundle, GlobalInsightsBundle } from '@contracts/data/transit-v2-json';

import {
  extractStopEntries,
  findSundayServiceIds,
} from '../../../../src/lib/pipeline/app-data-v2/build-global-stop-entries';
import type { StopEntry } from '../../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import {
  buildParentStopGeo,
  buildStopGeo,
} from '../../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import {
  writeDataBundle,
  writeGlobalInsightsBundle,
} from '../../../../src/lib/pipeline/app-data-v2/bundle-writer';
// Note: not importing `uniqueInOrder` from pipeline-utils as a value here -
// the module is partially mocked further below to drive the CLI flow, and a
// value-level import from a partially-mocked module triggers an ESM
// temporal-dead-zone error during vitest module init. Inlining the dedupe
// (a 1-liner) avoids the issue without affecting either test path.
function uniqueInOrder<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

const { mockParseCliArg, mockLoadTargetFile, MOCK_OUTPUT_DIR } = vi.hoisted(() => ({
  mockParseCliArg: vi.fn(),
  mockLoadTargetFile: vi.fn(),
  // Template literal instead of `join()` because vi.hoisted runs before
  // module imports are initialized.
  MOCK_OUTPUT_DIR: `${import.meta.dirname}/.tmp-build-global-insights-main-test`,
}));

// Mock V2_OUTPUT_DIR so the script writes into a test-controlled directory.
vi.mock('../../../../src/lib/paths', () => ({
  V2_OUTPUT_DIR: MOCK_OUTPUT_DIR,
}));

// Preserve real EXIT_*, determineAggregateExitCode, printAggregateSummary,
// formatExitCode, uniqueInOrder, runMain; only mock CLI plumbing.
vi.mock('../../../../src/lib/pipeline/pipeline-utils', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/lib/pipeline/pipeline-utils')
  >('../../../../src/lib/pipeline/pipeline-utils');
  return {
    ...actual,
    parseCliArg: mockParseCliArg,
    loadTargetFile: mockLoadTargetFile,
    runMain: vi.fn(),
  };
});

import { main as runBuildGlobalInsightsMain } from '../build-global-insights';

const TMP_DIR = join(import.meta.dirname, '.tmp-build-global-insights-test');
const GROUP_KEY = 'ho';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal DataBundle with stops, routes, patterns, and timetable. */
function makeDataBundle(opts: {
  services: { id: string; d: number[] }[];
  exceptions?: { i: string; d: string; t: 1 | 2 }[];
  stops: { i: string; a: number; o: number; l: number; ps?: string }[];
  patterns?: Record<string, { r: string; stops: { id: string }[] }>;
  timetable?: Record<string, { tp: string; si?: number; d: Record<string, number[]> }[]>;
}): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: opts.stops.map((s) => ({
        v: 2 as const,
        i: s.i,
        n: s.i,
        a: s.a,
        o: s.o,
        l: s.l,
        ps: s.ps,
      })),
    },
    routes: {
      v: 2,
      data: [
        {
          v: 2 as const,
          i: 'r1',
          s: 'R1',
          l: 'Route 1',
          t: 3,
          c: '000000',
          tc: 'FFFFFF',
          ai: 'a1',
        },
      ],
    },
    agency: { v: 2, data: [] },
    calendar: {
      v: 1,
      data: {
        services: opts.services.map((s) => ({
          i: s.id,
          d: s.d,
          s: '20260101',
          e: '20261231',
        })),
        exceptions: opts.exceptions ?? [],
      },
    },
    feedInfo: { v: 1, data: { pn: '', pu: '', l: '', s: '', e: '', v: '' } },
    timetable: {
      v: 2,
      data: Object.fromEntries(
        Object.entries(opts.timetable ?? {}).map(([stopId, groups]) => [
          stopId,
          groups.map((g, idx) => ({ v: 2 as const, tp: g.tp, si: g.si ?? idx, d: g.d, a: g.d })),
        ]),
      ),
    },
    tripPatterns: {
      v: 2,
      data: Object.fromEntries(
        Object.entries(opts.patterns ?? {}).map(([pid, p]) => [
          pid,
          { v: 2 as const, r: p.r, h: 'Terminal', stops: p.stops },
        ]),
      ),
    },
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

/**
 * Run the same processing flow as build-global-insights.ts main().
 *
 * Reads DataBundles from disk, computes stopGeo, writes output.
 */
function runGlobalInsightsFlow(prefixes: string[], baseDir: string, outDir: string): void {
  const allStopEntries: StopEntry[] = [];

  for (const prefix of uniqueInOrder(prefixes)) {
    const dataPath = join(baseDir, prefix, 'data.json');
    if (!existsSync(dataPath)) {
      continue;
    }
    const raw = readFileSync(dataPath, 'utf-8');
    const bundle = JSON.parse(raw) as DataBundle;
    const sundayIds = findSundayServiceIds(bundle);
    const entries = extractStopEntries(bundle, sundayIds);
    allStopEntries.push(...entries);
  }

  const l0Stops: StopEntry[] = [];
  const l1Stops: StopEntry[] = [];
  const childrenMap = new Map<string, string[]>();
  for (const entry of allStopEntries) {
    if (entry.locationType === 0) {
      l0Stops.push(entry);
    } else if (entry.locationType === 1) {
      l1Stops.push(entry);
    }
    if (entry.parentStation) {
      const list = childrenMap.get(entry.parentStation) ?? [];
      list.push(entry.id);
      childrenMap.set(entry.parentStation, list);
    }
  }

  const l0Geo = buildStopGeo(l0Stops, GROUP_KEY);
  const l1Geo = buildParentStopGeo(l1Stops, childrenMap, l0Geo, l0Stops, GROUP_KEY);
  const allGeo = { ...l0Geo, ...l1Geo };
  writeGlobalInsightsBundle(outDir, allGeo);
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

describe('GlobalInsightsBundle assembly (local flow helper)', () => {
  it('produces a valid GlobalInsightsBundle from a single source', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.69, o: 139.77, l: 0 },
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }, { id: 's2' }] },
      },
      timetable: {
        s1: [{ tp: 'p1', d: { su: [480, 540] } }],
        s2: [{ tp: 'p1', d: { su: [490, 550] } }],
      },
    });
    writeDataBundle(join(srcDir, 'test-src'), bundle);

    runGlobalInsightsFlow(['test-src'], srcDir, outDir);

    const insightsPath = join(outDir, 'insights.json');
    expect(existsSync(insightsPath)).toBe(true);

    const result = JSON.parse(readFileSync(insightsPath, 'utf-8')) as GlobalInsightsBundle;
    expect(result.bundle_version).toBe(3);
    expect(result.kind).toBe('global-insights');
    expect(result.stopGeo).toBeDefined();
    expect(result.stopGeo!.v).toBe(1);
    expect(Object.keys(result.stopGeo!.data)).toHaveLength(2);
    expect(result.stopGeo!.data['s1']).toBeDefined();
    expect(result.stopGeo!.data['s2']).toBeDefined();
  });

  it('merges stops from multiple sources', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle1 = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [{ i: 'a:s1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 'a:s1' }] } },
      timetable: { 'a:s1': [{ tp: 'p1', d: { su: [480] } }] },
    });
    const bundle2 = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [{ i: 'b:s1', a: 35.69, o: 139.77, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 'b:s1' }] } },
      timetable: { 'b:s1': [{ tp: 'p1', d: { su: [500] } }] },
    });

    writeDataBundle(join(srcDir, 'src-a'), bundle1);
    writeDataBundle(join(srcDir, 'src-b'), bundle2);

    runGlobalInsightsFlow(['src-a', 'src-b'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;
    expect(Object.keys(result.stopGeo!.data)).toHaveLength(2);
    expect(result.stopGeo!.data['a:s1']).toBeDefined();
    expect(result.stopGeo!.data['b:s1']).toBeDefined();
  });

  it('computes nr for stops with different routes', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.681, o: 139.76, l: 0 }, // ~111m north
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
        p2: { r: 'r2', stops: [{ id: 's2' }] },
      },
      timetable: {
        s1: [{ tp: 'p1', d: { su: [480] } }],
        s2: [{ tp: 'p2', d: { su: [480] } }],
      },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;

    // s1 and s2 serve different routes, so nr should be the distance between them
    expect(result.stopGeo!.data['s1'].nr).toBeGreaterThan(0);
    expect(result.stopGeo!.data['s1'].nr).toBeLessThan(0.2); // ~111m
  });

  it('includes cn with connectivity metrics', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.6801, o: 139.76, l: 0 }, // ~11m, within 300m
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
        p2: { r: 'r2', stops: [{ id: 's2' }] },
      },
      timetable: {
        s1: [{ tp: 'p1', d: { su: [480, 540, 600] } }],
        s2: [{ tp: 'p2', d: { su: [490, 550] } }],
      },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;

    const s1Geo = result.stopGeo!.data['s1'];
    expect(s1Geo.cn).toBeDefined();
    expect(s1Geo.cn!['ho']).toBeDefined();
    expect(s1Geo.cn!['ho'].rc).toBe(2); // r1 + r2
    expect(s1Geo.cn!['ho'].freq).toBe(5); // 3 + 2
    expect(s1Geo.cn!['ho'].sc).toBe(1); // 1 nearby stop
  });

  it('dedupes duplicate prefixes so nearby stop counts are not inflated', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.6801, o: 139.76, l: 0 },
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
        p2: { r: 'r2', stops: [{ id: 's2' }] },
      },
      timetable: {
        s1: [{ tp: 'p1', d: { su: [480] } }],
        s2: [{ tp: 'p2', d: { su: [490] } }],
      },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src', 'src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;

    expect(result.stopGeo!.data['s1'].cn?.ho?.sc).toBe(1);
    expect(result.stopGeo!.data['s2'].cn?.ho?.sc).toBe(1);
  });

  it('handles l=1 parent stops with children', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [
        { i: 'p1', a: 35.68, o: 139.76, l: 1 },
        { i: 'c1', a: 35.68, o: 139.76, l: 0, ps: 'p1' },
        { i: 'c2', a: 35.68, o: 139.76, l: 0, ps: 'p1' },
        { i: 'other', a: 35.69, o: 139.77, l: 0 }, // far, different route
      ],
      patterns: {
        pa: { r: 'r1', stops: [{ id: 'c1' }] },
        pb: { r: 'r1', stops: [{ id: 'c2' }] },
        pc: { r: 'r2', stops: [{ id: 'other' }] },
      },
      timetable: {
        c1: [{ tp: 'pa', d: { su: [480] } }],
        c2: [{ tp: 'pb', d: { su: [490] } }],
        other: [{ tp: 'pc', d: { su: [500] } }],
      },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;

    // Parent should exist in output
    expect(result.stopGeo!.data['p1']).toBeDefined();
    // Children should also exist
    expect(result.stopGeo!.data['c1']).toBeDefined();
    expect(result.stopGeo!.data['c2']).toBeDefined();
    // Total: 3 l=0 + 1 l=1 = 4 entries
    expect(Object.keys(result.stopGeo!.data)).toHaveLength(4);
  });

  it('skips missing source prefixes gracefully', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
    });
    writeDataBundle(join(srcDir, 'exists'), bundle);

    // 'missing' prefix has no data.json
    runGlobalInsightsFlow(['exists', 'missing'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;
    expect(Object.keys(result.stopGeo!.data)).toHaveLength(1);
  });

  it('produces empty stopGeo when no Sunday services exist', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'wd', d: [1, 1, 1, 1, 1, 0, 0] }], // no Sunday
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 's1' }] } },
      timetable: { s1: [{ tp: 'p1', d: { wd: [480] } }] },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;
    // Stop exists but has no Sunday freq → routeFreqs empty → cn empty
    expect(result.stopGeo!.data['s1']).toBeDefined();
    expect(result.stopGeo!.data['s1'].nr).toBe(0);
  });

  it('keeps cn data for calendar_dates-only Sunday service', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [],
      exceptions: [{ i: 'svc-ex-su', d: '20260104', t: 1 }],
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 's1' }] } },
      timetable: { s1: [{ tp: 'p1', d: { 'svc-ex-su': [480] } }] },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;
    expect(result.stopGeo!.data['s1']).toBeDefined();
    expect(result.stopGeo!.data['s1'].cn).toEqual({
      ho: { rc: 1, freq: 1, sc: 0 },
    });
  });

  it('keeps cn data for weekday service added on Sunday by exception', () => {
    const srcDir = join(TMP_DIR, 'sources');
    const outDir = join(TMP_DIR, 'global');

    const bundle = makeDataBundle({
      services: [{ id: 'wd', d: [1, 1, 1, 1, 1, 0, 0] }],
      exceptions: [{ i: 'wd', d: '20260104', t: 1 }],
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 's1' }] } },
      timetable: { s1: [{ tp: 'p1', d: { wd: [480, 540] } }] },
    });
    writeDataBundle(join(srcDir, 'src'), bundle);

    runGlobalInsightsFlow(['src'], srcDir, outDir);

    const result = JSON.parse(
      readFileSync(join(outDir, 'insights.json'), 'utf-8'),
    ) as GlobalInsightsBundle;
    expect(result.stopGeo!.data['s1']).toBeDefined();
    expect(result.stopGeo!.data['s1'].cn).toEqual({
      ho: { rc: 1, freq: 2, sc: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// CLI flow exit-code tests
// ---------------------------------------------------------------------------

describe('build-global-insights.ts main() exit-code semantics', () => {
  function writeDataBundleAt(prefix: string, bundle: DataBundle): void {
    const filePath = join(MOCK_OUTPUT_DIR, prefix, 'data.json');
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(bundle));
  }

  beforeEach(() => {
    mockParseCliArg.mockReset();
    mockLoadTargetFile.mockReset();
    process.exitCode = undefined;
    rmSync(MOCK_OUTPUT_DIR, { recursive: true, force: true });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(MOCK_OUTPUT_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('exits 0 (EXIT_OK) and writes insights when every target has data.json', async () => {
    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 's1' }] } },
      timetable: { s1: [{ tp: 'p1', d: { su: [480] } }] },
    });
    writeDataBundleAt('alpha', bundle);

    mockParseCliArg.mockReturnValue({ kind: 'targets', path: '/tmp/targets.ts' });
    mockLoadTargetFile.mockResolvedValue(['alpha']);

    await runBuildGlobalInsightsMain();

    expect(process.exitCode).toBe(0);
    expect(existsSync(join(MOCK_OUTPUT_DIR, 'global', 'insights.json'))).toBe(true);
  });

  it('exits 1 (EXIT_WARN) and still writes insights when some prefixes are skipped', async () => {
    const bundle = makeDataBundle({
      services: [{ id: 'su', d: [0, 0, 0, 0, 0, 0, 1] }],
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: { p1: { r: 'r1', stops: [{ id: 's1' }] } },
      timetable: { s1: [{ tp: 'p1', d: { su: [480] } }] },
    });
    writeDataBundleAt('alpha', bundle);
    // no data.json for `gone`

    mockParseCliArg.mockReturnValue({ kind: 'targets', path: '/tmp/targets.ts' });
    mockLoadTargetFile.mockResolvedValue(['alpha', 'gone']);

    await runBuildGlobalInsightsMain();

    expect(process.exitCode).toBe(1);
    expect(existsSync(join(MOCK_OUTPUT_DIR, 'global', 'insights.json'))).toBe(true);
  });

  it('exits 2 (EXIT_ERROR) and skips the write when every prefix is missing', async () => {
    // No data.json on disk for any prefix.
    mockParseCliArg.mockReturnValue({ kind: 'targets', path: '/tmp/targets.ts' });
    mockLoadTargetFile.mockResolvedValue(['gone1', 'gone2']);

    await runBuildGlobalInsightsMain();

    expect(process.exitCode).toBe(2);
    expect(existsSync(join(MOCK_OUTPUT_DIR, 'global', 'insights.json'))).toBe(false);
  });

  it('exits 2 (EXIT_ERROR) when the CLI args are invalid (e.g. non-targets kind)', async () => {
    mockParseCliArg.mockReturnValue({ kind: 'unexpected' });

    await runBuildGlobalInsightsMain();

    expect(mockLoadTargetFile).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });
});
