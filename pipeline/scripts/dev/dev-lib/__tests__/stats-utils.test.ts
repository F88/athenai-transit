import { describe, expect, it } from 'vitest';
import { sortedMedian, sortedPercentile } from '../stats-utils';

describe('sortedMedian', () => {
  it('returns 0 for an empty array', () => {
    expect(sortedMedian([])).toBe(0);
  });

  it('returns the only element for a 1-element array', () => {
    expect(sortedMedian([42])).toBe(42);
  });

  it('returns the middle element for an odd-length array', () => {
    expect(sortedMedian([1, 2, 3])).toBe(2);
    expect(sortedMedian([1, 2, 3, 4, 5])).toBe(3);
    expect(sortedMedian([10, 20, 30, 40, 50, 60, 70])).toBe(40);
  });

  it('returns the average of the two middle elements for even-length arrays', () => {
    // Standard mathematical median: (20 + 30) / 2 = 25 (NOT 30).
    // The earlier `Math.floor(n / 2)` impl returned the upper-middle (30),
    // which biased medians upward. This test pins the corrected behavior.
    expect(sortedMedian([10, 20, 30, 40])).toBe(25);
    expect(sortedMedian([1, 2])).toBe(1.5);
    expect(sortedMedian([1, 2, 3, 4, 5, 6])).toBe(3.5);
  });

  it('handles arrays with negative values', () => {
    expect(sortedMedian([-3, -1, 1, 3])).toBe(0);
    expect(sortedMedian([-5, -3, -1])).toBe(-3);
  });

  it('handles arrays with floating-point values', () => {
    expect(sortedMedian([1.5, 2.5, 3.5])).toBe(2.5);
    expect(sortedMedian([1.0, 2.0, 3.0, 4.0])).toBe(2.5);
  });

  it('handles all-equal values', () => {
    expect(sortedMedian([5, 5, 5, 5])).toBe(5);
    expect(sortedMedian([7, 7, 7])).toBe(7);
  });

  it('handles large arrays', () => {
    const values = Array.from({ length: 1000 }, (_, i) => i + 1); // 1..1000
    // 1000 elements: average of 500th and 501st = (500 + 501) / 2 = 500.5
    expect(sortedMedian(values)).toBe(500.5);
  });
});

describe('sortedPercentile', () => {
  it('returns 0 for an empty array', () => {
    expect(sortedPercentile([], 0.5)).toBe(0);
    expect(sortedPercentile([], 0.9)).toBe(0);
    expect(sortedPercentile([], 0)).toBe(0);
    expect(sortedPercentile([], 1)).toBe(0);
  });

  it('returns the only element for a 1-element array regardless of q', () => {
    expect(sortedPercentile([42], 0)).toBe(42);
    expect(sortedPercentile([42], 0.5)).toBe(42);
    expect(sortedPercentile([42], 0.9)).toBe(42);
    expect(sortedPercentile([42], 1)).toBe(42);
  });

  it('returns the minimum for q = 0', () => {
    expect(sortedPercentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(sortedPercentile([10, 20, 30], 0)).toBe(10);
  });

  it('returns the maximum for q = 1', () => {
    expect(sortedPercentile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(sortedPercentile([10, 20, 30], 1)).toBe(30);
  });

  it('computes p90 correctly via nearest-rank (ceil method)', () => {
    // n=10: ceil(0.9 * 10) = 9, 0-indexed = 8 → values[8] = 9
    // (The previous floor-based impl returned values[9] = 10, biased high.)
    expect(sortedPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);

    // n=100: ceil(0.9 * 100) = 90, 0-indexed = 89 → values[89] = 90
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(sortedPercentile(hundred, 0.9)).toBe(90);

    // n=20: ceil(0.9 * 20) = 18, 0-indexed = 17 → values[17] = 18
    expect(
      sortedPercentile(
        Array.from({ length: 20 }, (_, i) => i + 1),
        0.9,
      ),
    ).toBe(18);
  });

  it('computes p50 correctly (matches nearest-rank median, not arithmetic median)', () => {
    // sortedPercentile(_, 0.5) uses nearest-rank, not the average-of-middle
    // definition, so it differs from sortedMedian for even-length arrays.
    // n=4: ceil(0.5 * 4) = 2, 0-indexed = 1 → values[1] = 20
    expect(sortedPercentile([10, 20, 30, 40], 0.5)).toBe(20);
    // n=5: ceil(0.5 * 5) = 3, 0-indexed = 2 → values[2] = 30
    expect(sortedPercentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
  });

  it('clamps the index to the array bounds', () => {
    // Defensive: q outside [0, 1] should still produce a valid index.
    expect(sortedPercentile([1, 2, 3], -0.5)).toBe(1); // clamped to 0
    expect(sortedPercentile([1, 2, 3], 1.5)).toBe(3); // clamped to n-1
  });

  it('handles small arrays correctly', () => {
    // n=3, q=0.9: ceil(2.7) = 3, 0-indexed = 2 → values[2] = 30
    expect(sortedPercentile([10, 20, 30], 0.9)).toBe(30);
    // n=2, q=0.5: ceil(1) = 1, 0-indexed = 0 → values[0] = 10
    expect(sortedPercentile([10, 20], 0.5)).toBe(10);
    // n=2, q=0.9: ceil(1.8) = 2, 0-indexed = 1 → values[1] = 20
    expect(sortedPercentile([10, 20], 0.9)).toBe(20);
  });

  it('handles arrays with floating-point values', () => {
    expect(sortedPercentile([1.5, 2.5, 3.5, 4.5, 5.5], 0.5)).toBe(3.5);
    expect(sortedPercentile([0.1, 0.2, 0.3, 0.4, 0.5], 0.9)).toBe(0.5);
  });

  it('handles all-equal values', () => {
    expect(sortedPercentile([7, 7, 7, 7, 7], 0.9)).toBe(7);
    expect(sortedPercentile([7, 7, 7, 7, 7], 0.5)).toBe(7);
  });
});
