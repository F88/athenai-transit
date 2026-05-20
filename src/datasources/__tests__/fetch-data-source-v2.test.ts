import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FetchDataSourceV2,
  formatTransferSummary,
  selectResourceTimingEntry,
  validateBasePath,
} from '../fetch-data-source-v2';
import { configureLogger, getLoggerConfig } from '../../lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal valid DataBundle JSON. */
function makeDataBundle() {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: { v: 2, data: [{ v: 2, i: 's1', n: 'Stop 1', a: 35.0, o: 139.0, l: 0 }] },
    routes: {
      v: 2,
      data: [{ v: 2, i: 'r1', s: 'R1', l: 'Route 1', t: 3, c: '', tc: '', ai: 'a1' }],
    },
    agency: { v: 1, data: [] },
    calendar: { v: 1, data: { services: [], exceptions: [] } },
    feedInfo: { v: 1, data: { v: '1', s: '20260101', e: '20261231' } },
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

/** Create a minimal valid ShapesBundle JSON. */
function makeShapesBundle() {
  return { bundle_version: 3, kind: 'shapes', shapes: { v: 2, data: {} } };
}

/** Create a minimal valid InsightsBundle JSON. */
function makeInsightsBundle() {
  return { bundle_version: 3, kind: 'insights', serviceGroups: { v: 1, data: [] } };
}

/** Create a minimal valid GlobalInsightsBundle JSON. */
function makeGlobalInsightsBundle() {
  return { bundle_version: 3, kind: 'global-insights' };
}

/** Create a minimal valid DataSourceCatalogBundle JSON. */
function makeDataSourceCatalogBundle() {
  return {
    bundle_version: 3,
    kind: 'data-source-catalog',
    metadata: { v: 1, data: { createdAt: '2026-05-15T00:00:00Z' } },
    sources: { v: 1, data: {} },
    globalInsights: { v: 1, data: { file: { sizeBytes: 0 }, counts: { stopGeo: 0 } } },
  };
}

/** Create a mock Response with JSON body and application/json content-type. */
function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Create a mock Response with HTML body (SPA fallback simulation). */
function htmlResponse(status = 200): Response {
  return new Response('<html><body>Not Found</body></html>', {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

/** Create a mock Response with invalid JSON body but application/json content-type. */
function brokenJsonResponse(): Response {
  return new Response('{"broken json', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Create a 404 Response. */
function notFoundResponse(): Response {
  return new Response('', { status: 404 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FetchDataSourceV2', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- loadData ---

  describe('loadData', () => {
    it('returns SourceDataV2 for a valid data bundle', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataBundle()));
      const ds = new FetchDataSourceV2();
      const result = await ds.loadData('tobus');

      expect(result.prefix).toBe('tobus');
      expect(result.data.kind).toBe('data');
      expect(result.data.bundle_version).toBe(3);
      expect(result.data.stops.data).toHaveLength(1);
      expect(result.data.routes.data).toHaveLength(1);
    });

    it('uses custom basePath in fetch URL', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataBundle()));
      const ds = new FetchDataSourceV2('/custom/path');
      await ds.loadData('tobus');

      expect(fetchMock).toHaveBeenCalledWith(
        '/custom/path/tobus/data.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });

    it('normalizes trailing slash in basePath', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataBundle()));
      const ds = new FetchDataSourceV2('/custom/path/');
      await ds.loadData('tobus');

      expect(fetchMock).toHaveBeenCalledWith(
        '/custom/path/tobus/data.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });

    it('throws on invalid prefix', async () => {
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('../etc')).rejects.toThrow('Invalid prefix');
      await expect(ds.loadData('has space')).rejects.toThrow('Invalid prefix');
      await expect(ds.loadData('UPPER')).rejects.toThrow('Invalid prefix');
    });

    it('throws on HTTP 404', async () => {
      fetchMock.mockResolvedValueOnce(notFoundResponse());
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('HTTP 404');
    });

    it('throws on non-JSON content-type (SPA fallback)', async () => {
      fetchMock.mockResolvedValueOnce(htmlResponse());
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('possible SPA fallback');
    });

    it('throws on invalid bundle_version', async () => {
      const bad = { ...makeDataBundle(), bundle_version: 1 };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('invalid bundle_version');
    });

    it('emits failed instead of succeeded when envelope validation fails', async () => {
      const bad = { ...makeDataBundle(), bundle_version: 1 };
      const events: string[] = [];
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      ds.setLoadEventReporter((event) => {
        events.push(event.type);
      });

      await expect(ds.loadData('tobus')).rejects.toThrow('invalid bundle_version');
      expect(events).toEqual(['started', 'failed']);
    });

    it('throws on wrong bundle kind', async () => {
      const bad = { ...makeDataBundle(), kind: 'shapes' };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('invalid bundle kind');
    });

    it('throws on JSON parse error', async () => {
      fetchMock.mockResolvedValueOnce(brokenJsonResponse());
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('JSON parse error');
    });

    it('throws on network error', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('network error');
    });

    it('throws on timeout', async () => {
      // Simulate AbortController timeout by rejecting with AbortError
      fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));
      const ds = new FetchDataSourceV2('/data-v2', 100);
      await expect(ds.loadData('tobus')).rejects.toThrow('timeout');
    });

    it('does not fail a successful fetch when debug logging is enabled without location', async () => {
      const loggerConfig = getLoggerConfig();
      const originalLocation = globalThis.location;
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      configureLogger({
        level: 'debug',
        enabledTags: ['FetchDataSourceV2'],
        tagLevels: { ...loggerConfig.tagLevels },
      });
      vi.stubGlobal('location', undefined);
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataBundle()));

      try {
        const ds = new FetchDataSourceV2();
        await expect(ds.loadData('tobus')).resolves.toMatchObject({ prefix: 'tobus' });
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining('[FetchDataSourceV2]'),
          expect.stringContaining(
            'fetch metrics: tobus/data.json: estimated 0.6KB decoded (transfer size unavailable)',
          ),
        );
      } finally {
        configureLogger({
          level: loggerConfig.level,
          enabledTags: [...loggerConfig.enabledTags],
          tagLevels: { ...loggerConfig.tagLevels },
        });
        vi.stubGlobal('location', originalLocation);
      }
    });

    it('uses PerformanceObserver metrics in the debug log when available', async () => {
      const loggerConfig = getLoggerConfig();
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const performanceNowSpy = vi
        .spyOn(performance, 'now')
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(22)
        .mockReturnValueOnce(27);
      const resolvedUrl = new URL('/data-v2/tobus/data.json', globalThis.location.href).href;
      const entry = {
        entryType: 'resource',
        name: resolvedUrl,
        startTime: 15,
        transferSize: 1536,
        encodedBodySize: 1024,
        decodedBodySize: 2048,
      } as PerformanceResourceTiming;

      class MockPerformanceObserver {
        observe = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => [entry as unknown as PerformanceEntry]);

        constructor(_callback: PerformanceObserverCallback) {}
      }

      configureLogger({
        level: 'debug',
        enabledTags: ['FetchDataSourceV2'],
        tagLevels: { ...loggerConfig.tagLevels },
      });
      vi.stubGlobal(
        'PerformanceObserver',
        MockPerformanceObserver as unknown as typeof PerformanceObserver,
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataBundle()));

      try {
        const ds = new FetchDataSourceV2();
        await expect(ds.loadData('tobus')).resolves.toMatchObject({ prefix: 'tobus' });
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining('[FetchDataSourceV2]'),
          expect.stringContaining(
            'fetch metrics: tobus/data.json: 1.0KB over the wire, 2.0KB decoded',
          ),
        );
      } finally {
        configureLogger({
          level: loggerConfig.level,
          enabledTags: [...loggerConfig.enabledTags],
          tagLevels: { ...loggerConfig.tagLevels },
        });
        performanceNowSpy.mockRestore();
      }
    });

    it('disconnects PerformanceObserver even when fetch returns null early', async () => {
      const loggerConfig = getLoggerConfig();
      const observerInstances: MockPerformanceObserver[] = [];

      class MockPerformanceObserver {
        observe = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);

        constructor(_callback: PerformanceObserverCallback) {
          observerInstances.push(this);
        }
      }

      configureLogger({
        level: 'debug',
        enabledTags: ['FetchDataSourceV2'],
        tagLevels: { ...loggerConfig.tagLevels },
      });
      vi.stubGlobal(
        'PerformanceObserver',
        MockPerformanceObserver as unknown as typeof PerformanceObserver,
      );
      fetchMock.mockResolvedValueOnce(notFoundResponse());

      try {
        const ds = new FetchDataSourceV2();
        await expect(ds.loadShapes('tobus')).resolves.toBeNull();
        expect(observerInstances).toHaveLength(1);
        expect(observerInstances[0].disconnect).toHaveBeenCalledTimes(1);
      } finally {
        configureLogger({
          level: loggerConfig.level,
          enabledTags: [...loggerConfig.enabledTags],
          tagLevels: { ...loggerConfig.tagLevels },
        });
      }
    });
  });

  // --- loadShapes (optional) ---

  describe('loadShapes', () => {
    it('returns ShapesBundle for a valid response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeShapesBundle()));
      const ds = new FetchDataSourceV2();
      const result = await ds.loadShapes('tobus');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('shapes');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(notFoundResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadShapes('tobus')).toBeNull();
    });

    it('returns null on SPA fallback (HTML response)', async () => {
      fetchMock.mockResolvedValueOnce(htmlResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadShapes('tobus')).toBeNull();
    });

    it('returns null on network error', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const ds = new FetchDataSourceV2();
      expect(await ds.loadShapes('tobus')).toBeNull();
    });

    it('returns null on JSON parse error', async () => {
      fetchMock.mockResolvedValueOnce(brokenJsonResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadShapes('tobus')).toBeNull();
    });

    it('warns on JSON parse error before skipping an optional bundle', async () => {
      const loggerConfig = getLoggerConfig();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      configureLogger({
        level: 'debug',
        enabledTags: ['FetchDataSourceV2'],
        tagLevels: { ...loggerConfig.tagLevels },
      });
      fetchMock.mockResolvedValueOnce(brokenJsonResponse());

      try {
        const ds = new FetchDataSourceV2();
        await expect(ds.loadShapes('tobus')).resolves.toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[FetchDataSourceV2]'),
          expect.stringContaining('tobus/shapes.json: JSON parse error (optional, skipping)'),
          expect.any(SyntaxError),
        );
      } finally {
        configureLogger({
          level: loggerConfig.level,
          enabledTags: [...loggerConfig.enabledTags],
          tagLevels: { ...loggerConfig.tagLevels },
        });
      }
    });

    it('returns null on timeout', async () => {
      fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));
      const ds = new FetchDataSourceV2('/data-v2', 100);
      expect(await ds.loadShapes('tobus')).toBeNull();
    });

    it('throws on invalid bundle kind', async () => {
      const bad = { ...makeShapesBundle(), kind: 'data' };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadShapes('tobus')).rejects.toThrow('invalid bundle kind');
    });
  });

  // --- loadInsights (optional) ---

  describe('loadInsights', () => {
    it('returns InsightsBundle for a valid response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeInsightsBundle()));
      const ds = new FetchDataSourceV2();
      const result = await ds.loadInsights('tobus');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('insights');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(notFoundResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadInsights('tobus')).toBeNull();
    });
  });

  // --- loadGlobalInsights (optional) ---

  describe('loadGlobalInsights', () => {
    it('returns GlobalInsightsBundle for a valid response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeGlobalInsightsBundle()));
      const ds = new FetchDataSourceV2();
      const result = await ds.loadGlobalInsights();

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('global-insights');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(notFoundResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadGlobalInsights()).toBeNull();
    });

    it('does not require prefix validation', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeGlobalInsightsBundle()));
      const ds = new FetchDataSourceV2();
      // Should not throw — no prefix involved
      await expect(ds.loadGlobalInsights()).resolves.not.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        '/data-v2/global/insights.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });
  });

  // --- loadDataSourceCatalog (optional) ---

  describe('loadDataSourceCatalog', () => {
    it('returns DataSourceCatalogBundle for a valid response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataSourceCatalogBundle()));
      const ds = new FetchDataSourceV2();
      const result = await ds.loadDataSourceCatalog();

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('data-source-catalog');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(notFoundResponse());
      const ds = new FetchDataSourceV2();
      expect(await ds.loadDataSourceCatalog()).toBeNull();
    });

    it('throws on invalid bundle_version', async () => {
      const bad = { ...makeDataSourceCatalogBundle(), bundle_version: 2 };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadDataSourceCatalog()).rejects.toThrow('invalid bundle_version');
    });

    it('throws on invalid bundle kind', async () => {
      const bad = { ...makeDataSourceCatalogBundle(), kind: 'data' };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadDataSourceCatalog()).rejects.toThrow('invalid bundle kind');
    });

    it('fetches from global/data-source-catalog.json', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataSourceCatalogBundle()));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadDataSourceCatalog()).resolves.not.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        '/data-v2/global/data-source-catalog.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });

    it('uses the catalog-specific 5s timeout, not the instance default', async () => {
      // The PR keeps catalog-related boot delay bounded by passing
      // { timeoutMs: CATALOG_TIMEOUT_MS } (5_000) to fetchOptionalBundle.
      // This regression test asserts the override actually flows to the
      // abort timer; without it, removing the override would silently fall
      // back to the (much longer) instance default and no test would notice.
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      fetchMock.mockResolvedValueOnce(jsonResponse(makeDataSourceCatalogBundle()));
      // Use a non-default instance timeout so the assertion is not satisfied
      // by accident (e.g. if CATALOG_TIMEOUT_MS happened to equal the default).
      const ds = new FetchDataSourceV2('/data-v2', 60_000);
      await ds.loadDataSourceCatalog();

      const timeoutValues = setTimeoutSpy.mock.calls
        .map(([, ms]) => ms)
        .filter((v): v is number => typeof v === 'number');
      expect(timeoutValues).toContain(5_000);
      expect(timeoutValues).not.toContain(60_000);
    });
  });
});

// ---------------------------------------------------------------------------
// validateBasePath
// ---------------------------------------------------------------------------

describe('validateBasePath', () => {
  it('returns value unchanged when it starts with /', () => {
    expect(validateBasePath('/data-v2')).toBe('/data-v2');
  });

  it('prepends / when value does not start with /', () => {
    expect(validateBasePath('data-v2')).toBe('/data-v2');
  });

  it('throws on path traversal', () => {
    expect(() => validateBasePath('../foo')).toThrow('Invalid VITE_TRANSIT_DATA_PATH');
  });

  it('throws on absolute path with subdirectories', () => {
    expect(() => validateBasePath('/foo/bar')).toThrow('Invalid VITE_TRANSIT_DATA_PATH');
  });

  it('throws on empty string', () => {
    expect(() => validateBasePath('/')).toThrow('Invalid VITE_TRANSIT_DATA_PATH');
  });
});

// ---------------------------------------------------------------------------
// selectResourceTimingEntry
// ---------------------------------------------------------------------------

describe('selectResourceTimingEntry', () => {
  /** Build a minimal Resource Timing entry carrying only `startTime`. */
  function entryAt(startTime: number): PerformanceResourceTiming {
    return { startTime } as unknown as PerformanceResourceTiming;
  }

  it('returns undefined for an empty entry list', () => {
    expect(selectResourceTimingEntry([], 100)).toBeUndefined();
  });

  it('returns undefined when every entry started before sinceTime', () => {
    const entries = [entryAt(10), entryAt(50), entryAt(99)];
    expect(selectResourceTimingEntry(entries, 100)).toBeUndefined();
  });

  it('returns the only entry started at or after sinceTime', () => {
    const target = entryAt(150);
    expect(selectResourceTimingEntry([entryAt(10), target], 100)).toBe(target);
  });

  it('includes an entry whose startTime equals sinceTime exactly', () => {
    const target = entryAt(100);
    expect(selectResourceTimingEntry([target], 100)).toBe(target);
  });

  it('returns the earliest entry when several started after sinceTime', () => {
    // The current fetch produced the earliest qualifying entry; later ones
    // belong to subsequent loads of the same URL.
    const earliest = entryAt(120);
    const entries = [entryAt(50), earliest, entryAt(300), entryAt(180)];
    expect(selectResourceTimingEntry(entries, 100)).toBe(earliest);
  });
});

// ---------------------------------------------------------------------------
// formatTransferSummary
// ---------------------------------------------------------------------------

describe('formatTransferSummary', () => {
  it('falls back to the decoded text length when metrics are unavailable', () => {
    // 4096 UTF-16 code units / 1024 = 4.0 KB
    expect(formatTransferSummary(null, 4096)).toBe(
      'estimated 4.0KB decoded (transfer size unavailable)',
    );
  });

  it('reports when the response required no network transfer', () => {
    const metrics = {
      transferSize: 0,
      encodedBodySize: 512,
      decodedBodySize: 2048,
      noNetworkTransfer: true,
    };
    expect(formatTransferSummary(metrics, 0)).toBe('no network transfer, 2.0KB decoded');
  });

  it('reports wire and decoded sizes for a network fetch', () => {
    const metrics = {
      transferSize: 1500,
      encodedBodySize: 1024,
      decodedBodySize: 10240,
      noNetworkTransfer: false,
    };
    expect(formatTransferSummary(metrics, 0)).toBe('1.0KB over the wire, 10.0KB decoded');
  });
});
