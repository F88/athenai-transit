import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sanitizeUrl,
  formatRemoteResourceLine,
  formatLocalLine,
  formatLocalFeedLine,
  printRemoteResources,
} from './check-odpt-report';
import { LocalResource, RemoteResource } from './odpt-resources';
import type { ResourceSnapshot } from '../../../src/lib/pipeline/odpt-resource-warnings';

// ---------------------------------------------------------------------------
// sanitizeUrl
// ---------------------------------------------------------------------------

describe('sanitizeUrl', () => {
  it('removes acl:consumerKey', () => {
    const url = 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=SECRET';
    expect(sanitizeUrl(url)).not.toContain('SECRET');
    expect(sanitizeUrl(url)).toContain('date=20260401');
  });

  it('removes access_token', () => {
    const url = 'https://api.example.com/data?access_token=SECRET&format=json';
    expect(sanitizeUrl(url)).not.toContain('SECRET');
    expect(sanitizeUrl(url)).toContain('format=json');
  });

  it('removes api_key', () => {
    const url = 'https://api.example.com/data?api_key=SECRET&id=123';
    expect(sanitizeUrl(url)).not.toContain('SECRET');
    expect(sanitizeUrl(url)).toContain('id=123');
  });

  it('removes all sensitive params at once', () => {
    const url =
      'https://api.example.com/data?acl:consumerKey=A&access_token=B&api_key=C&date=20260401';
    const result = sanitizeUrl(url);
    expect(result).not.toContain('consumerKey');
    expect(result).not.toContain('access_token');
    expect(result).not.toContain('api_key');
    expect(result).toContain('date=20260401');
  });

  it('removes multiple occurrences of the same param', () => {
    const url = 'https://api.odpt.org/test.zip?acl:consumerKey=A&date=20260401&acl:consumerKey=B';
    const result = sanitizeUrl(url);
    expect(result).not.toContain('consumerKey');
    expect(result).toContain('date=20260401');
  });

  it('returns URL unchanged when no sensitive params', () => {
    const url = 'https://api-public.odpt.org/test.zip?date=20260401';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('redacts malformed URL entirely', () => {
    const malformed = 'not-a-valid-url?acl:consumerKey=LEAKED';
    expect(sanitizeUrl(malformed)).toBe('[malformed-url-redacted]');
    expect(sanitizeUrl(malformed)).not.toContain('LEAKED');
  });
});

// ---------------------------------------------------------------------------
// Output utility helpers
// ---------------------------------------------------------------------------

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
): LocalResource {
  return new LocalResource(
    {
      url: `${BASE_URL}?date=${date}`,
      from: 'from' in opts ? (opts.from ?? null) : '2026-01-01',
      to: 'to' in opts ? (opts.to ?? null) : '2026-12-31',
      downloadedAt: '2026-03-01T00:00:00Z',
      feedVersion: 'v1',
    },
    [],
  );
}

// ---------------------------------------------------------------------------
// formatRemoteResourceLine
// ---------------------------------------------------------------------------

describe('formatRemoteResourceLine', () => {
  it('includes date, start_at, feed period, and uploaded', () => {
    const r = makeRemote('20260401');
    const line = formatRemoteResourceLine(r, 0);
    expect(line).toContain('#1');
    expect(line).toContain('date=20260401');
    expect(line).toContain('start_at=2026-04-01');
    expect(line).toContain('feed=2026-01-01 - 2026-12-31');
    expect(line).toContain('uploaded=2026-03-01T00:00:00Z');
  });

  it('shows <-- LOCAL marker for adopted resource', () => {
    const url = `${BASE_URL}?date=20260401`;
    const r = makeRemote('20260401', {}, null, url);
    const line = formatRemoteResourceLine(r, 0);
    expect(line).toContain('<-- LOCAL');
  });

  it('shows [NEW] marker for new resource (no snapshot)', () => {
    const r = makeRemote('20260401', {}, null, null);
    const line = formatRemoteResourceLine(r, 0);
    expect(line).toContain('[NEW]');
  });

  it('does not show [NEW] for known resource', () => {
    const url = `${BASE_URL}?date=20260401`;
    const snapshot: ResourceSnapshot = { resourceUrls: [url] };
    const r = makeRemote('20260401', {}, snapshot, null);
    const line = formatRemoteResourceLine(r, 0);
    expect(line).not.toContain('[NEW]');
  });

  it('never leaks auth params even if raw URL were somehow passed', () => {
    // Resource constructor strips auth params, so r.url is safe.
    // This test verifies the full pipeline: URL with token → output line.
    const r = new RemoteResource(
      {
        url: `${BASE_URL}?date=20260401&acl:consumerKey=SECRET_TOKEN`,
        from: '2026-01-01',
        to: '2026-12-31',
        startAt: '2026-04-01',
        uploadedAt: '2026-03-01T00:00:00Z',
      },
      null,
      null,
    );
    const line = formatRemoteResourceLine(r, 0);
    expect(line).not.toContain('SECRET_TOKEN');
    expect(line).not.toContain('consumerKey');
    expect(line).toContain('date=20260401');
  });

  it('handles malformed URL without credential leakage', () => {
    const r = new RemoteResource(
      {
        url: 'not-a-valid-url?access_token=LEAKED',
        from: '2026-01-01',
        to: '2026-12-31',
        startAt: '2026-04-01',
        uploadedAt: '2026-03-01T00:00:00Z',
      },
      null,
      null,
    );
    const line = formatRemoteResourceLine(r, 0);
    expect(line).not.toContain('LEAKED');
    expect(line).not.toContain('access_token');
  });
});

// ---------------------------------------------------------------------------
// formatLocalLine
// ---------------------------------------------------------------------------

describe('formatLocalLine', () => {
  it('includes date and downloadedAt', () => {
    const local = makeLocal('20260401');
    const line = formatLocalLine(local);
    expect(line).toContain('date=20260401');
    expect(line).toContain('downloaded=2026-03-01T00:00:00Z');
  });

  it('never leaks auth params', () => {
    const local = new LocalResource(
      {
        url: `${BASE_URL}?date=20260401&acl:consumerKey=SECRET_TOKEN`,
        from: '2026-01-01',
        to: '2026-12-31',
        downloadedAt: '2026-03-01T00:00:00Z',
      },
      [],
    );
    const line = formatLocalLine(local);
    expect(line).not.toContain('SECRET_TOKEN');
    expect(line).not.toContain('consumerKey');
  });

  it('handles malformed URL without credential leakage', () => {
    const local = new LocalResource(
      {
        url: 'not-a-url?api_key=LEAKED',
        from: null,
        to: null,
        downloadedAt: '2026-03-01T00:00:00Z',
      },
      [],
    );
    const line = formatLocalLine(local);
    expect(line).not.toContain('LEAKED');
    expect(line).not.toContain('api_key');
  });
});

// ---------------------------------------------------------------------------
// formatLocalFeedLine
// ---------------------------------------------------------------------------

describe('formatLocalFeedLine', () => {
  it('shows feed period and version', () => {
    const local = makeLocal('20260401');
    const line = formatLocalFeedLine(local);
    expect(line).toContain('2026-01-01 - 2026-12-31');
    expect(line).toContain('ver=v1');
  });

  it('shows ? for unknown dates', () => {
    const local = makeLocal('20260401', { from: null, to: null });
    const line = formatLocalFeedLine(local);
    expect(line).toContain('? - ?');
  });

  it('omits version when not set', () => {
    const local = new LocalResource(
      {
        url: `${BASE_URL}?date=20260401`,
        from: '2026-01-01',
        to: '2026-12-31',
        downloadedAt: '2026-03-01T00:00:00Z',
      },
      [],
    );
    const line = formatLocalFeedLine(local);
    expect(line).not.toContain('ver=');
  });

  it('does not contain any URL (no leakage path)', () => {
    const local = new LocalResource(
      {
        url: `${BASE_URL}?date=20260401&acl:consumerKey=SECRET`,
        from: '2026-01-01',
        to: '2026-12-31',
        downloadedAt: '2026-03-01T00:00:00Z',
      },
      [],
    );
    const line = formatLocalFeedLine(local);
    expect(line).not.toContain('SECRET');
    expect(line).not.toContain('api.odpt.org');
  });
});

// ---------------------------------------------------------------------------
// printRemoteResources
// ---------------------------------------------------------------------------

describe('printRemoteResources', () => {
  // `getPeriodStatus()` defaults to `new Date()`, so the "currently
  // valid" count depends on the wall clock. Pin time to a date that
  // sits between the fixture `start_at`s used in the suite below
  // (2026-03-01 / 2026-04-01 / 2026-05-01) so the assertion stays
  // stable regardless of when the suite runs.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('prints summary and resources sorted by startAt desc', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const localUrl = `${BASE_URL}?date=20260401`;
    const remotes = [
      makeRemote('20260301', {}, null, null),
      makeRemote('20260401', {}, null, localUrl),
      makeRemote('20260501', { from: '2026-05-01', to: '2026-12-31' }, null, null),
    ];

    printRemoteResources(remotes);

    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      '  Remote:     3 resources, 2 currently valid (sorted by start_at desc)',
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('#1  date=20260501  start_at=2026-05-01'),
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('#2  date=20260401  start_at=2026-04-01'),
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('#3  date=20260301  start_at=2026-03-01'),
    );
    expect(logSpy.mock.calls[2]?.[0]).toContain('<-- LOCAL');
    expect(logSpy.mock.calls[1]?.[0]).toContain('[NEW]');
  });

  it('never logs credentials for malformed or tokenized URLs', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const remotes = [
      new RemoteResource(
        {
          url: `${BASE_URL}?date=20260401&access_token=SECRET1`,
          from: '2026-01-01',
          to: '2026-12-31',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-01T00:00:00Z',
        },
        null,
        null,
      ),
      new RemoteResource(
        {
          url: 'not-a-valid-url?api_key=SECRET2',
          from: '2026-01-01',
          to: '2026-12-31',
          startAt: '2026-04-02',
          uploadedAt: '2026-03-01T00:00:00Z',
        },
        null,
        null,
      ),
    ];

    printRemoteResources(remotes);

    const combined = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(combined).not.toContain('SECRET1');
    expect(combined).not.toContain('SECRET2');
    expect(combined).not.toContain('access_token');
    expect(combined).not.toContain('api_key');
    expect(combined).not.toContain('[malformed-url-redacted]');
  });
});
