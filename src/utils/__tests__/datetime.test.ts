import { describe, expect, it } from 'vitest';
import { formatDateParts, toDatetimeLocalValue } from '../datetime';

const TZ = 'Asia/Tokyo';

// Use UTC dates to avoid CI timezone dependency.
// 2026-03-04T00:15:00Z = 2026-03-04T09:15:00+09:00 (JST)
const WED_0915_UTC = new Date('2026-03-04T00:15:00Z');
// 2026-03-07T14:59:00Z = 2026-03-07T23:59:00+09:00 (JST, Saturday)
const SAT_2359_UTC = new Date('2026-03-07T14:59:00Z');
// 2026-03-01T09:30:00Z = 2026-03-01T18:30:00+09:00 (JST, Sunday)
const SUN_1830_UTC = new Date('2026-03-01T09:30:00Z');
// 2026-01-01T01:00:00Z = 2026-01-01T10:00:00+09:00 (JST, New Year)
const HOLIDAY_UTC = new Date('2026-01-01T01:00:00Z');

describe('formatDateParts', () => {
  it('returns dateText, dayLabel, and dayColorCategory', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ);
    expect(result.dateText).toBeTruthy();
    expect(result.dayLabel).toBeTruthy();
    expect(result.time).toBeUndefined();
    expect(result.dayColorCategory).toBe('weekday');
  });

  it('includes time when showTime is true', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ, { showTime: true });
    expect(result.time).toBeTruthy();
    expect(result.time).toContain('09');
    expect(result.time).toContain('15');
  });

  it('omits time when showTime is false', () => {
    const result = formatDateParts(WED_0915_UTC, 'ja', TZ, { showTime: false });
    expect(result.time).toBeUndefined();
  });

  it('returns saturday category for Saturday', () => {
    const result = formatDateParts(SAT_2359_UTC, 'en', TZ);
    expect(result.dayColorCategory).toBe('saturday');
  });

  it('returns sunday category for Sunday', () => {
    const result = formatDateParts(SUN_1830_UTC, 'en', TZ);
    expect(result.dayColorCategory).toBe('sunday');
  });

  it('returns holiday category for a national holiday', () => {
    const result = formatDateParts(HOLIDAY_UTC, 'ja', TZ);
    expect(result.dayColorCategory).toBe('holiday');
  });

  it('produces different dayLabel for different locales', () => {
    const ja = formatDateParts(WED_0915_UTC, 'ja', TZ);
    const en = formatDateParts(WED_0915_UTC, 'en', TZ);
    expect(ja.dayLabel).not.toBe(en.dayLabel);
  });

  it('produces different dateText for different locales', () => {
    const ja = formatDateParts(WED_0915_UTC, 'ja', TZ, { showYear: true });
    const en = formatDateParts(WED_0915_UTC, 'en', TZ, { showYear: true });
    expect(ja.dateText).not.toBe(en.dateText);
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
