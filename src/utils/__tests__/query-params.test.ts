import { describe, expect, it } from 'vitest';
import { parseQueryLat, parseQueryLng, parseQueryZoom } from '../query-params';

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
