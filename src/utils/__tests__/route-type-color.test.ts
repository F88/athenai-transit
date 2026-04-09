import { describe, expect, it } from 'vitest';
import { routeTypeColor } from '../route-type-color';

describe('routeTypeColor', () => {
  it.each([
    [-1, '#455A64'],
    [0, '#f57f17'],
    [1, '#7b1fa2'],
    [2, '#1565c0'],
    [3, '#2e7d32'],
    [4, '#0288d1'],
    [11, '#4e342e'],
    [12, '#37474f'],
  ])('returns the correct color for route_type %d', (routeType, expected) => {
    expect(routeTypeColor(routeType)).toBe(expected);
  });

  it('returns default gray for unknown route_type', () => {
    expect(routeTypeColor(99)).toBe('#616161');
  });

  it('returns configured unknown color for route_type -1', () => {
    expect(routeTypeColor(-1)).toBe('#455A64');
  });
});
