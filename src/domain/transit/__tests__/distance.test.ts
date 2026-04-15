import { describe, expect, it } from 'vitest';
import { bearingDeg, distanceM, formatDistance, formatDistanceCompact } from '../distance';

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
    // 999.5 < 1000, so enters sub-km branch; Math.round(999.5) = 1000.
    // en locale formats 1000 with a thousands separator.
    expect(formatDistance(999.5, 'en')).toBe('1,000m');
  });

  it('uses locale-specific decimal separator for km values', () => {
    expect(formatDistance(1500, 'de')).toBe('1,5km');
    expect(formatDistance(1500, 'fr')).toBe('1,5km');
    expect(formatDistance(1500, 'ja')).toBe('1.5km');
  });

  it('uses locale-specific thousands separator in meter branch', () => {
    // Raw 1500 ≥ 1000, so the meter branch is skipped and km is used.
    // Pick 999.5 so rounding lands on 1000 within the meter branch.
    expect(formatDistance(999.5, 'de')).toBe('1.000m');
    expect(formatDistance(999.5, 'ja')).toBe('1,000m');
  });
});

describe('bearingDeg', () => {
  const origin = { lat: 35.0, lng: 139.0 };

  it('returns 0 for due north', () => {
    const north = { stop_lat: 36.0, stop_lon: 139.0 };
    expect(bearingDeg(origin, north)).toBeCloseTo(0, 0);
  });

  it('returns 90 for due east', () => {
    const east = { stop_lat: 35.0, stop_lon: 140.0 };
    expect(bearingDeg(origin, east)).toBeCloseTo(90, 0);
  });

  it('returns 180 for due south', () => {
    const south = { stop_lat: 34.0, stop_lon: 139.0 };
    expect(bearingDeg(origin, south)).toBeCloseTo(180, 0);
  });

  it('returns 270 for due west', () => {
    const west = { stop_lat: 35.0, stop_lon: 138.0 };
    expect(bearingDeg(origin, west)).toBeCloseTo(270, 0);
  });

  it('returns ~45 for northeast', () => {
    // Use latitude-adjusted offset so bearing is close to 45°
    const midLat = 35.0 * (Math.PI / 180);
    const lngOffset = 1 / Math.cos(midLat); // compensate for longitude shrinkage
    const ne = { stop_lat: 36.0, stop_lon: 139.0 + lngOffset };
    expect(bearingDeg(origin, ne)).toBeCloseTo(45, 0);
  });

  it('returns value in [0, 360) range', () => {
    const sw = { stop_lat: 34.0, stop_lon: 138.0 };
    const bearing = bearingDeg(origin, sw);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  it('returns 0 for identical points (degenerate case)', () => {
    const same = { stop_lat: 35.0, stop_lon: 139.0 };
    // atan2(0, 0) = 0 → bearing = 0
    expect(bearingDeg(origin, same)).toBe(0);
  });
});

describe('formatDistanceCompact', () => {
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
    // 999.5 rounds to 1000, but 999.5 < 1000 so enters sub-km branch
    expect(formatDistanceCompact(999.5, 'en')).toBe('1,000');
  });

  it('uses locale-specific decimal separator for km values', () => {
    expect(formatDistanceCompact(1500, 'de')).toBe('1,5km');
    expect(formatDistanceCompact(1500, 'fr')).toBe('1,5km');
    expect(formatDistanceCompact(1500, 'ja')).toBe('1.5km');
  });
});
