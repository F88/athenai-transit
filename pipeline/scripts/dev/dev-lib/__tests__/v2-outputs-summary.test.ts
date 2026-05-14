import { describe, expect, it } from 'vitest';

import {
  V2_OUTPUTS_SECTION_DESCRIPTIONS,
  V2_OUTPUTS_SECTION_NAMES,
  analyzeV2GlobalSummary,
  analyzeV2Outputs,
  formatV2OutputsAnalysis,
  type V2OutputsRow,
} from '../v2-outputs-summary';
import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '../../../../../src/types/data/transit-v2-json';
import type { GlobalInsightsBundleSummary } from '../v2-global-insights-summary';

/**
 * Smoke tests for the main lib. Coordinates four sub libs (data /
 * insights / shapes / global-insights), so the focus here is
 * section composition, dispatch correctness, and combined Overall
 * summary — not the underlying analysis logic (which is covered in
 * each sub lib's test file).
 */

function createDataBundle(overrides?: Partial<DataBundle>): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: [{ v: 2, i: 'src:s1', n: 'Stop One', a: 35.0, o: 139.0, l: 0 }],
    },
    routes: {
      v: 2,
      data: [{ v: 2, i: 'src:r1', s: 'R1', l: 'Route 1', t: 3, c: '', tc: '', ai: 'src:a1' }],
    },
    agency: {
      v: 2,
      data: [{ v: 2, i: 'src:a1', n: 'Agency 1', u: 'https://example.com', tz: 'Asia/Tokyo' }],
    },
    calendar: { v: 1, data: { services: [], exceptions: [] } },
    feedInfo: {
      v: 1,
      data: { pn: '', pu: '', l: 'ja', s: '20260101', e: '20261231', v: '1.0' },
    },
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
    ...overrides,
  };
}

function createInsightsBundle(): InsightsBundle {
  return {
    bundle_version: 3,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [
        { key: 'wd', serviceIds: ['svc:wd'] },
        { key: 'sa', serviceIds: ['svc:sa'] },
        { key: 'su', serviceIds: ['svc:su'] },
      ],
    },
    tripPatternStats: {
      v: 1,
      data: {
        wd: { 'src:p1': { freq: 100, rd: [10, 0] } },
        sa: { 'src:p1': { freq: 60, rd: [10, 0] } },
        su: { 'src:p1': { freq: 40, rd: [10, 0] } },
      },
    },
  };
}

function createShapesBundle(): ShapesBundle {
  return {
    bundle_version: 3,
    kind: 'shapes',
    shapes: {
      v: 2,
      data: {
        'src:r1': [
          [
            [35.0, 139.0],
            [35.1, 139.1],
          ],
        ],
      },
    },
  };
}

function createGlobalBundle(): GlobalInsightsBundle {
  return {
    bundle_version: 3,
    kind: 'global-insights',
    stopGeo: {
      v: 1,
      data: {
        'src:s1': { nr: 0.5 },
        'src:s2': { nr: 1.2 },
      },
    },
  };
}

function makeRow(
  prefix: string,
  nameEn: string,
  dataSize: number,
  insights: InsightsBundle | null,
  shapesBundle: ShapesBundle | null = null,
): V2OutputsRow {
  return analyzeV2Outputs({
    prefix,
    nameEn,
    dataBundle: createDataBundle(),
    insights,
    shapesBundle,
    fileSizes: { data: dataSize, insights: 200, shapes: null, total: dataSize + 200 },
    gzipSizes: {
      data: Math.floor(dataSize / 4),
      insights: 60,
      shapes: null,
      total: Math.floor(dataSize / 4) + 60,
    },
  });
}

function emptyGlobal(): GlobalInsightsBundleSummary {
  return analyzeV2GlobalSummary({ bundle: null, fileSize: null, gzipSize: null });
}

describe('analyzeV2Outputs', () => {
  it('produces a combined row with every per-source sub lib filled', () => {
    const row = makeRow('src', 'Src Transit', 1000, createInsightsBundle(), createShapesBundle());
    expect(row.prefix).toBe('src');
    expect(row.data.counts.stops).toBe(1);
    // Fixture: wd=100, sa=60, su=40 → total=200, max=100
    expect(row.insights.tripVolume.tripsTotal).toBe(200);
    expect(row.insights.tripVolume.tripsMax).toBe(100);
    expect(row.insights.tripVolume.serviceGroupCount).toBe(3);
    expect(row.shapes.shapes.routes).toBe(1);
    expect(row.shapes.shapes.polylines).toBe(1);
    expect(row.shapes.shapes.points).toBe(2);
  });

  it('marks insights and shapes as null when their bundles are absent', () => {
    const row = makeRow('src', 'Src Transit', 1000, null, null);
    expect(row.insights.tripVolume.tripsTotal).toBeNull();
    expect(row.insights.tripVolume.tripsMax).toBeNull();
    expect(row.shapes.shapes.routes).toBeNull();
  });
});

describe('analyzeV2GlobalSummary', () => {
  it('computes stopGeo entry count from the bundle', () => {
    const summary = analyzeV2GlobalSummary({
      bundle: createGlobalBundle(),
      fileSize: 12345,
      gzipSize: 4321,
    });
    expect(summary.fileSize).toBe(12345);
    expect(summary.gzipSize).toBe(4321);
    expect(summary.stopGeoEntries).toBe(2);
  });

  it('returns null entries when the bundle is missing', () => {
    const summary = analyzeV2GlobalSummary({
      bundle: null,
      fileSize: null,
      gzipSize: null,
    });
    expect(summary.fileSize).toBeNull();
    expect(summary.gzipSize).toBeNull();
    expect(summary.stopGeoEntries).toBeNull();
  });
});

describe('formatV2OutputsAnalysis', () => {
  it('returns the no-data sentinel when both rows and global are empty', () => {
    expect(formatV2OutputsAnalysis([], emptyGlobal())).toBe('No v2 outputs found.');
  });

  it('emits header, Overall summary, and every default section (including global)', () => {
    const rows = [
      makeRow('a', 'Source A', 2_000_000, createInsightsBundle(), createShapesBundle()),
      makeRow('b', 'Source B', 500_000, null, null),
    ];
    const global = analyzeV2GlobalSummary({
      bundle: createGlobalBundle(),
      fileSize: 9999,
      gzipSize: 1234,
    });
    const output = formatV2OutputsAnalysis(rows, global, {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(output).toContain('# Athenai Transit — V2 outputs summary');
    expect(output).toContain('## Overall summary');
    expect(output).toContain('sources=2, sourcesWithInsights=1, sourcesWithShapes=1');
    expect(output).toContain('## File sizes (raw)');
    expect(output).toContain('## File sizes (gzip)');
    expect(output).toContain('## DataBundle counts (data.json)');
    expect(output).toContain('## InsightsBundle trip volume (insights.json)');
    expect(output).toContain('## ShapesBundle counts (shapes.json)');
    expect(output).toContain('## GlobalInsightsBundle counts (global/insights.json)');
    expect(output).toContain('## GlobalInsightsBundle (global/insights.json)');
    // global-insights-counts renders the stopGeo entry count.
    expect(output).toContain('stopGeo:  2');
  });

  it('sorts rows by prefix ascending regardless of file size', () => {
    const rows = [
      // Prefixes deliberately chosen so size order disagrees with
      // alphabetic order: 'zeta' is large, 'alpha' is small. A
      // size-based sort would put zeta first; the summarise tool
      // sorts by prefix, so alpha must come first.
      makeRow('zeta', 'Zeta Source', 5_000_000, createInsightsBundle()),
      makeRow('alpha', 'Alpha Source', 1000, createInsightsBundle()),
    ];
    const output = formatV2OutputsAnalysis(rows, emptyGlobal(), {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const alphaIndex = output.indexOf('Alpha Source');
    const zetaIndex = output.indexOf('Zeta Source');
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(zetaIndex).toBeGreaterThan(alphaIndex);
  });

  it('filters output to a single requested section across sub libs', () => {
    const rows = [makeRow('src', 'Src Transit', 1000, createInsightsBundle())];
    const output = formatV2OutputsAnalysis(rows, emptyGlobal(), {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
      sections: ['trip-volume'],
    });
    expect(output).toContain('## InsightsBundle trip volume (insights.json)');
    expect(output).not.toContain('## File sizes (raw)');
    expect(output).not.toContain('## DataBundle counts (data.json)');
    expect(output).not.toContain('## ShapesBundle counts');
    expect(output).not.toContain('## GlobalInsightsBundle');
  });

  it('routes a global section request even when rows are empty', () => {
    const global = analyzeV2GlobalSummary({
      bundle: createGlobalBundle(),
      fileSize: 100,
      gzipSize: 30,
    });
    const output = formatV2OutputsAnalysis([], global, {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
      sections: ['global-insights'],
    });
    expect(output).toContain('## GlobalInsightsBundle (global/insights.json)');
    // The renamed global-insights section now shows wp / cn coverage,
    // not entry counts (those live in global-insights-counts).
    expect(output).toContain('stops with wp:');
  });
});

describe('V2_OUTPUTS_SECTION_NAMES', () => {
  it('unions all four sub libs in a stable order', () => {
    expect(V2_OUTPUTS_SECTION_NAMES).toEqual([
      // Cross-bundle file size meta first.
      'file-sizes',
      'gzip-sizes',
      // Per-bundle generic counts (meta).
      'counts',
      'shapes-counts',
      'insights-counts',
      'global-insights-counts',
      // DataBundle detail.
      'feed-info',
      'agencies',
      'routes',
      'stops',
      'trip-patterns',
      'i18n-coverage',
      'periods',
      // Per-bundle detail (shapes, insights, global).
      'shapes-volume',
      'trip-volume',
      'global-insights',
    ]);
  });

  it('exposes a description entry per section', () => {
    const names = V2_OUTPUTS_SECTION_DESCRIPTIONS.map((entry) => entry.name);
    expect(names).toEqual(V2_OUTPUTS_SECTION_NAMES);
  });
});
