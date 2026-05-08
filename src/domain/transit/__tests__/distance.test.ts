import { describe, expect, it } from 'vitest';
import { formatDistance, formatDistanceCompact, getBearingDeg, getDistanceM } from '../distance';

describe('getDistanceM', () => {
  it('returns 0 for identical points', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { stop_lat: 35.0, stop_lon: 139.0 };
    expect(getDistanceM(a, b)).toBe(0);
  });

  it('returns a reasonable distance for Tokyo Station to Shinjuku Station', () => {
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    const shinjuku = { stop_lat: 35.6896, stop_lon: 139.7006 };
    const d = getDistanceM(tokyo, shinjuku);
    expect(d).toBeGreaterThan(5_500);
    expect(d).toBeLessThan(7_500);
  });

  it('handles dateline crossing without taking the long way around', () => {
    const westOfDateline = { lat: 0, lng: 179 };
    const eastAcrossDateline = { stop_lat: 0, stop_lon: -179 };
    const d = getDistanceM(westOfDateline, eastAcrossDateline);
    expect(d).toBeGreaterThan(220_000);
    expect(d).toBeLessThan(223_000);
  });
});

describe('getBearingDeg', () => {
  const origin = { lat: 35.0, lng: 139.0 };

  it('returns 90 for due east', () => {
    const east = { stop_lat: 35.0, stop_lon: 140.0 };
    expect(getBearingDeg(origin, east)).toBeCloseTo(90, 0);
  });

  it('handles dateline crossing without flipping to the long way around', () => {
    const westOfDateline = { lat: 0, lng: 179 };
    const eastAcrossDateline = { stop_lat: 0, stop_lon: -179 };
    expect(getBearingDeg(westOfDateline, eastAcrossDateline)).toBeCloseTo(90, 0);
  });

  it('returns 0 for identical points', () => {
    const same = { stop_lat: 35.0, stop_lon: 139.0 };
    expect(getBearingDeg(origin, same)).toBe(0);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distance as meters', () => {
    expect(formatDistance(450, 'en')).toBe('450m');
  });

  it('rounds meters to nearest integer', () => {
    expect(formatDistance(123.7, 'en')).toBe('124m');
  });

  it("returns '0m' for values that round to zero", () => {
    expect(formatDistance(0, 'en')).toBe('0m');
    expect(formatDistance(0.1, 'en')).toBe('0m');
    expect(formatDistance(0.4, 'en')).toBe('0m');
  });

  it("returns '1m' for values that round up to 1", () => {
    expect(formatDistance(0.5, 'en')).toBe('1m');
    expect(formatDistance(0.9, 'en')).toBe('1m');
  });

  it('formats 1 km+ distance with one decimal', () => {
    expect(formatDistance(1500, 'en')).toBe('1.5km');
  });

  it('formats exact km values', () => {
    expect(formatDistance(1000, 'en')).toBe('1.0km');
    expect(formatDistance(2000, 'en')).toBe('2.0km');
  });

  it('keeps one decimal place below 100 km', () => {
    expect(formatDistance(99_900, 'en')).toBe('99.9km');
  });

  it('truncates decimal places at 100 km and above', () => {
    expect(formatDistance(100_000, 'en')).toBe('100km');
    expect(formatDistance(100_900, 'en')).toBe('100km');
    expect(formatDistance(101_999, 'en')).toBe('101km');
  });

  it('formats boundary value just below 1 km as meters', () => {
    expect(formatDistance(999, 'en')).toBe('999m');
  });

  it('omits unit when unit=false for sub-km', () => {
    expect(formatDistance(450, 'en', false)).toBe('450');
  });

  it('still shows "km" when unit=false for 1km+', () => {
    expect(formatDistance(1000, 'en', false)).toBe('1.0km');
    expect(formatDistance(1500, 'en', false)).toBe('1.5km');
  });

  it('stays in meter branch when raw value < 1000 even if rounded to 1000', () => {
    expect(formatDistance(999.5, 'en')).toBe('1,000m');
  });

  it('uses locale-specific decimal separator for km values', () => {
    expect(formatDistance(1500, 'de')).toBe('1,5km');
    expect(formatDistance(1500, 'fr')).toBe('1,5km');
    expect(formatDistance(1500, 'ja')).toBe('1.5km');
  });

  it('uses locale-specific thousands separator in meter branch', () => {
    expect(formatDistance(999.5, 'de')).toBe('1.000m');
    expect(formatDistance(999.5, 'ja')).toBe('1,000m');
  });
});

describe('distance formatter formatDistanceCompact', () => {
  it('formats sub-km distance as integer without unit', () => {
    expect(formatDistanceCompact(450, 'en')).toBe('450');
  });

  it('rounds to nearest integer', () => {
    expect(formatDistanceCompact(123.7, 'en')).toBe('124');
  });

  it('returns "0" for zero', () => {
    expect(formatDistanceCompact(0, 'en')).toBe('0');
  });

  it('formats 1km+ with one decimal and "km"', () => {
    expect(formatDistanceCompact(1500, 'en')).toBe('1.5km');
    expect(formatDistanceCompact(1000, 'en')).toBe('1.0km');
  });

  it('formats boundary value just below 1 km', () => {
    expect(formatDistanceCompact(999, 'en')).toBe('999');
  });

  it('uses comma separator for values that round to >= 1000 but are < 1000m', () => {
    expect(formatDistanceCompact(999.5, 'en')).toBe('1,000');
  });

  it('uses locale-specific decimal separator for km values', () => {
    expect(formatDistanceCompact(1500, 'de')).toBe('1,5km');
    expect(formatDistanceCompact(1500, 'fr')).toBe('1,5km');
    expect(formatDistanceCompact(1500, 'ja')).toBe('1.5km');
  });
});
