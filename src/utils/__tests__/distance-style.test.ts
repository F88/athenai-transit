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

  it('returns the purple band at the 3000m boundary', () => {
    expect(distanceStyle(3000).color).toBe('#7b1fa2');
  });

  it('returns the 10km pink band for distances just past 3000m', () => {
    const result = distanceStyle(5_000);
    expect(result.color).toBe('#c2185b');
    expect(result.opacity).toBe(0.7);
  });

  it('returns the 10km pink band at its boundary', () => {
    const result = distanceStyle(10_000);
    expect(result.color).toBe('#c2185b');
    expect(result.opacity).toBe(0.7);
  });

  it('returns the 50km wine band for distances just past 10km', () => {
    const result = distanceStyle(20_000);
    expect(result.color).toBe('#880e4f');
    expect(result.opacity).toBe(0.4);
  });

  it('returns the 50km wine band at its boundary', () => {
    const result = distanceStyle(50_000);
    expect(result.color).toBe('#880e4f');
    expect(result.opacity).toBe(0.4);
  });

  it('returns the 100km gray band for distances just past the rainbow', () => {
    const result = distanceStyle(75_000);
    expect(result.color).toBe('var(--distance-band-100km)');
    expect(result.opacity).toBe(0.2);
  });

  it('returns the 100km gray band at its boundary', () => {
    const result = distanceStyle(100_000);
    expect(result.color).toBe('var(--distance-band-100km)');
    expect(result.opacity).toBe(0.2);
  });

  it('returns the 500km gray band for distances just past the 100km band', () => {
    const result = distanceStyle(200_000);
    expect(result.color).toBe('var(--distance-band-500km)');
    expect(result.opacity).toBe(0.15);
  });

  it('returns the 500km gray band at its boundary', () => {
    const result = distanceStyle(500_000);
    expect(result.color).toBe('var(--distance-band-500km)');
    expect(result.opacity).toBe(0.15);
  });

  it('returns the 1000km gray band for inter-region distances', () => {
    const result = distanceStyle(750_000);
    expect(result.color).toBe('var(--distance-band-1000km)');
    expect(result.opacity).toBe(0.1);
  });

  it('returns the 1000km gray band at its boundary', () => {
    const result = distanceStyle(1_000_000);
    expect(result.color).toBe('var(--distance-band-1000km)');
    expect(result.opacity).toBe(0.1);
  });

  it('returns fallback for distances exceeding the 1000km band', () => {
    const result = distanceStyle(2_000_000);
    expect(result.color).toBe('var(--distance-band-fallback)');
    expect(result.textColor).toBe('#ffffff');
    expect(result.opacity).toBe(0.5);
  });

  it('opacity decreases monotonically across the rainbow-extension and gray fade', () => {
    // The "farther = more transparent" invariant holds from the rainbow
    // extension (10km pink) through the gray fallback. The earlier
    // visible-range opacities are design-driven and not in this chain.
    const samples = [5_000, 20_000, 75_000, 200_000, 750_000];
    const opacities = samples.map((m) => distanceStyle(m).opacity);
    for (let i = 1; i < opacities.length; i += 1) {
      expect(opacities[i]).toBeLessThan(opacities[i - 1]);
    }
  });

  it('uses distinct CSS-variable colors across the long-range gray bands', () => {
    // The point of theme-aware vars is that adjacent bands resolve to
    // different colors, so checking distinctness is enough — actual hex
    // resolution is the browser's job.
    const colors = [
      distanceStyle(75_000).color,
      distanceStyle(200_000).color,
      distanceStyle(750_000).color,
      distanceStyle(5_000_000).color,
    ];
    expect(new Set(colors).size).toBe(4);
  });

  it('returns the first band for 0m (within first band)', () => {
    expect(distanceStyle(0).color).toBe('#1e88e5');
  });

  it('returns the first band for negative distance (matches via meters <= band.max)', () => {
    // Negative values <= 100 satisfy the first band's predicate, so the lookup
    // resolves to the same blue color rather than to the gray fallback.
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

  it('returns the wine band hex for distances inside the 50km rainbow extension', () => {
    expect(distanceColor(20_000)).toBe('#880e4f');
  });

  it('returns the 100km gray CSS variable for distances beyond the colored bands', () => {
    expect(distanceColor(75_000)).toBe('var(--distance-band-100km)');
  });

  it('returns the fallback gray CSS variable for distances beyond the 1000km band', () => {
    expect(distanceColor(5_000_000)).toBe('var(--distance-band-fallback)');
  });
});
