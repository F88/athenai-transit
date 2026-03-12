import { describe, expect, it } from 'vitest';
import { DAY_COLOR_CATEGORY_CLASSES, formatDateWithDay, getDayColorCategory } from '../day-of-week';

// Use new Date(year, monthIndex, day) to avoid TZ ambiguity.

describe('getDayColorCategory', () => {
  it('returns "weekday" for Monday', () => {
    // 2026-03-02 is a Monday
    expect(getDayColorCategory(new Date(2026, 2, 2))).toBe('weekday');
  });

  it('returns "weekday" for Friday', () => {
    // 2026-03-06 is a Friday
    expect(getDayColorCategory(new Date(2026, 2, 6))).toBe('weekday');
  });

  it('returns "saturday" for Saturday', () => {
    // 2026-03-07 is a Saturday
    expect(getDayColorCategory(new Date(2026, 2, 7))).toBe('saturday');
  });

  it('returns "sunday" for Sunday', () => {
    // 2026-03-01 is a Sunday
    expect(getDayColorCategory(new Date(2026, 2, 1))).toBe('sunday');
  });

  it('returns "holiday" for a national holiday on a weekday', () => {
    // 2026-01-12 is Coming of Age Day (Monday)
    expect(getDayColorCategory(new Date(2026, 0, 12))).toBe('holiday');
  });

  it('returns "holiday" for New Year even if it falls on Thursday', () => {
    // 2026-01-01 is a Thursday
    expect(getDayColorCategory(new Date(2026, 0, 1))).toBe('holiday');
  });

  it('returns "saturday" for a non-holiday Saturday', () => {
    // 2026-03-14 is a Saturday, not a holiday
    expect(getDayColorCategory(new Date(2026, 2, 14))).toBe('saturday');
  });

  it('returns "holiday" for a national holiday that falls on Saturday', () => {
    // 2025-05-03 is Constitution Memorial Day (Saturday)
    expect(getDayColorCategory(new Date(2025, 4, 3))).toBe('holiday');
  });
});

describe('DAY_COLOR_CATEGORY_CLASSES', () => {
  it('has color classes for all categories', () => {
    expect(DAY_COLOR_CATEGORY_CLASSES.weekday).toBeDefined();
    expect(DAY_COLOR_CATEGORY_CLASSES.saturday).toBeDefined();
    expect(DAY_COLOR_CATEGORY_CLASSES.sunday).toBeDefined();
    expect(DAY_COLOR_CATEGORY_CLASSES.holiday).toBeDefined();
  });
});

describe('formatDateWithDay', () => {
  it('formats a weekday correctly', () => {
    // 2026-03-04 is a Wednesday
    const result = formatDateWithDay(new Date(2026, 2, 4));
    expect(result.dateText).toBe('2026年3月4日');
    expect(result.dayLabel).toBe('水');
    expect(result.dayColorCategory).toBe('weekday');
  });

  it('formats a Sunday correctly', () => {
    // 2026-03-01 is a Sunday
    const result = formatDateWithDay(new Date(2026, 2, 1));
    expect(result.dateText).toBe('2026年3月1日');
    expect(result.dayLabel).toBe('日');
    expect(result.dayColorCategory).toBe('sunday');
  });

  it('formats a Saturday correctly', () => {
    // 2026-03-07 is a Saturday
    const result = formatDateWithDay(new Date(2026, 2, 7));
    expect(result.dateText).toBe('2026年3月7日');
    expect(result.dayLabel).toBe('土');
    expect(result.dayColorCategory).toBe('saturday');
  });

  it('formats a national holiday on a weekday as holiday category (red)', () => {
    // 2026-01-01 is a Thursday (New Year)
    const result = formatDateWithDay(new Date(2026, 0, 1));
    expect(result.dateText).toBe('2026年1月1日');
    expect(result.dayLabel).toBe('木');
    expect(result.dayColorCategory).toBe('holiday');
  });
});
