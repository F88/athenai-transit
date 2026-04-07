import { describe, expect, it } from 'vitest';
import { formatDateParts, toDatetimeLocalValue } from '../datetime';

const TZ = 'Asia/Tokyo';

// Use UTC dates to avoid CI timezone dependency.
// 2026-03-04T00:15:00Z = 2026-03-04T09:15:00+09:00 (JST, Wednesday)
const WED_0915_UTC = new Date('2026-03-04T00:15:00Z');
// 2026-03-07T14:59:00Z = 2026-03-07T23:59:00+09:00 (JST, Saturday)
const SAT_2359_UTC = new Date('2026-03-07T14:59:00Z');
// 2026-03-01T09:30:00Z = 2026-03-01T18:30:00+09:00 (JST, Sunday)
const SUN_1830_UTC = new Date('2026-03-01T09:30:00Z');
// 2026-01-01T01:00:00Z = 2026-01-01T10:00:00+09:00 (JST, New Year, Thursday)
const HOLIDAY_UTC = new Date('2026-01-01T01:00:00Z');

describe('formatDateParts', () => {
  // --- ja locale ---

  it('returns date and day label in Japanese', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ);
    expect(result.dateText).toBe('3月4日');
    expect(result.dayLabel).toBe('水');
    expect(result.time).toBeUndefined();
    expect(result.dayColorCategory).toBe('weekday');
  });

  it('returns date with year in Japanese when showYear is true', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ, { showYear: true });
    expect(result.dateText).toBe('2026年3月4日');
    expect(result.dayLabel).toBe('水');
  });

  it('includes time in HH:MM format when showTime is true', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ, { showTime: true });
    expect(result.dateText).toBe('3月4日');
    expect(result.time).toBe('09:15');
  });

  it('omits time when showTime is false', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ, { showTime: false });
    expect(result.time).toBeUndefined();
  });

  // --- en locale ---

  it('returns date and day label in English', () => {
    const result = formatDateParts(WED_0915_UTC, 'en', TZ);
    expect(result.dateText).toBe('Mar 4');
    expect(result.dayLabel).toBe('Wed');
    expect(result.dayColorCategory).toBe('weekday');
  });

  it('returns date with year in English when showYear is true', () => {
    const result = formatDateParts(WED_0915_UTC, 'en', TZ, { showYear: true });
    expect(result.dateText).toBe('Mar 4, 2026');
    expect(result.dayLabel).toBe('Wed');
  });

  // --- day color categories ---

  it('returns saturday category for Saturday', () => {
    const result = formatDateParts(SAT_2359_UTC, 'en', TZ);
    expect(result.dateText).toBe('Mar 7');
    expect(result.dayLabel).toBe('Sat');
    expect(result.dayColorCategory).toBe('saturday');
  });

  it('returns sunday category for Sunday', () => {
    const result = formatDateParts(SUN_1830_UTC, 'en', TZ);
    expect(result.dateText).toBe('Mar 1');
    expect(result.dayLabel).toBe('Sun');
    expect(result.dayColorCategory).toBe('sunday');
  });

  it('returns holiday category for a national holiday', () => {
    const result = formatDateParts(HOLIDAY_UTC, 'ja', TZ);
    expect(result.dateText).toBe('1月1日');
    expect(result.dayLabel).toBe('木');
    expect(result.dayColorCategory).toBe('holiday');
  });

  // --- locale differences ---

  it('produces different dayLabel for ja vs en', () => {
    const ja = formatDateParts(WED_0915_UTC, 'ja', TZ);
    const en = formatDateParts(WED_0915_UTC, 'en', TZ);
    expect(ja.dayLabel).toBe('水');
    expect(en.dayLabel).toBe('Wed');
  });

  it('produces different dateText for ja vs en with showYear', () => {
    const ja = formatDateParts(WED_0915_UTC, 'ja', TZ, { showYear: true });
    const en = formatDateParts(WED_0915_UTC, 'en', TZ, { showYear: true });
    expect(ja.dateText).toBe('2026年3月4日');
    expect(en.dateText).toBe('Mar 4, 2026');
  });
});

describe('toDatetimeLocalValue', () => {
  it('returns ISO-like local datetime string', () => {
    expect(toDatetimeLocalValue(new Date(2026, 2, 4, 9, 5))).toBe('2026-03-04T09:05');
  });

  it('pads month, day, hours and minutes', () => {
    expect(toDatetimeLocalValue(new Date(2026, 0, 3, 1, 2))).toBe('2026-01-03T01:02');
  });
});
