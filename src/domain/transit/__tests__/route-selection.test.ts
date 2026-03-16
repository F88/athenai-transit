import { describe, expect, it } from 'vitest';
import {
  buildDepartureGroupsMap,
  extractRouteIdsForStop,
  filterVisibleRouteShapes,
  getRouteIdsForStop,
  getRouteShapeStyle,
  resolveSelectedRouteIds,
} from '../route-selection';
import type { RouteShape } from '../../../types/app/map';
import type { DepartureGroup, RouteType } from '../../../types/app/transit';
import { makeRoute, makeStop, makeStopWithContext } from '../../../__tests__/helpers';

describe('extractRouteIdsForStop', () => {
  it('returns empty set when stop is not in departures', () => {
    expect(extractRouteIdsForStop([], 'unknown')).toEqual(new Set());
  });

  it('extracts route IDs from departure groups', () => {
    const ctx = makeStopWithContext(makeStop('s1'), ['r1', 'r2']);
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('falls back to StopWithMeta.routes when groups are empty (services ended)', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      groups: [],
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2')],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('returns empty set when both groups and routes are empty', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      groups: [],
      agencies: [],
      routes: [],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set());
  });

  it('prefers groups over routes when both are available', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      groups: [
        {
          route: makeRoute('r1'),
          headsign: 'Test',
          headsign_names: {},
          departures: [new Date()],
        },
      ],
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2'), makeRoute('r3')],
    };
    // Only r1 from groups, not r2/r3 from routes
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1']));
  });
});

/** Shorthand: creates DepartureGroup[] from route ID strings. */
function makeGroups(routeIds: string[]): DepartureGroup[] {
  return routeIds.map((id) => ({
    route: {
      route_id: id,
      route_short_name: id,
      route_long_name: '',
      route_names: {},
      route_type: 3,
      route_color: '',
      route_text_color: '',
      agency_id: '',
    },
    headsign: '',
    headsign_names: {},
    departures: [new Date()],
  }));
}

describe('getRouteIdsForStop', () => {
  it('returns null when stopId is null', () => {
    const map = new Map<string, DepartureGroup[]>();
    expect(getRouteIdsForStop(null, map)).toBeNull();
  });

  it('returns null when stopId is not in departuresMap', () => {
    const map = new Map<string, DepartureGroup[]>();
    expect(getRouteIdsForStop('unknown-stop', map)).toBeNull();
  });

  it('returns null when groups is empty', () => {
    const map = new Map<string, DepartureGroup[]>([['stop-1', []]]);
    expect(getRouteIdsForStop('stop-1', map)).toBeNull();
  });

  it('returns a Set of route IDs for a stop with departures', () => {
    const map = new Map<string, DepartureGroup[]>([
      ['stop-1', makeGroups(['route-A', 'route-B', 'route-C'])],
    ]);
    const result = getRouteIdsForStop('stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B', 'route-C']));
  });
});

describe('buildDepartureGroupsMap', () => {
  it('returns an empty map for an empty array', () => {
    expect(buildDepartureGroupsMap([])).toEqual(new Map());
  });

  it('builds a map keyed by stop_id with groups as values', () => {
    const a = makeStopWithContext(makeStop('stop-a'), ['r1']);
    const b = makeStopWithContext(makeStop('stop-b'), ['r2']);
    const result = buildDepartureGroupsMap([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('stop-a')).toBe(a.groups);
    expect(result.get('stop-b')).toBe(b.groups);
  });

  it('last entry wins when duplicate stop IDs exist', () => {
    const first = makeStopWithContext(makeStop('dup'), ['r1']);
    const second = makeStopWithContext(makeStop('dup'), ['r2']);
    const result = buildDepartureGroupsMap([first, second]);
    expect(result.size).toBe(1);
    expect(result.get('dup')).toBe(second.groups);
  });
});

/** Helper to build a minimal RouteShape for testing. */
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

describe('resolveSelectedRouteIds', () => {
  it('returns a Set with the route ID when selectedRouteId is provided', () => {
    const map = new Map<string, DepartureGroup[]>();
    const result = resolveSelectedRouteIds('route-X', null, map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('prioritizes selectedRouteId over selectedStopId', () => {
    const map = new Map<string, DepartureGroup[]>([['stop-1', makeGroups(['route-A', 'route-B'])]]);
    const result = resolveSelectedRouteIds('route-X', 'stop-1', map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('delegates to getRouteIdsForStop when selectedRouteId is null', () => {
    const map = new Map<string, DepartureGroup[]>([['stop-1', makeGroups(['route-A', 'route-B'])]]);
    const result = resolveSelectedRouteIds(null, 'stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B']));
  });

  it('returns null when both selectedRouteId and selectedStopId are null', () => {
    const map = new Map<string, DepartureGroup[]>();
    expect(resolveSelectedRouteIds(null, null, map)).toBeNull();
  });
});

describe('getRouteShapeStyle', () => {
  it('returns default style without outline when nothing is selected', () => {
    const result = getRouteShapeStyle(null, 'any-route');
    expect(result.weight).toBe(4);
    expect(result.opacity).toBe(1.0);
    expect(result.outline).toBeNull();
  });

  it('returns highlighted style with prominent outline for a matching route', () => {
    const ids = new Set(['route-A', 'route-B']);
    const result = getRouteShapeStyle(ids, 'route-A');
    expect(result.weight).toBe(6);
    expect(result.opacity).toBe(1.0);
    expect(result.outline).toEqual({ weight: 10, opacity: 1.6 });
  });

  it('returns dimmed style without outline for a non-matching route', () => {
    const ids = new Set(['route-A']);
    const result = getRouteShapeStyle(ids, 'route-X');
    expect(result.weight).toBe(4);
    expect(result.opacity).toBe(0.15);
    expect(result.outline).toBeNull();
  });
});
