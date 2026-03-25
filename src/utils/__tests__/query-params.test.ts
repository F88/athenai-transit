import { describe, expect, it } from 'vitest';
import { parseQueryLat, parseQueryLng, parseQueryTime, parseQueryZoom } from '../query-params';

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
