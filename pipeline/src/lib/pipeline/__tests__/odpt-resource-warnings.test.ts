import { describe, expect, it } from 'vitest';
import { detectWarnings, extractUrlBase } from '../odpt-resource-warnings';
import type { ResourceSnapshot } from '../odpt-resource-warnings';
import { LocalResource, RemoteResource } from '../../../../scripts/pipeline/lib/odpt-resources';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

const now = new Date('2026-03-17T00:00:00Z');
const BASE_URL = 'https://api.odpt.org/api/v4/files/odpt/TestBus/AllLines.zip';

function makeRemote(
  date: string,
  opts: { from?: string | null; to?: string | null } = {},
  snapshot: ResourceSnapshot | null = null,
  adoptedUrl: string | null = null,
): RemoteResource {
  return new RemoteResource(
    {
      url: `${BASE_URL}?date=${date}`,
      from: 'from' in opts ? (opts.from ?? null) : '2026-01-01',
      to: 'to' in opts ? (opts.to ?? null) : '2026-12-31',
      startAt: date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      uploadedAt: '2026-03-01T00:00:00Z',
    },
    snapshot,
    adoptedUrl,
  );
}

function makeLocal(
  date: string,
  opts: { from?: string | null; to?: string | null } = {},
  remoteUrls: string[] = [],
): LocalResource {
  return new LocalResource(
    {
      url: `${BASE_URL}?date=${date}`,
      from: 'from' in opts ? (opts.from ?? null) : '2026-01-01',
      to: 'to' in opts ? (opts.to ?? null) : '2026-12-31',
      downloadedAt: '2026-03-01T00:00:00Z',
      feedVersion: 'v1',
    },
    remoteUrls,
  );
}

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
  // --- LocalResource checks ---

  it('returns NO_DOWNLOAD_REPORT when local is null', () => {
    const remotes = [makeRemote('20260301')];
    const warnings = detectWarnings(null, remotes, now);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('NO_DOWNLOAD_REPORT');
  });

  it('returns empty when LOCAL is valid and up to date', () => {
    const url = `${BASE_URL}?date=20260301`;
    const snapshot: ResourceSnapshot = { resourceUrls: [url] };
    const local = makeLocal('20260301', {}, [url]);
    const remotes = [makeRemote('20260301', {}, snapshot, url)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings).toHaveLength(0);
  });

  it('returns EXPIRED when LOCAL feed period has ended', () => {
    const url = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', { from: '2026-01-01', to: '2026-02-28' }, [url]);
    const remotes = [makeRemote('20260301', { from: '2026-01-01', to: '2026-02-28' }, null, url)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'EXPIRED')).toBe(true);
  });

  it('returns NOT_YET_ACTIVE when LOCAL feed period has not started', () => {
    const url = `${BASE_URL}?date=20260328`;
    const local = makeLocal('20260328', { from: '2026-03-28', to: '2026-06-30' }, [url]);
    const remotes = [makeRemote('20260328', { from: '2026-03-28', to: '2026-06-30' }, null, url)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'NOT_YET_ACTIVE')).toBe(true);
    expect(warnings.some((w) => w.type === 'EXPIRED')).toBe(false);
  });

  it('returns REMOVED when LOCAL URL is not in remote list', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', {}, [`${BASE_URL}?date=20260401`]);
    const remotes = [makeRemote('20260401', {}, null, localUrl)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'REMOVED')).toBe(true);
  });

  it('returns NO_VALID_DATA when all resources are expired', () => {
    const url = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', { from: '2026-01-01', to: '2026-02-28' }, [url]);
    const remotes = [
      makeRemote('20260301', { from: '2026-01-01', to: '2026-02-28' }, null, url),
      makeRemote('20260201', { from: '2026-01-01', to: '2026-02-28' }, null, null),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'NO_VALID_DATA')).toBe(true);
  });

  it('returns EXPIRING_SOON when feed_end is within threshold', () => {
    const url = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', { from: '2026-01-01', to: '2026-03-25' }, [url]);
    const remotes = [makeRemote('20260301', { from: '2026-01-01', to: '2026-03-25' }, null, url)];
    const warnings = detectWarnings(local, remotes, now);
    const expiring = warnings.find((w) => w.type === 'EXPIRING_SOON');
    expect(expiring).toBeDefined();
    if (expiring?.type === 'EXPIRING_SOON') {
      expect(expiring.daysLeft).toBe(8);
    }
  });

  it('does not return EXPIRING_SOON when feed_end is far away', () => {
    const url = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', {}, [url]);
    const remotes = [makeRemote('20260301', {}, null, url)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'EXPIRING_SOON')).toBe(false);
  });

  it('does not return EXPIRING_SOON when feed is not yet active', () => {
    const url = `${BASE_URL}?date=20260320`;
    const local = makeLocal('20260320', { from: '2026-03-20', to: '2026-03-25' }, [url]);
    const remotes = [makeRemote('20260320', { from: '2026-03-20', to: '2026-03-25' }, null, url)];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'NOT_YET_ACTIVE')).toBe(true);
    expect(warnings.some((w) => w.type === 'EXPIRING_SOON')).toBe(false);
  });

  // --- RemoteResource checks (new warning types) ---

  it('returns NEW_IN_PERIOD for new resource that is in-period', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, { resourceUrls: [localUrl] }, localUrl),
      makeRemote('20260401', {}, { resourceUrls: [localUrl] }, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'NEW_IN_PERIOD')).toBe(true);
  });

  it('returns KNOWN_IN_PERIOD for known resource that is in-period', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const otherUrl = `${BASE_URL}?date=20260201`;
    const snapshot: ResourceSnapshot = { resourceUrls: [localUrl, otherUrl] };
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, snapshot, localUrl),
      makeRemote('20260201', {}, snapshot, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'KNOWN_IN_PERIOD')).toBe(true);
  });

  it('returns NEW_BEFORE_PERIOD for new resource that is before-period', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, { resourceUrls: [localUrl] }, localUrl),
      makeRemote('20260401', { from: '2026-04-01', to: '2026-09-28' }, { resourceUrls: [localUrl] }, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'NEW_BEFORE_PERIOD')).toBe(true);
  });

  it('returns KNOWN_BEFORE_PERIOD for known resource that is before-period', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const otherUrl = `${BASE_URL}?date=20260401`;
    const snapshot: ResourceSnapshot = { resourceUrls: [localUrl, otherUrl] };
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, snapshot, localUrl),
      makeRemote('20260401', { from: '2026-04-01', to: '2026-09-28' }, snapshot, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'KNOWN_BEFORE_PERIOD')).toBe(true);
  });

  it('does not emit warning for non-adopted after-period resource', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const snapshot: ResourceSnapshot = { resourceUrls: [localUrl, `${BASE_URL}?date=20260101`] };
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, snapshot, localUrl),
      makeRemote('20260101', { from: '2025-01-01', to: '2026-02-28' }, snapshot, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    expect(warnings.some((w) => w.type === 'KNOWN_IN_PERIOD')).toBe(false);
    expect(warnings.some((w) => w.type === 'NEW_IN_PERIOD')).toBe(false);
  });

  it('does not emit warning for non-adopted unknown-period resource', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const snapshot: ResourceSnapshot = { resourceUrls: [localUrl, `${BASE_URL}?date=20260401`] };
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, snapshot, localUrl),
      makeRemote('20260401', { from: null, to: null }, snapshot, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    // unknown-period resource should not generate any of these warnings
    const otherWarnings = warnings.filter((w) =>
      w.type === 'NEW_IN_PERIOD' || w.type === 'KNOWN_IN_PERIOD'
      || w.type === 'NEW_BEFORE_PERIOD' || w.type === 'KNOWN_BEFORE_PERIOD',
    );
    expect(otherWarnings).toHaveLength(0);
  });

  it('treats no-snapshot as new (isNew returns null → new)', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', {}, [localUrl]);
    const remotes = [
      makeRemote('20260301', {}, null, localUrl),
      makeRemote('20260401', { from: '2026-04-01', to: '2026-09-28' }, null, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    // No snapshot → isNew() returns null → treated as new
    expect(warnings.some((w) => w.type === 'NEW_BEFORE_PERIOD')).toBe(true);
  });

  it('returns multiple warnings simultaneously', () => {
    const localUrl = `${BASE_URL}?date=20260301`;
    const local = makeLocal('20260301', { from: '2026-01-01', to: '2026-02-28' }, [localUrl]);
    const remotes = [
      makeRemote('20260301', { from: '2026-01-01', to: '2026-02-28' }, null, localUrl),
      makeRemote('20260401', { from: '2026-01-01', to: '2026-02-28' }, null, localUrl),
    ];
    const warnings = detectWarnings(local, remotes, now);
    // EXPIRED (local after-period) + NO_VALID_DATA (all expired)
    expect(warnings.some((w) => w.type === 'EXPIRED')).toBe(true);
    expect(warnings.some((w) => w.type === 'NO_VALID_DATA')).toBe(true);
  });
});
