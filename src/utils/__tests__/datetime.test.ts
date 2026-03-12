import { describe, expect, it } from 'vitest';
import { formatDateTimeJaJp, formatDateTimeJaJpParts, toDatetimeLocalValue } from '../datetime';

// Construct dates using explicit component values to avoid TZ ambiguity.
// new Date(year, monthIndex, day, hours, minutes) uses local time.

describe('formatDateTimeJaJp', () => {
  it('formats a Tuesday morning', () => {
    // 2026-03-04 is a Wednesday
    const date = new Date(2026, 2, 4, 9, 15);
    expect(formatDateTimeJaJp(date)).toBe('3 月 4 日 (水) 09:15');
  });

  it('pads single-digit hours and minutes', () => {
    const date = new Date(2026, 0, 5, 3, 5);
    expect(formatDateTimeJaJp(date)).toBe('1 月 5 日 (月) 03:05');
  });

  it('formats midnight correctly', () => {
    const date = new Date(2026, 5, 14, 0, 0);
    expect(formatDateTimeJaJp(date)).toBe('6 月 14 日 (日) 00:00');
  });

  it('formats a Sunday', () => {
    const date = new Date(2026, 2, 1, 18, 30);
    expect(formatDateTimeJaJp(date)).toBe('3 月 1 日 (日) 18:30');
  });

  it('formats a Saturday', () => {
    const date = new Date(2026, 2, 7, 23, 59);
    expect(formatDateTimeJaJp(date)).toBe('3 月 7 日 (土) 23:59');
  });
});

describe('formatDateTimeJaJpParts', () => {
  it('returns weekday category for a Wednesday', () => {
    const date = new Date(2026, 2, 4, 9, 15);
    const result = formatDateTimeJaJpParts(date);
    expect(result.prefix).toBe('3 月 4 日 ');
    expect(result.dayLabel).toBe('(水)');
    expect(result.suffix).toBe(' 09:15');
    expect(result.dayColorCategory).toBe('weekday');
  });

  it('returns saturday category for a Saturday', () => {
    // 2026-03-07 is Saturday
    const date = new Date(2026, 2, 7, 23, 59);
    const result = formatDateTimeJaJpParts(date);
    expect(result.prefix).toBe('3 月 7 日 ');
    expect(result.dayLabel).toBe('(土)');
    expect(result.suffix).toBe(' 23:59');
    expect(result.dayColorCategory).toBe('saturday');
  });

  it('returns sunday category for a Sunday', () => {
    // 2026-03-01 is Sunday
    const date = new Date(2026, 2, 1, 18, 30);
    const result = formatDateTimeJaJpParts(date);
    expect(result.prefix).toBe('3 月 1 日 ');
    expect(result.dayLabel).toBe('(日)');
    expect(result.suffix).toBe(' 18:30');
    expect(result.dayColorCategory).toBe('sunday');
  });

  it('returns holiday category for a holiday on a weekday (New Year)', () => {
    // 2026-01-01 is Thursday but is a national holiday
    const date = new Date(2026, 0, 1, 10, 0);
    const result = formatDateTimeJaJpParts(date);
    expect(result.prefix).toBe('1 月 1 日 ');
    expect(result.dayLabel).toBe('(木)');
    expect(result.suffix).toBe(' 10:00');
    expect(result.dayColorCategory).toBe('holiday');
  });
});

describe('toDatetimeLocalValue', () => {
  it('returns ISO-like local datetime string', () => {
    const date = new Date(2026, 2, 4, 9, 5);
    expect(toDatetimeLocalValue(date)).toBe('2026-03-04T09:05');
  });

  it('pads month, day, hours and minutes', () => {
    const date = new Date(2026, 0, 3, 1, 2);
    expect(toDatetimeLocalValue(date)).toBe('2026-01-03T01:02');
  });
});
