import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchDataSourceV2 } from '../fetch-data-source-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal valid DataBundle JSON. */
function makeDataBundle() {
  return {
    bundle_version: 2,
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
        headsigns: {},
        stop_headsigns: {},
        stop_names: {},
        route_names: {},
        agency_names: {},
        agency_short_names: {},
      },
    },
    lookup: { v: 2, data: {} },
  };
}

/** Create a minimal valid ShapesBundle JSON. */
function makeShapesBundle() {
  return { bundle_version: 2, kind: 'shapes', shapes: { v: 2, data: {} } };
}

/** Create a minimal valid InsightsBundle JSON. */
function makeInsightsBundle() {
  return { bundle_version: 2, kind: 'insights', serviceGroups: { v: 1, data: [] } };
}

/** Create a minimal valid GlobalInsightsBundle JSON. */
function makeGlobalInsightsBundle() {
  return { bundle_version: 2, kind: 'global-insights' };
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
      expect(result.data.bundle_version).toBe(2);
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

    it('throws on wrong bundle kind', async () => {
      const bad = { ...makeDataBundle(), kind: 'shapes' };
      fetchMock.mockResolvedValueOnce(jsonResponse(bad));
      const ds = new FetchDataSourceV2();
      await expect(ds.loadData('tobus')).rejects.toThrow('invalid bundle kind');
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
});
