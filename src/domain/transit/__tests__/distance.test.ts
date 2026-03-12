import { describe, expect, it } from 'vitest';
import { distanceM, formatDistance, formatDistanceCompact } from '../distance';

describe('distanceM', () => {
  it('returns 0 for identical points', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { stop_lat: 35.0, stop_lon: 139.0 };
    expect(distanceM(a, b)).toBe(0);
  });

  it('calculates ~111 km for 1 degree latitude difference', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { stop_lat: 36.0, stop_lon: 139.0 };
    const d = distanceM(a, b);
    // 1 degree lat ≈ 111,000 m
    expect(d).toBeCloseTo(111_000, -2);
  });

  it('calculates correct distance for 1 degree longitude at ~35N', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { stop_lat: 35.0, stop_lon: 140.0 };
    const d = distanceM(a, b);
    // 1 degree lng at 35°N ≈ 111_000 * cos(35°) ≈ 90,932 m
    const expected = 111_000 * Math.cos(35 * (Math.PI / 180));
    expect(d).toBeCloseTo(expected, -2);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const a = { lat: 35.6812, lng: 139.7671 };
    const b = { stop_lat: 35.6895, stop_lon: 139.6917 };
    const ab = distanceM(a, b);
    const ba = distanceM(
      { lat: b.stop_lat, lng: b.stop_lon },
      { stop_lat: a.lat, stop_lon: a.lng },
    );
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns a reasonable distance for Tokyo Station to Shinjuku Station (~6.4 km)', () => {
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    const shinjuku = { stop_lat: 35.6896, stop_lon: 139.7006 };
    const d = distanceM(tokyo, shinjuku);
    // Roughly 6–7 km
    expect(d).toBeGreaterThan(5_500);
    expect(d).toBeLessThan(7_500);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distance as meters', () => {
    expect(formatDistance(450)).toBe('450m');
  });

  it('rounds meters to nearest integer', () => {
    expect(formatDistance(123.7)).toBe('124m');
  });

  it("returns '0m' for values that round to zero", () => {
    expect(formatDistance(0)).toBe('0m');
    expect(formatDistance(0.1)).toBe('0m');
    expect(formatDistance(0.4)).toBe('0m');
  });

  it("returns '1m' for values that round up to 1", () => {
    expect(formatDistance(0.5)).toBe('1m');
    expect(formatDistance(0.9)).toBe('1m');
  });

  it('formats 1 km+ distance with one decimal', () => {
    expect(formatDistance(1500)).toBe('1.5km');
  });

  it('formats exact km values', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(2000)).toBe('2.0km');
  });

  it('formats boundary value just below 1 km as meters', () => {
    expect(formatDistance(999)).toBe('999m');
  });

  it('omits unit when unit=false for sub-km', () => {
    expect(formatDistance(450, false)).toBe('450');
  });

  it('still shows "km" when unit=false for 1km+', () => {
    expect(formatDistance(1000, false)).toBe('1.0km');
    expect(formatDistance(1500, false)).toBe('1.5km');
  });

  it('stays in meter branch when raw value < 1000 even if rounded to 1000', () => {
    // 999.5 < 1000, so enters sub-km branch; Math.round(999.5) = 1000
    expect(formatDistance(999.5)).toBe('1000m');
  });
});

describe('formatDistanceCompact', () => {
  it('formats sub-km distance as integer without unit', () => {
    expect(formatDistanceCompact(450)).toBe('450');
  });

  it('rounds to nearest integer', () => {
    expect(formatDistanceCompact(123.7)).toBe('124');
  });

  it('returns "0" for zero', () => {
    expect(formatDistanceCompact(0)).toBe('0');
  });

  it('formats 1km+ with one decimal and "km"', () => {
    expect(formatDistanceCompact(1500)).toBe('1.5km');
    expect(formatDistanceCompact(1000)).toBe('1.0km');
  });

  it('formats boundary value just below 1 km', () => {
    expect(formatDistanceCompact(999)).toBe('999');
  });

  it('uses comma separator for values that round to >= 1000 but are < 1000m', () => {
    // 999.5 rounds to 1000, but 999.5 < 1000 so enters sub-km branch
    expect(formatDistanceCompact(999.5)).toBe('1,000');
  });
});
