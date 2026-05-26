/**
 * Tests for build-data-source-catalog.ts script flow.
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';
import type { AggregateTargetResult } from '../../../../src/lib/pipeline/pipeline-utils';

const { mockParseCliArg, mockLoadTargetFile, mockBuildCatalog, mockWriteCatalog, outputDir } =
  vi.hoisted(() => ({
    mockParseCliArg: vi.fn(),
    mockLoadTargetFile: vi.fn(),
    mockBuildCatalog: vi.fn(),
    mockWriteCatalog: vi.fn(),
    outputDir: '/tmp/test-v2-output',
  }));

vi.mock('../../../../src/lib/paths', () => ({
  V2_OUTPUT_DIR: outputDir,
}));

vi.mock('../../../../src/lib/pipeline/app-data-v2/build-data-source-catalog', () => ({
  buildDataSourceCatalogBundle: mockBuildCatalog,
}));

vi.mock('../../../../src/lib/pipeline/app-data-v2/bundle-writer', () => ({
  writeDataSourceCatalogBundle: mockWriteCatalog,
}));

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

import { main } from '../build-data-source-catalog';

function makeCatalogBundle(): DataSourceCatalogBundle {
  return {
    bundle_version: 3,
    kind: 'data-source-catalog',
    metadata: {
      v: 1,
      data: {
        createdAt: '2026-05-15T00:00:00.000Z',
      },
    },
    sources: {
      v: 1,
      data: {
        testpfx: {
          summary: {
            periods: {
              feedValidity: { start: null, end: null },
              servicePeriod: { start: null, end: null },
              exceptionRange: { start: null, end: null },
            },
            agencies: [],
            i18n: { languages: [] },
            routes: { typeCounts: {} },
            stops: {
              locationTypes: {},
              geo: { bbox: null },
            },
            service: {
              maxTripsPerDay: 0,
            },
            shapes: {
              available: false,
              routeCount: 0,
            },
          },
          bundles: {
            dataBundle: {
              file: { sizeBytes: 1 },
              counts: {
                stops: 0,
                routes: 0,
                agency: 0,
                calendar: 0,
                feedInfo: 0,
                timetable: 0,
                tripPatterns: 0,
                translations: 0,
                lookup: 0,
              },
            },
            insightsBundle: {
              file: { sizeBytes: 1 },
              counts: {
                serviceGroups: 0,
                tripPatternStats: 0,
                tripPatternGeo: 0,
                stopStats: 0,
              },
            },
          },
        },
      },
    },
    globalInsights: {
      v: 1,
      data: {
        file: { sizeBytes: 1 },
        counts: { stopGeo: 0 },
      },
    },
  };
}

beforeEach(() => {
  mockParseCliArg.mockReset();
  mockLoadTargetFile.mockReset();
  mockBuildCatalog.mockReset();
  mockWriteCatalog.mockReset();
  process.exitCode = undefined;

  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('build-data-source-catalog.ts', () => {
  it('prints usage and returns for --help', async () => {
    mockParseCliArg.mockReturnValue({ kind: 'help' });

    await main();

    expect(mockLoadTargetFile).not.toHaveBeenCalled();
    expect(mockBuildCatalog).not.toHaveBeenCalled();
    expect(mockWriteCatalog).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>',
    );
    expect(process.exitCode).toBeUndefined();
  });

  it('sets exitCode to EXIT_ERROR (2) when CLI args are invalid', async () => {
    mockParseCliArg.mockReturnValue({ kind: 'unexpected' });

    await main();

    expect(mockLoadTargetFile).not.toHaveBeenCalled();
    expect(mockBuildCatalog).not.toHaveBeenCalled();
    expect(mockWriteCatalog).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it('writes catalog and exits 0 when every result is ok', async () => {
    const bundle = makeCatalogBundle();
    const results: AggregateTargetResult[] = [
      { prefix: 'testpfx', status: 'ok', reason: '', durationMs: 10 },
    ];

    mockParseCliArg.mockReturnValue({
      kind: 'targets',
      path: '/tmp/catalog-targets.ts',
    });
    mockLoadTargetFile.mockResolvedValue(['testpfx']);
    mockBuildCatalog.mockResolvedValue({ bundle, results });

    await main();

    expect(mockLoadTargetFile).toHaveBeenCalledWith('/tmp/catalog-targets.ts');
    expect(mockBuildCatalog).toHaveBeenCalledWith(['testpfx']);
    expect(mockWriteCatalog).toHaveBeenCalledWith('/tmp/test-v2-output/global', bundle);
    expect(process.exitCode).toBe(0);
  });

  it('writes a partial catalog and exits EXIT_WARN (1) when some prefixes are skipped', async () => {
    const bundle = makeCatalogBundle();
    const results: AggregateTargetResult[] = [
      { prefix: 'testpfx', status: 'ok', reason: '', durationMs: 10 },
      { prefix: 'gone', status: 'skipped', reason: 'data.json not found', durationMs: 1 },
    ];

    mockParseCliArg.mockReturnValue({
      kind: 'targets',
      path: '/tmp/catalog-targets.ts',
    });
    mockLoadTargetFile.mockResolvedValue(['testpfx', 'gone']);
    mockBuildCatalog.mockResolvedValue({ bundle, results });

    await main();

    expect(mockWriteCatalog).toHaveBeenCalledWith('/tmp/test-v2-output/global', bundle);
    expect(process.exitCode).toBe(1);
  });

  it('does NOT write catalog and exits EXIT_ERROR (2) when every prefix is skipped', async () => {
    const bundle = makeCatalogBundle();
    const results: AggregateTargetResult[] = [
      { prefix: 'gone1', status: 'skipped', reason: 'data.json not found', durationMs: 1 },
      { prefix: 'gone2', status: 'skipped', reason: 'data.json not found', durationMs: 1 },
    ];

    mockParseCliArg.mockReturnValue({
      kind: 'targets',
      path: '/tmp/catalog-targets.ts',
    });
    mockLoadTargetFile.mockResolvedValue(['gone1', 'gone2']);
    mockBuildCatalog.mockResolvedValue({ bundle, results });

    await main();

    expect(mockWriteCatalog).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it('sets exitCode to EXIT_ERROR (2) on fatal throw from the library', async () => {
    mockParseCliArg.mockReturnValue({
      kind: 'targets',
      path: '/tmp/catalog-targets.ts',
    });
    mockLoadTargetFile.mockResolvedValue(['testpfx']);
    mockBuildCatalog.mockRejectedValue(new Error('boom'));

    await main();

    expect(mockWriteCatalog).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('\nFATAL: boom');
    expect(process.exitCode).toBe(2);
  });
});
