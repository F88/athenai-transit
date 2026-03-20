import { describe, expect, it } from 'vitest';
import { detectWarnings, extractDateParam, extractUrlBase } from '../check-warnings';
import type { RemoteResource, ResourceSnapshot, LocalInfo } from '../check-warnings';
import type { DownloadMetaSuccess } from '../../download/download-meta';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeRemote(date: string, available: boolean, feedEnd = '2026-12-31'): RemoteResource {
  return {
    url: `https://api.odpt.org/api/v4/files/odpt/TestBus/AllLines.zip?date=${date}`,
    is_feed_available_period: available,
    feed_end_date: feedEnd,
  };
}

function makeMeta(date: string, feedEndDate = '20261231'): DownloadMetaSuccess {
  return {
    sourceName: 'test-bus',
    type: 'gtfs',
    status: 'ok',
    downloadedAt: '2026-03-01T00:00:00Z',
    url: `https://api.odpt.org/api/v4/files/odpt/TestBus/AllLines.zip?date=${date}`,
    size: 1000,
    contentType: 'application/zip',
    durationMs: 100,
    archivePath: 'archives/test.zip',
    feedInfo: {
      publisherName: 'Test',
      publisherUrl: '',
      lang: 'ja',
      startDate: date,
      endDate: feedEndDate,
      version: 'v1',
    },
  };
}

function makeLocal(meta: DownloadMetaSuccess | null): LocalInfo {
  return { downloadMeta: meta };
}

// ---------------------------------------------------------------------------
// extractDateParam
// ---------------------------------------------------------------------------

describe('extractDateParam', () => {
  it('extracts date from ?date=YYYYMMDD', () => {
    expect(extractDateParam('https://example.com/file.zip?date=20260301')).toBe('20260301');
  });

  it('extracts date from &date=YYYYMMDD', () => {
    expect(extractDateParam('https://example.com/file.zip?key=val&date=20260301')).toBe('20260301');
  });

  it('returns null when no date param', () => {
    expect(extractDateParam('https://example.com/file.zip')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractUrlBase
// ---------------------------------------------------------------------------

describe('extractUrlBase', () => {
  it('removes query string', () => {
    expect(extractUrlBase('https://example.com/file.zip?date=20260301')).toBe(
      'https://example.com/file.zip',
    );
  });

  it('returns URL as-is when no query', () => {
    expect(extractUrlBase('https://example.com/file.zip')).toBe('https://example.com/file.zip');
  });
});

// ---------------------------------------------------------------------------
// detectWarnings
// ---------------------------------------------------------------------------

describe('detectWarnings', () => {
  const now = new Date('2026-03-17T00:00:00Z');

  it('returns NO_DOWNLOAD_REPORT when no download metadata', () => {
    const resources = [makeRemote('20260301', true)];
    const warnings = detectWarnings(resources, makeLocal(null), null, now);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('NO_DOWNLOAD_REPORT');
  });

  it('returns empty when LOCAL is valid and up to date', () => {
    const resources = [makeRemote('20260301', true)];
    const meta = makeMeta('20260301');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings).toHaveLength(0);
  });

  it('returns EXPIRED when LOCAL is no longer valid', () => {
    const resources = [makeRemote('20260301', false, '2026-02-28')];
    const meta = makeMeta('20260301', '20260228');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings.some((w) => w.type === 'EXPIRED')).toBe(true);
  });

  it('returns REMOVED when LOCAL URL is not in remote list', () => {
    const resources = [makeRemote('20260401', true)];
    const meta = makeMeta('20260301');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings.some((w) => w.type === 'REMOVED')).toBe(true);
  });

  it('returns NO_VALID_DATA when all resources are expired', () => {
    const resources = [makeRemote('20260301', false), makeRemote('20260201', false)];
    const meta = makeMeta('20260301', '20260228');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings.some((w) => w.type === 'NO_VALID_DATA')).toBe(true);
  });

  it('returns EXPIRING_SOON when feed_end_date is within 14 days', () => {
    const resources = [makeRemote('20260301', true, '2026-03-25')];
    const meta = makeMeta('20260301', '20260325');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    const expiring = warnings.find((w) => w.type === 'EXPIRING_SOON');
    expect(expiring).toBeDefined();
    if (expiring?.type === 'EXPIRING_SOON') {
      expect(expiring.daysLeft).toBe(8);
    }
  });

  it('does not return EXPIRING_SOON when feed_end_date is far away', () => {
    const resources = [makeRemote('20260301', true)];
    const meta = makeMeta('20260301', '20261231');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings.some((w) => w.type === 'EXPIRING_SOON')).toBe(false);
  });

  it('does not return EXPIRING_SOON when already expired (negative days)', () => {
    const resources = [makeRemote('20260301', false, '2026-03-10')];
    const meta = makeMeta('20260301', '20260310');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    // EXPIRED should be present, not EXPIRING_SOON
    expect(warnings.some((w) => w.type === 'EXPIRED')).toBe(true);
    expect(warnings.some((w) => w.type === 'EXPIRING_SOON')).toBe(false);
  });

  it('returns NEW_RESOURCE when new URLs appear since last snapshot', () => {
    const resources = [makeRemote('20260301', true), makeRemote('20260401', true)];
    const meta = makeMeta('20260301');
    const snapshot: ResourceSnapshot = {
      resourceUrls: [makeRemote('20260301', true).url],
    };
    const warnings = detectWarnings(resources, makeLocal(meta), snapshot, now);
    const newRes = warnings.find((w) => w.type === 'NEW_RESOURCE');
    expect(newRes).toBeDefined();
    if (newRes?.type === 'NEW_RESOURCE') {
      expect(newRes.urls).toHaveLength(1);
      expect(newRes.urls[0]).toContain('date=20260401');
    }
  });

  it('does not return NEW_RESOURCE when no snapshot exists', () => {
    const resources = [makeRemote('20260301', true), makeRemote('20260401', true)];
    const meta = makeMeta('20260301');
    const warnings = detectWarnings(resources, makeLocal(meta), null, now);
    expect(warnings.some((w) => w.type === 'NEW_RESOURCE')).toBe(false);
  });

  it('does not return NEW_RESOURCE when URLs are unchanged', () => {
    const resources = [makeRemote('20260301', true)];
    const meta = makeMeta('20260301');
    const snapshot: ResourceSnapshot = {
      resourceUrls: [makeRemote('20260301', true).url],
    };
    const warnings = detectWarnings(resources, makeLocal(meta), snapshot, now);
    expect(warnings.some((w) => w.type === 'NEW_RESOURCE')).toBe(false);
  });

  it('returns multiple warnings simultaneously', () => {
    // EXPIRED + NO_VALID_DATA + NEW_RESOURCE
    const resources = [makeRemote('20260301', false), makeRemote('20260401', false)];
    const meta = makeMeta('20260301', '20260228');
    const snapshot: ResourceSnapshot = {
      resourceUrls: [makeRemote('20260301', false).url],
    };
    const warnings = detectWarnings(resources, makeLocal(meta), snapshot, now);
    const types = warnings.map((w) => w.type);
    expect(types).toContain('EXPIRED');
    expect(types).toContain('NO_VALID_DATA');
    expect(types).toContain('NEW_RESOURCE');
  });
});
