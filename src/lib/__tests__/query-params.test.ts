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
    expect(date!.getTime()).not.toBeNaN();
  });

  it('parses with seconds', () => {
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

const originalLocation = window.location;

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
});

describe('cleanupInvalidQueryParams', () => {
  const originalReplaceState = history.replaceState.bind(history);
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    replaceStateSpy = vi
      .spyOn(history, 'replaceState')
      .mockImplementation(originalReplaceState.bind(history));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreLocation();
  });

  it('removes invalid repo/time/lat/lng/zm/stop params and preserves valid free-form params', () => {
    setSearch('?repo=v1&time=bad&lat=999&lng=abc&zm=99&stop=%20%20&sources=minkuru&diag=v2-load');

    cleanupInvalidQueryParams();

    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      history.state,
      '',
      '/?sources=minkuru&diag=v2-load',
    );
  });

  it('does nothing when all params are valid', () => {
    setSearch(
      '?repo=mock&time=2026-03-25T20:55:00+09:00&lat=35.68&lng=139.77&zm=14&stop=keio_S0123',
    );

    cleanupInvalidQueryParams();

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('preserves + in valid time offsets when cleaning other params', () => {
    setSearch('?time=2026-03-25T20:55:00+09:00&repo=v1');

    cleanupInvalidQueryParams();

    expect(replaceStateSpy).toHaveBeenCalledWith(
      history.state,
      '',
      '/?time=2026-03-25T20:55:00+09:00',
    );
  });

  it('drops empty query pairs when rebuilding the cleaned URL', () => {
    setSearch('?repo=v1&&sources=minkuru');

    cleanupInvalidQueryParams();

    expect(replaceStateSpy).toHaveBeenCalledWith(history.state, '', '/?sources=minkuru');
  });
});
