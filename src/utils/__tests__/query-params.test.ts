import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupInvalidQueryParams,
  getDiagParam,
  getRepoParam,
  getSourcesParam,
  getStopParam,
  getTimeParam,
  parseQueryLat,
  parseQueryLng,
  parseQueryStopId,
  parseQueryTime,
  parseQueryZoom,
  resetParamsCache,
} from '../query-params';

describe('parseQueryLat', () => {
  it('parses valid latitudes', () => {
    expect(parseQueryLat('35.6812')).toBe(35.6812);
    expect(parseQueryLat('0')).toBe(0);
    expect(parseQueryLat('-90')).toBe(-90);
    expect(parseQueryLat('90')).toBe(90);
  });

  it('rejects out-of-range values', () => {
    expect(parseQueryLat('91')).toBeNull();
    expect(parseQueryLat('-91')).toBeNull();
    expect(parseQueryLat('1000')).toBeNull();
  });

  it('rejects non-numeric and whitespace-only input', () => {
    expect(parseQueryLat('abc')).toBeNull();
    expect(parseQueryLat('')).toBeNull();
    expect(parseQueryLat('   ')).toBeNull();
    expect(parseQueryLat(null)).toBeNull();
    expect(parseQueryLat(undefined)).toBeNull();
  });

  it('rejects Infinity and NaN', () => {
    expect(parseQueryLat('Infinity')).toBeNull();
    expect(parseQueryLat('-Infinity')).toBeNull();
    expect(parseQueryLat('NaN')).toBeNull();
  });

  it('rejects injection attempts', () => {
    expect(parseQueryLat('<script>alert(1)</script>')).toBeNull();
    expect(parseQueryLat("'; DROP TABLE stops; --")).toBeNull();
    expect(parseQueryLat('${document.cookie}')).toBeNull();
    expect(parseQueryLat('%3Cscript%3Ealert(1)%3C/script%3E')).toBeNull();
  });
});

describe('parseQueryLng', () => {
  it('parses valid longitudes', () => {
    expect(parseQueryLng('139.7671')).toBe(139.7671);
    expect(parseQueryLng('0')).toBe(0);
    expect(parseQueryLng('-180')).toBe(-180);
    expect(parseQueryLng('180')).toBe(180);
  });

  it('rejects out-of-range values', () => {
    expect(parseQueryLng('181')).toBeNull();
    expect(parseQueryLng('-181')).toBeNull();
  });

  it('rejects injection attempts', () => {
    expect(parseQueryLng('<script>alert(1)</script>')).toBeNull();
    expect(parseQueryLng('1; DROP TABLE')).toBeNull();
  });
});

describe('parseQueryZoom', () => {
  it('parses valid zoom levels', () => {
    expect(parseQueryZoom('16')).toBe(16);
    expect(parseQueryZoom('1')).toBe(1);
    expect(parseQueryZoom('20')).toBe(20);
    expect(parseQueryZoom('14.5')).toBe(14.5);
  });

  it('rejects out-of-range values', () => {
    expect(parseQueryZoom('0')).toBeNull();
    expect(parseQueryZoom('21')).toBeNull();
    expect(parseQueryZoom('-1')).toBeNull();
  });

  it('rejects non-numeric and injection', () => {
    expect(parseQueryZoom('abc')).toBeNull();
    expect(parseQueryZoom('<script>')).toBeNull();
    expect(parseQueryZoom('Infinity')).toBeNull();
    expect(parseQueryZoom(null)).toBeNull();
  });
});

describe('parseQueryTime', () => {
  it('parses RFC 3339 with timezone offset', () => {
    const date = parseQueryTime('2026-03-25T20:55:00+09:00');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('2026-03-25T11:55:00.000Z');
  });

  it('parses RFC 3339 with UTC Z', () => {
    const date = parseQueryTime('2026-03-25T20:55:00Z');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('2026-03-25T20:55:00.000Z');
  });

  it('parses without seconds (local time)', () => {
    const date = parseQueryTime('2026-03-25T20:55');
    expect(date).not.toBeNull();
    // Local time — verify via UTC offset-independent checks
    expect(date!.getTime()).not.toBeNaN();
  });

  it('parses with seconds', () => {
    // Use UTC Z to avoid TZ dependency
    const date = parseQueryTime('2026-03-25T20:55:30Z');
    expect(date).not.toBeNull();
    expect(date!.getUTCSeconds()).toBe(30);
  });

  it('parses negative timezone offset', () => {
    const date = parseQueryTime('2026-03-25T08:00:00-05:00');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('2026-03-25T13:00:00.000Z');
  });

  it('returns null for empty/null/undefined', () => {
    expect(parseQueryTime(null)).toBeNull();
    expect(parseQueryTime(undefined)).toBeNull();
    expect(parseQueryTime('')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(parseQueryTime('not-a-date')).toBeNull();
    expect(parseQueryTime('abc')).toBeNull();
    expect(parseQueryTime('<script>alert(1)</script>')).toBeNull();
  });

  it('accepts date-only without time (midnight UTC)', () => {
    // Date-only strings are parsed as UTC by spec — we accept them.
    const date = parseQueryTime('2026-03-25');
    expect(date).not.toBeNull();
  });

  describe('rejects non-ISO formats that new Date() would accept', () => {
    it('rejects US date format', () => {
      expect(parseQueryTime('March 25, 2026')).toBeNull();
    });

    it('rejects slash-separated date', () => {
      expect(parseQueryTime('2026/03/25')).toBeNull();
    });

    it('rejects date with space instead of T', () => {
      expect(parseQueryTime('2026-03-25 20:55:00')).toBeNull();
    });

    it('rejects timestamp in milliseconds', () => {
      expect(parseQueryTime('1774488000000')).toBeNull();
    });

    it('rejects day-month-year format', () => {
      expect(parseQueryTime('25-03-2026')).toBeNull();
    });

    it('rejects partial date', () => {
      expect(parseQueryTime('2026-03')).toBeNull();
    });

    it('rejects time only', () => {
      expect(parseQueryTime('20:55:00')).toBeNull();
    });

    it('rejects date with trailing text', () => {
      expect(parseQueryTime('2026-03-25T20:55:00Z extra')).toBeNull();
    });
  });
});

describe('parseQueryStopId', () => {
  it('returns trimmed stop ID for valid strings', () => {
    expect(parseQueryStopId('keio_S0123')).toBe('keio_S0123');
    expect(parseQueryStopId('tobus_13001')).toBe('tobus_13001');
    expect(parseQueryStopId('  abc_123  ')).toBe('abc_123');
  });

  it('returns null for empty, whitespace-only, null, and undefined', () => {
    expect(parseQueryStopId('')).toBeNull();
    expect(parseQueryStopId('   ')).toBeNull();
    expect(parseQueryStopId(null)).toBeNull();
    expect(parseQueryStopId(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// get*Param — read values from window.location.search
// ---------------------------------------------------------------------------

/**
 * Shared helpers for tests that need to manipulate window.location.search.
 * Each describe block saves/restores the original location in beforeEach/afterEach.
 */
const originalLocation = window.location;

/** Set window.location.search and reset the internal params cache. */
function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, search, href: `http://localhost${search}` },
    writable: true,
    configurable: true,
  });
  resetParamsCache();
}

function restoreLocation(): void {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  resetParamsCache();
}

describe('getRepoParam', () => {
  afterEach(restoreLocation);

  it('returns "v2" by default when no param', () => {
    setSearch('');
    expect(getRepoParam()).toBe('v2');
  });

  it('returns "mock" when ?repo=mock', () => {
    setSearch('?repo=mock');
    expect(getRepoParam()).toBe('mock');
  });

  it('returns "v2" for unrecognized values', () => {
    setSearch('?repo=unknown');
    expect(getRepoParam()).toBe('v2');
  });
});

describe('getTimeParam', () => {
  afterEach(restoreLocation);

  it('returns null when no param', () => {
    setSearch('');
    expect(getTimeParam()).toBeNull();
  });

  it('returns Date for valid RFC 3339 value', () => {
    setSearch('?time=2026-03-25T20:55:00Z');
    const result = getTimeParam();
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe('2026-03-25T20:55:00.000Z');
  });

  it('preserves + in timezone offset (not decoded as space)', () => {
    setSearch('?time=2026-03-25T20:55:00+09:00');
    const result = getTimeParam();
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe('2026-03-25T11:55:00.000Z');
  });

  it('returns null for invalid value', () => {
    setSearch('?time=not-a-date');
    expect(getTimeParam()).toBeNull();
  });
});

describe('getSourcesParam', () => {
  afterEach(restoreLocation);

  it('returns null when no param', () => {
    setSearch('');
    expect(getSourcesParam()).toBeNull();
  });

  it('returns raw string value', () => {
    setSearch('?sources=minkuru,yurimo');
    expect(getSourcesParam()).toBe('minkuru,yurimo');
  });
});

describe('getDiagParam', () => {
  afterEach(restoreLocation);

  it('returns null when no param', () => {
    setSearch('');
    expect(getDiagParam()).toBeNull();
  });

  it('returns string value', () => {
    setSearch('?diag=v2-load');
    expect(getDiagParam()).toBe('v2-load');
  });
});

describe('getStopParam', () => {
  afterEach(restoreLocation);

  it('returns null when no param', () => {
    setSearch('');
    expect(getStopParam()).toBeNull();
  });

  it('returns stop ID for valid value', () => {
    setSearch('?stop=keio_S0123');
    expect(getStopParam()).toBe('keio_S0123');
  });

  it('returns null for empty value', () => {
    setSearch('?stop=');
    expect(getStopParam()).toBeNull();
  });

  it('returns null for whitespace-only value', () => {
    setSearch('?stop=%20%20');
    expect(getStopParam()).toBeNull();
  });

  it('works alongside other params', () => {
    setSearch('?lat=35.68&stop=tobus_001&zm=16');
    expect(getStopParam()).toBe('tobus_001');
  });
});

describe('cleanupInvalidQueryParams', () => {
  let replaceStateMock: ReturnType<typeof vi.fn>;

  /** Extract the cleaned URL from replaceState call. */
  function getCleanedUrl(): URL {
    const raw = replaceStateMock.mock.calls[0][2] as string;
    // replaceState receives a path (e.g. "/?lat=35"), make it absolute for URL parsing.
    return new URL(raw, 'http://localhost');
  }

  beforeEach(() => {
    replaceStateMock = vi.fn();
    vi.spyOn(history, 'replaceState').mockImplementation(
      replaceStateMock as typeof history.replaceState,
    );
  });

  afterEach(() => {
    restoreLocation();
    vi.restoreAllMocks();
  });

  // --- ?repo= ---

  it('removes unrecognized ?repo= value (e.g., v1)', () => {
    setSearch('?repo=v1');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('repo')).toBe(false);
  });

  it('preserves other params when removing invalid repo', () => {
    setSearch('?repo=v1&lat=35.68&lng=139.77');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    expect(url.searchParams.get('lat')).toBe('35.68');
    expect(url.searchParams.get('lng')).toBe('139.77');
  });

  it('does nothing when ?repo=v2 (valid)', () => {
    setSearch('?repo=v2');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it('does nothing when ?repo=mock (valid)', () => {
    setSearch('?repo=mock');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- ?time= ---

  it('removes invalid ?time= value', () => {
    setSearch('?time=not-a-date');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('time')).toBe(false);
  });

  it('keeps valid ?time= value (RFC 3339)', () => {
    setSearch('?time=2026-03-25T20%3A55%3A00%2B09%3A00');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- ?lat= ---

  it('removes invalid ?lat= value', () => {
    setSearch('?lat=abc');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('lat')).toBe(false);
  });

  it('removes out-of-range ?lat= value', () => {
    setSearch('?lat=91');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('lat')).toBe(false);
  });

  it('keeps valid ?lat= value', () => {
    setSearch('?lat=35.68');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- ?lng= ---

  it('removes invalid ?lng= value', () => {
    setSearch('?lng=xyz');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('lng')).toBe(false);
  });

  it('removes out-of-range ?lng= value', () => {
    setSearch('?lng=181');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('lng')).toBe(false);
  });

  it('keeps valid ?lng= value', () => {
    setSearch('?lng=139.77');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- ?zm= ---

  it('removes invalid ?zm= value', () => {
    setSearch('?zm=abc');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('zm')).toBe(false);
  });

  it('removes out-of-range ?zm= value', () => {
    setSearch('?zm=0');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('zm')).toBe(false);
  });

  it('keeps valid ?zm= value', () => {
    setSearch('?zm=14');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- ?stop= ---

  it('removes empty ?stop= value', () => {
    setSearch('?stop=');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('stop')).toBe(false);
  });

  it('removes whitespace-only ?stop= value', () => {
    setSearch('?stop=%20%20');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('stop')).toBe(false);
  });

  it('keeps valid ?stop= value', () => {
    setSearch('?stop=keio_S0123');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- multiple invalid params ---

  it('removes multiple invalid params at once', () => {
    setSearch('?repo=v1&lat=abc&lng=181&zm=0&time=invalid');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    expect(url.searchParams.has('lat')).toBe(false);
    expect(url.searchParams.has('lng')).toBe(false);
    expect(url.searchParams.has('zm')).toBe(false);
    expect(url.searchParams.has('time')).toBe(false);
  });

  it('removes only invalid params, keeps valid ones', () => {
    setSearch('?repo=v1&lat=35.68&lng=abc&zm=14');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    expect(url.searchParams.get('lat')).toBe('35.68');
    expect(url.searchParams.has('lng')).toBe(false);
    expect(url.searchParams.get('zm')).toBe('14');
  });

  // --- time param with + in timezone offset ---

  it('preserves ?time= with encoded + when other params are removed', () => {
    setSearch('?repo=v1&time=2026-03-25T20%3A55%3A00%2B09%3A00');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    // time should still be parseable after URL reconstruction
    const timeValue = url.searchParams.get('time');
    expect(timeValue).not.toBeNull();
    expect(parseQueryTime(timeValue)).not.toBeNull();
  });

  it('preserves ?time= with raw + when other params are removed', () => {
    setSearch('?repo=v1&time=2026-03-25T20:55:00+09:00');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    // Verify raw URL string preserves + (not via URLSearchParams which decodes + as space)
    const rawUrl = replaceStateMock.mock.calls[0][2] as string;
    expect(rawUrl).not.toContain('repo=');
    expect(rawUrl).toContain('time=2026-03-25T20:55:00+09:00');
  });

  // --- no params / all valid ---

  it('does nothing when no params present', () => {
    setSearch('');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it('does nothing when all params are valid', () => {
    setSearch('?repo=v2&lat=35.68&lng=139.77&zm=14');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- unvalidated and unknown params are preserved ---

  it('preserves ?sources= and ?diag= (not validated)', () => {
    setSearch('?repo=v1&sources=minkuru&diag=v2-load');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    expect(url.searchParams.get('sources')).toBe('minkuru');
    expect(url.searchParams.get('diag')).toBe('v2-load');
  });

  it('preserves unknown params (not part of the validation list)', () => {
    setSearch('?repo=v1&hoge=aadsf&foo=bar');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    const url = getCleanedUrl();
    expect(url.searchParams.has('repo')).toBe(false);
    expect(url.searchParams.get('hoge')).toBe('aadsf');
    expect(url.searchParams.get('foo')).toBe('bar');
  });

  it('does not touch unknown params when all known params are valid', () => {
    setSearch('?repo=v2&lat=35.68&unknown=value');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  // --- duplicate keys: first value wins ---

  it('uses the first value for duplicate keys (first-wins semantics)', () => {
    // URLSearchParams.get() returns the first value per spec.
    // ?repo=mock is valid, so cleanup does not touch repo params.
    setSearch('?repo=mock&repo=v1&repo=v2');
    cleanupInvalidQueryParams();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it('removes duplicate key when first value is invalid', () => {
    setSearch('?repo=v1&repo=mock&repo=v2');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    expect(getCleanedUrl().searchParams.has('repo')).toBe(false);
  });

  it('removes all duplicate keys when first value is empty string', () => {
    setSearch('?repo=&repo=v1&repo=v2');
    cleanupInvalidQueryParams();

    expect(replaceStateMock).toHaveBeenCalledOnce();
    // URLSearchParams.delete() removes all entries for the key
    expect(getCleanedUrl().searchParams.has('repo')).toBe(false);
  });
});
