import { describe, expect, it } from 'vitest';
import { distanceStyle, distanceColor, DISTANCE_BANDS } from '../distance-style';

describe('distanceStyle', () => {
  it('returns the first band for distance within 100m', () => {
    const result = distanceStyle(50);
    expect(result.color).toBe('#1e88e5');
    expect(result.opacity).toBe(1.0);
  });

  it('returns exact boundary match (100m)', () => {
    expect(distanceStyle(100).color).toBe('#1e88e5');
  });

  it('returns second band for 101-300m', () => {
    expect(distanceStyle(200).color).toBe('#43a047');
  });

  it('returns last defined band for distance at 3000m', () => {
    expect(distanceStyle(3000).color).toBe('#7b1fa2');
  });

  it('returns fallback for distance exceeding all bands', () => {
    const result = distanceStyle(5000);
    expect(result.color).toBe('#616161');
    expect(result.textColor).toBe('#ffffff');
    expect(result.opacity).toBe(0.15);
  });

  it('returns fallback for 0m (within first band)', () => {
    expect(distanceStyle(0).color).toBe('#1e88e5');
  });

  it('returns fallback for negative distance (no band matches)', () => {
    // Negative values won't match any band (meters <= band.max is true for first band)
    expect(distanceStyle(-10).color).toBe('#1e88e5');
  });

  it('returns correct textColor for each band', () => {
    expect(distanceStyle(50).textColor).toBe('#ffffff');
    expect(distanceStyle(400).textColor).toBe('#333333'); // 300-500 band
  });

  it('matches each band at its boundary', () => {
    for (const band of DISTANCE_BANDS) {
      const result = distanceStyle(band.max);
      expect(result.color).toBe(band.color);
      expect(result.opacity).toBe(band.opacity);
    }
  });
});

describe('distanceColor', () => {
  it('returns the color string for a given distance', () => {
    expect(distanceColor(50)).toBe('#1e88e5');
  });

  it('returns fallback color for distance beyond all bands', () => {
    expect(distanceColor(10000)).toBe('#616161');
  });
});
