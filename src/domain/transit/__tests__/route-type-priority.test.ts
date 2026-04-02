import { describe, expect, it } from 'vitest';
import { primaryRouteType } from '../route-type-priority';

describe('primaryRouteType', () => {
  it('returns 3 (bus) for empty array', () => {
    expect(primaryRouteType([])).toBe(3);
  });

  it('returns the single element for single-element array', () => {
    expect(primaryRouteType([0])).toBe(0);
    expect(primaryRouteType([1])).toBe(1);
    expect(primaryRouteType([2])).toBe(2);
  });

  it('returns 3 (bus) when bus is the only type', () => {
    expect(primaryRouteType([3])).toBe(3);
  });

  it('prioritizes bus (3) when present among multiple types', () => {
    expect(primaryRouteType([0, 1, 2, 3])).toBe(3);
    expect(primaryRouteType([0, 3])).toBe(3);
    expect(primaryRouteType([1, 3])).toBe(3);
  });

  it('returns largest value when bus (3) is not present', () => {
    expect(primaryRouteType([0, 1])).toBe(1);
    expect(primaryRouteType([0, 2])).toBe(2);
    expect(primaryRouteType([0, 1, 2])).toBe(2);
  });

  it('handles higher route_type values (4+) when bus is absent', () => {
    expect(primaryRouteType([0, 7])).toBe(7);
    expect(primaryRouteType([2, 12])).toBe(12);
  });

  it('still prioritizes bus (3) over higher values', () => {
    expect(primaryRouteType([3, 7])).toBe(3);
    expect(primaryRouteType([3, 12])).toBe(3);
  });
});
