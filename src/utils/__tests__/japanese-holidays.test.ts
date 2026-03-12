import { describe, expect, it } from 'vitest';
import { getJapaneseHolidayName, isJapaneseHoliday } from '../japanese-holidays';

// Use new Date(year, monthIndex, day) to avoid TZ ambiguity.

describe('isJapaneseHoliday', () => {
  it('returns true for New Year (Jan 1)', () => {
    expect(isJapaneseHoliday(new Date(2026, 0, 1))).toBe(true);
  });

  it('returns true for Coming of Age Day (2nd Monday of January)', () => {
    // 2026-01-12 is the 2nd Monday of January
    expect(isJapaneseHoliday(new Date(2026, 0, 12))).toBe(true);
  });

  it('returns true for Vernal Equinox Day (around Mar 20-21)', () => {
    // 2026 Vernal Equinox: March 20
    expect(isJapaneseHoliday(new Date(2026, 2, 20))).toBe(true);
  });

  it('returns false for a regular weekday', () => {
    // 2026-03-04 is a Wednesday, not a holiday
    expect(isJapaneseHoliday(new Date(2026, 2, 4))).toBe(false);
  });

  it('returns false for a regular weekend', () => {
    // 2026-03-07 is a Saturday, not a holiday
    expect(isJapaneseHoliday(new Date(2026, 2, 7))).toBe(false);
  });

  it('returns true for Culture Day (Nov 3)', () => {
    expect(isJapaneseHoliday(new Date(2026, 10, 3))).toBe(true);
  });

  it('returns true for a substitute holiday (振替休日)', () => {
    // 2025-11-24 is a substitute holiday (振替休日) because
    // Labor Thanksgiving Day (Nov 23) falls on Sunday in 2025.
    expect(isJapaneseHoliday(new Date(2025, 10, 24))).toBe(true);
  });
});

describe('getJapaneseHolidayName', () => {
  it('returns holiday name for New Year', () => {
    expect(getJapaneseHolidayName(new Date(2026, 0, 1))).toBe('元日');
  });

  it('returns holiday name for Constitution Memorial Day', () => {
    expect(getJapaneseHolidayName(new Date(2026, 4, 3))).toBe('憲法記念日');
  });

  it('returns undefined for a non-holiday', () => {
    expect(getJapaneseHolidayName(new Date(2026, 2, 4))).toBeUndefined();
  });
});
