import { describe, expect, it } from 'vitest';
import { DAY_COLOR_CATEGORY_CLASSES, getDayColorCategory } from '../day-of-week';

// Use new Date(year, monthIndex, day) to avoid TZ ambiguity.

describe('getDayColorCategory', () => {
  it('returns "weekday" for Monday', () => {
    expect(getDayColorCategory(new Date(2026, 2, 2))).toBe('weekday');
  });

  it('returns "weekday" for Friday', () => {
    expect(getDayColorCategory(new Date(2026, 2, 6))).toBe('weekday');
  });

  it('returns "saturday" for Saturday', () => {
    expect(getDayColorCategory(new Date(2026, 2, 7))).toBe('saturday');
  });

  it('returns "sunday" for Sunday', () => {
    expect(getDayColorCategory(new Date(2026, 2, 1))).toBe('sunday');
  });

  it('returns "holiday" for a national holiday on a weekday', () => {
    expect(getDayColorCategory(new Date(2026, 0, 12))).toBe('holiday');
  });

  it('returns "holiday" for New Year', () => {
    expect(getDayColorCategory(new Date(2026, 0, 1))).toBe('holiday');
  });

  it('returns "saturday" for a non-holiday Saturday', () => {
    expect(getDayColorCategory(new Date(2026, 2, 14))).toBe('saturday');
  });

  it('returns "holiday" for a national holiday on Saturday', () => {
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
