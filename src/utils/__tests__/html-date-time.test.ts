import { describe, expect, it } from 'vitest';
import { toDatetimeLocalInputValue } from '../html-date-time';

describe('toDatetimeLocalInputValue', () => {
  it('returns ISO-like local datetime string', () => {
    expect(toDatetimeLocalInputValue(new Date(2026, 2, 4, 9, 5))).toBe('2026-03-04T09:05');
  });

  it('pads month, day, hours and minutes to 2 digits', () => {
    expect(toDatetimeLocalInputValue(new Date(2026, 0, 3, 1, 2))).toBe('2026-01-03T01:02');
  });

  it('keeps 4-digit year as is', () => {
    expect(toDatetimeLocalInputValue(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31T23:59');
  });

  it('pads 1-digit year to 4 digits', () => {
    // Note: `new Date(yyyy, ...)` treats 0..99 as 1900 + yyyy, so use setFullYear.
    const d = new Date(2026, 0, 1);
    d.setFullYear(1, 4, 30);
    d.setHours(13, 57, 0, 0);
    expect(toDatetimeLocalInputValue(d)).toBe('0001-05-30T13:57');
  });

  it('pads 2-digit year to 4 digits', () => {
    const d = new Date(2026, 0, 1);
    d.setFullYear(99, 5, 15);
    d.setHours(8, 30, 0, 0);
    expect(toDatetimeLocalInputValue(d)).toBe('0099-06-15T08:30');
  });

  it('pads 3-digit year to 4 digits', () => {
    const d = new Date(2026, 0, 1);
    d.setFullYear(999, 0, 1);
    d.setHours(0, 0, 0, 0);
    expect(toDatetimeLocalInputValue(d)).toBe('0999-01-01T00:00');
  });

  it('does not truncate years with more than 4 digits', () => {
    const d = new Date(2026, 0, 1);
    d.setFullYear(12345, 0, 1);
    d.setHours(0, 0, 0, 0);
    expect(toDatetimeLocalInputValue(d)).toBe('12345-01-01T00:00');
  });

  it('handles all single-digit fields together', () => {
    const d = new Date(2026, 0, 1);
    d.setFullYear(5, 2, 4);
    d.setHours(6, 7, 0, 0);
    expect(toDatetimeLocalInputValue(d)).toBe('0005-03-04T06:07');
  });

  it('handles end-of-year boundary 23:59', () => {
    expect(toDatetimeLocalInputValue(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31T23:59');
  });

  it('handles start-of-year boundary 00:00', () => {
    expect(toDatetimeLocalInputValue(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01T00:00');
  });
});
