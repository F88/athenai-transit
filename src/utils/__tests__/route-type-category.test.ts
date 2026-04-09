import { describe, expect, it } from 'vitest';
import {
  ROUTE_TYPE_CATEGORY_GROUPS,
  getRouteTypeCategoryEmoji,
  routeTypeCategory,
  routeTypeGroup,
} from '../route-type-category';

describe('ROUTE_TYPE_CATEGORY_GROUPS', () => {
  it('defines expected route type groups including unknown (-1)', () => {
    expect(ROUTE_TYPE_CATEGORY_GROUPS).toEqual({
      bus: [3, 11],
      subway: [1],
      train: [0, 2, 12],
      others: [-1, 4, 5, 6, 7],
    });
  });
});

describe('routeTypeCategory', () => {
  it.each([
    [3, 'bus'],
    [11, 'bus'],
    [1, 'subway'],
    [0, 'train'],
    [2, 'train'],
    [12, 'train'],
    [-1, 'others'],
    [4, 'others'],
    [5, 'others'],
    [6, 'others'],
    [7, 'others'],
    [8, 'others'],
    [99, 'others'],
  ] as const)('classifies route_type %d as %s', (routeType, expected) => {
    expect(routeTypeCategory(routeType)).toBe(expected);
  });

  it('treats edge numeric values as others', () => {
    expect(routeTypeCategory(Number.NaN)).toBe('others');
    expect(routeTypeCategory(Number.POSITIVE_INFINITY)).toBe('others');
    expect(routeTypeCategory(Number.NEGATIVE_INFINITY)).toBe('others');
    expect(routeTypeCategory(1.5)).toBe('others');
  });
});

describe('routeTypeGroup', () => {
  it.each([
    [3, [3, 11]],
    [11, [3, 11]],
    [1, [1]],
    [0, [0, 2, 12]],
    [2, [0, 2, 12]],
    [12, [0, 2, 12]],
    [-1, [-1, 4, 5, 6, 7]],
    [4, [-1, 4, 5, 6, 7]],
    [5, [-1, 4, 5, 6, 7]],
    [6, [-1, 4, 5, 6, 7]],
    [7, [-1, 4, 5, 6, 7]],
    [99, [-1, 4, 5, 6, 7]],
  ] as const)('returns the category group for route_type %d', (routeType, expected) => {
    expect(routeTypeGroup(routeType)).toEqual(expected);
  });

  it('returns others group for edge numeric values', () => {
    expect(routeTypeGroup(Number.NaN)).toEqual([-1, 4, 5, 6, 7]);
    expect(routeTypeGroup(Number.POSITIVE_INFINITY)).toEqual([-1, 4, 5, 6, 7]);
    expect(routeTypeGroup(1.5)).toEqual([-1, 4, 5, 6, 7]);
  });
});

describe('getRouteTypeCategoryEmoji', () => {
  it('returns emoji for all categories', () => {
    expect(getRouteTypeCategoryEmoji('bus')).toBe('🚌');
    expect(getRouteTypeCategoryEmoji('subway')).toBe('🚇');
    expect(getRouteTypeCategoryEmoji('train')).toBe('🚆');
    expect(getRouteTypeCategoryEmoji('others')).toBe('🦄');
  });
});
