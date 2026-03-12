import { describe, it, expect } from 'vitest';
import { routeTypeColor, primaryRouteType, isRouteTypeVisible } from '../route-type-color';

describe('routeTypeColor', () => {
  it.each([
    [0, '#f57f17'],
    [1, '#7b1fa2'],
    [2, '#1565c0'],
    [3, '#2e7d32'],
  ])('returns the correct color for route_type %d', (routeType, expected) => {
    expect(routeTypeColor(routeType)).toBe(expected);
  });

  it('returns default gray for unknown route_type', () => {
    expect(routeTypeColor(99)).toBe('#616161');
  });

  it('returns default gray for negative route_type', () => {
    expect(routeTypeColor(-1)).toBe('#616161');
  });
});

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

describe('isRouteTypeVisible', () => {
  it('returns true when at least one route type is visible', () => {
    expect(isRouteTypeVisible([0, 3], new Set([3]))).toBe(true);
    expect(isRouteTypeVisible([1, 2], new Set([2]))).toBe(true);
  });

  it('returns false when no route types are visible', () => {
    expect(isRouteTypeVisible([0, 1], new Set([2, 3]))).toBe(false);
  });

  it('returns false for empty routeTypes array', () => {
    expect(isRouteTypeVisible([], new Set([0, 1, 2, 3]))).toBe(false);
  });

  it('returns false for empty visible set', () => {
    expect(isRouteTypeVisible([0, 1, 2, 3], new Set())).toBe(false);
  });

  it('returns true when all route types are visible', () => {
    expect(isRouteTypeVisible([0, 1, 2, 3], new Set([0, 1, 2, 3]))).toBe(true);
  });

  it('handles single route type', () => {
    expect(isRouteTypeVisible([3], new Set([3]))).toBe(true);
    expect(isRouteTypeVisible([3], new Set([0]))).toBe(false);
  });
});
