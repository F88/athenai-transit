import { describe, expect, it } from 'vitest';
import { filterVisibleRouteShapes, getRouteShapeStyle } from '../route-shapes';
import type { RouteShape } from '../../../types/app/map';
import type { RouteType } from '../../../types/app/transit';

function makeShape(
  routeId: string,
  routeType: RouteType,
  route: RouteShape['route'] = null,
): RouteShape {
  return {
    routeId,
    routeType,
    color: '#000000',
    route,
    points: [[35.68, 139.76]],
  };
}

describe('filterVisibleRouteShapes', () => {
  const shapes = [
    makeShape('bus-1', 3),
    makeShape('bus-2', 3),
    makeShape('subway-1', 1),
    makeShape('tram-1', 0),
  ];

  it('filters by visible route types', () => {
    const result = filterVisibleRouteShapes(shapes, new Set([1]), null, false);
    expect(result.map((s) => s.routeId)).toEqual(['subway-1']);
  });

  it('returns all visible types when hideUnselected is false', () => {
    const result = filterVisibleRouteShapes(shapes, new Set([0, 1, 3]), new Set(['bus-1']), false);
    expect(result).toHaveLength(4);
  });

  it('hides unselected routes when hideUnselected is true and stop is selected', () => {
    const result = filterVisibleRouteShapes(shapes, new Set([0, 1, 3]), new Set(['bus-1']), true);
    expect(result.map((s) => s.routeId)).toEqual(['bus-1']);
  });

  it('hides all when hideUnselected is true but selectedRouteIds is null', () => {
    const result = filterVisibleRouteShapes(shapes, new Set([0, 1, 3]), null, true);
    expect(result).toHaveLength(0);
  });

  it('returns empty when no route types are visible', () => {
    const result = filterVisibleRouteShapes(shapes, new Set(), null, false);
    expect(result).toEqual([]);
  });
});

describe('getRouteShapeStyle', () => {
  it('returns default style without outline when nothing is selected', () => {
    const result = getRouteShapeStyle(null, 'any-route', 3);
    expect(result.weight).toBe(4);
    expect(result.opacity).toBe(1.0);
    expect(result.outline).toBeNull();
  });

  it('returns highlighted style with prominent outline for a matching route', () => {
    const ids = new Set(['route-A', 'route-B']);
    const result = getRouteShapeStyle(ids, 'route-A', 3);
    expect(result.weight).toBe(6);
    expect(result.opacity).toBe(1.0);
    expect(result.outline).toEqual({ weight: 10, opacity: 1.0 });
  });

  it('returns dimmed style without outline for a non-matching route', () => {
    const ids = new Set(['route-A']);
    const result = getRouteShapeStyle(ids, 'route-X', 3);
    expect(result.weight).toBe(4);
    expect(result.opacity).toBe(0.15);
    expect(result.outline).toBeNull();
  });
});
