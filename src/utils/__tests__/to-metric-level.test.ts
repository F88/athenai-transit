import { describe, expect, it } from 'vitest';
import { toMetricLevel } from '../to-metric-level';

describe('toMetricLevel', () => {
  it('returns level 0 when the value is below the first threshold', () => {
    expect(toMetricLevel(-1, [0, 5, 20, 100, 300])).toBe(0);
  });

  it('increments the level when the value reaches each threshold', () => {
    expect(toMetricLevel(0, [0, 5, 20, 100, 300])).toBe(1);
    expect(toMetricLevel(20, [0, 5, 20, 100, 300])).toBe(3);
  });

  it('caps the level at the number of thresholds when the value exceeds the last threshold', () => {
    expect(toMetricLevel(999, [0, 5, 20, 100, 300])).toBe(5);
  });

  it('uses ascending direction by default', () => {
    expect(toMetricLevel(24, [0, 5, 20, 100, 300])).toBe(3);
    expect(toMetricLevel(24, [0, 5, 20, 100, 300], { direction: 'ascending' })).toBe(3);
  });

  it('reverses the scale when direction is descending', () => {
    expect(toMetricLevel(24, [0, 5, 20, 100, 300], { direction: 'descending' })).toBe(2);
    expect(toMetricLevel(999, [0, 5, 20, 100, 300], { direction: 'descending' })).toBe(0);
  });
});
