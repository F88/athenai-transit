import { describe, expect, it } from 'vitest';
import { isRouteTypeVisible } from '../route-type-visibility';

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
