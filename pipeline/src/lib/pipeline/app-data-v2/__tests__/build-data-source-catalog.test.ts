/**
 * Tests for build-data-source-catalog.ts.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '@contracts/data/transit-v2-json';

const { TMP_DIR } = vi.hoisted(() => ({
  TMP_DIR: `${import.meta.dirname}/.tmp-build-data-source-catalog-test`,
}));

vi.mock('../../../paths', () => ({
  V2_OUTPUT_DIR: TMP_DIR,
}));

vi.mock('../../../resources/load-gtfs-sources', () => ({
  loadAllGtfsSources: vi.fn().mockResolvedValue([
    {
      pipeline: {
        prefix: 'testpfx',
      },
    },
  ]),
}));

vi.mock('../../../resources/load-odpt-train-sources', () => ({
  discoverOdptTrainSources: vi.fn().mockResolvedValue([]),
}));

import { buildDataSourceCatalogBundle } from '../build-data-source-catalog';

function writeJson(relativePath: string, data: unknown): void {
  const filePath = join(TMP_DIR, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function makeDataBundle(): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: [
        { v: 2, i: 'testpfx:S1', n: 'Stop 1', a: 35.1, o: 139.1, l: 0 },
        { v: 2, i: 'testpfx:S2', n: 'Stop 2', a: 35.3, o: 139.4, l: 1 },
        { v: 2, i: 'testpfx:S3', n: 'Stop 3', a: 35.2, o: 139.2, l: 0, ps: 'testpfx:S2' },
      ],
    },
    routes: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'testpfx:R1',
          s: '1',
          l: 'Route 1',
          t: 3,
          c: 'FFFFFF',
          tc: '000000',
          ai: 'testpfx:A1',
        },
        {
          v: 2,
          i: 'testpfx:R2',
          s: '2',
          l: 'Route 2',
          t: 3,
          c: 'EEEEEE',
          tc: '111111',
          ai: 'testpfx:A1',
        },
        {
          v: 2,
          i: 'testpfx:R3',
          s: '3',
          l: 'Route 3',
          t: 2,
          c: 'DDDDDD',
          tc: '222222',
          ai: 'testpfx:A1',
        },
      ],
    },
    agency: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'testpfx:A1',
          n: 'Test Agency',
          u: 'https://example.com',
          tz: 'Asia/Tokyo',
          l: 'ja',
        },
      ],
    },
    calendar: {
      v: 1,
      data: {
        services: [
          { i: 'svc:1', s: '2026-05-01', e: '2026-05-31', d: [1, 1, 1, 1, 1, 0, 0] },
          { i: 'svc:2', s: '2026-04-01', e: '2026-06-30', d: [0, 0, 0, 0, 0, 1, 1] },
        ],
        exceptions: [
          { i: 'svc:1', d: '2026-04-29', t: 1 },
          { i: 'svc:1', d: '2026-05-03', t: 2 },
        ],
      },
    },
    feedInfo: {
      v: 1,
      data: {
        pn: 'Publisher',
        pu: 'https://publisher.example.com',
        l: 'ja',
        s: '2026-04-01',
        e: '2026-06-30',
        v: '2026.05',
      },
    },
    timetable: {
      v: 2,
      data: {
        'testpfx:jp:weekday': [],
      },
    },
    tripPatterns: {
      v: 2,
      data: {
        'testpfx:TP1': {
          v: 2,
          r: 'testpfx:R1',
          h: 'Downtown',
          dir: 0,
          stops: [{ id: 'testpfx:S1' }, { id: 'testpfx:S3' }],
        },
      },
    },
    translations: {
      v: 1,
      data: {
        agency_names: {
          'testpfx:A1': { en: 'Test Agency', ja: 'テスト交通' },
        },
        route_long_names: {
          'testpfx:R1': { en: 'Route 1', fr: 'Ligne 1' },
        },
        route_short_names: {},
        stop_names: {},
        trip_headsigns: {},
        stop_headsigns: {},
      },
    },
    lookup: {
      v: 2,
      data: {},
    },
  };
}

function makeInsightsBundle(): InsightsBundle {
  return {
    bundle_version: 3,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [
        { key: 'weekday', serviceIds: ['svc:1'] },
        { key: 'weekend', serviceIds: ['svc:2'] },
      ],
    },
    tripPatternStats: {
      v: 1,
      data: {
        weekday: {
          'testpfx:TP1': {
            freq: 2,
            rd: [12, 0],
          },
        },
      },
    },
    tripPatternGeo: {
      v: 1,
      data: {
        'testpfx:TP1': {
          dist: 1.2,
          pathDist: 1.4,
          cl: false,
        },
      },
    },
    stopStats: {
      v: 1,
      data: {
        weekday: {
          'testpfx:S1': {
            freq: 2,
            rc: 1,
            rtc: 1,
            ed: 480,
            ld: 540,
          },
        },
      },
    },
  };
}

function makeShapesBundle(): ShapesBundle {
  return {
    bundle_version: 3,
    kind: 'shapes',
    shapes: {
      v: 2,
      data: {
        'testpfx:R1': [
          [
            [35.1, 139.1],
            [35.2, 139.2],
            [35.3, 139.4],
          ],
        ],
      },
    },
  };
}

function makeGlobalInsightsBundle(): GlobalInsightsBundle {
  return {
    bundle_version: 3,
    kind: 'global-insights',
    stopGeo: {
      v: 1,
      data: {
        'testpfx:S1': { nr: 0 },
        'testpfx:S2': { nr: 0 },
      },
    },
  };
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('buildDataSourceCatalogBundle', () => {
  it('builds spec fields from per-source and global bundles', async () => {
    writeJson('testpfx/data.json', makeDataBundle());
    writeJson('testpfx/insights.json', makeInsightsBundle());
    writeJson('testpfx/shapes.json', makeShapesBundle());
    writeJson('global/insights.json', makeGlobalInsightsBundle());

    const bundle = await buildDataSourceCatalogBundle(['testpfx']);
    const source = bundle.sources.data.testpfx;

    expect(bundle.bundle_version).toBe(3);
    expect(bundle.kind).toBe('data-source-catalog');
    expect(Number.isNaN(Date.parse(bundle.metadata.data.createdAt))).toBe(false);

    expect(source.summary.periods.feedValidity).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(source.summary.periods.servicePeriod).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(source.summary.periods.exceptionRange).toEqual({
      start: '2026-04-29',
      end: '2026-05-03',
    });
    expect(source.summary.agencies).toEqual([
      { name: 'Test Agency', lang: 'ja', timezone: 'Asia/Tokyo' },
    ]);
    expect(source.summary.i18n.languages).toEqual(['en', 'fr', 'ja']);
    expect(source.summary.routes.typeCounts).toEqual({
      '2': 1,
      '3': 2,
    });
    expect(source.summary.stops.locationTypes).toEqual({
      '0': { count: 2, hasParentCount: 1 },
      '1': { count: 1, hasParentCount: 0 },
    });
    expect(source.summary.stops.geo.bbox).toEqual({
      latMin: 35.1,
      latMax: 35.3,
      lonMin: 139.1,
      lonMax: 139.4,
    });

    expect(source.bundles.dataBundle.counts).toEqual({
      stops: 3,
      routes: 3,
      agency: 1,
      calendar: 2,
      feedInfo: 1,
      timetable: 1,
      tripPatterns: 1,
      translations: 2,
      lookup: 0,
    });
    expect(source.bundles.insightsBundle.counts).toEqual({
      serviceGroups: 2,
      tripPatternStats: 1,
      tripPatternGeo: 1,
      stopStats: 1,
    });
    expect(source.bundles.shapesBundle?.counts).toEqual({
      routes: 1,
    });
    expect(source.bundles.shapesBundle?.volume.polylines).toBe(1);
    expect(source.bundles.shapesBundle?.volume.points).toBe(3);
    expect(source.bundles.shapesBundle?.volume.totalLengthKm).toBeGreaterThan(0);

    expect(source.bundles.dataBundle.file.sizeBytes).toBeGreaterThan(0);
    expect(source.bundles.insightsBundle.file.sizeBytes).toBeGreaterThan(0);
    expect(source.bundles.shapesBundle?.file.sizeBytes).toBeGreaterThan(0);
    expect(bundle.globalInsights.data.file.sizeBytes).toBeGreaterThan(0);
    expect(bundle.globalInsights.data.counts.stopGeo).toBe(2);
  });

  it('omits shapesBundle when shapes.json does not exist', async () => {
    writeJson('testpfx/data.json', makeDataBundle());
    writeJson('testpfx/insights.json', makeInsightsBundle());
    writeJson('global/insights.json', makeGlobalInsightsBundle());

    const bundle = await buildDataSourceCatalogBundle(['testpfx']);

    expect(bundle.sources.data.testpfx.bundles.shapesBundle).toBeUndefined();
  });

  it('throws for unknown target prefixes', async () => {
    writeJson('global/insights.json', makeGlobalInsightsBundle());

    await expect(buildDataSourceCatalogBundle(['unknown-prefix'])).rejects.toThrow(
      'Unknown target prefix: unknown-prefix',
    );
  });
});
