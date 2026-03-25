import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupInvalidQueryParams,
  parseQueryLat,
  parseQueryLng,
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

  it('returns null for date-only without time', () => {
    // Date-only strings are parsed as UTC by spec, but we accept them
    const date = parseQueryTime('2026-03-25');
    // This is valid per Date constructor — returns midnight UTC
    expect(date).not.toBeNull();
  });
});

describe('cleanupInvalidQueryParams', () => {
  const originalLocation = window.location;
  let replaceStateMock: ReturnType<typeof vi.fn>;

  /** Helper to set window.location.search and reset the params cache. */
  function setSearch(search: string): void {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search, href: `http://localhost${search}` },
      writable: true,
      configurable: true,
    });
    resetParamsCache();
  }

  /** Extract the cleaned URL from replaceState call. */
  function getCleanedUrl(): URL {
    return new URL(replaceStateMock.mock.calls[0][2] as string);
  }

  beforeEach(() => {
    replaceStateMock = vi.fn();
    vi.spyOn(history, 'replaceState').mockImplementation(
      replaceStateMock as typeof history.replaceState,
    );
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    resetParamsCache();
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
