import { describe, expect, it } from 'vitest';
import {
  buildTimetableEntriesMap,
  extractRouteIdsForStop,
  filterVisibleRouteShapes,
  getRouteIdsForStop,
  getRouteShapeStyle,
  resolveSelectedRouteIds,
} from '../route-selection';
import type { RouteShape } from '../../../types/app/map';
import type { RouteType } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { makeRoute, makeStop, makeStopWithContext } from '../../../__tests__/helpers';

/** Shorthand: creates TimetableEntry[] from route ID strings. */
function makeEntries(routeIds: string[]): TimetableEntry[] {
  return routeIds.map((id) => ({
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: makeRoute(id),
      headsign: '',
      headsign_names: {},
    },
    boarding: { pickupType: 0 as const, dropOffType: 0 as const },
    patternPosition: { stopIndex: 0, totalStops: 1, isTerminal: false, isOrigin: false },
  }));
}

describe('extractRouteIdsForStop', () => {
  it('returns empty set when stop is not in departures', () => {
    expect(extractRouteIdsForStop([], 'unknown')).toEqual(new Set());
  });

  it('extracts route IDs from departures', () => {
    const ctx = makeStopWithContext(makeStop('s1'), ['r1', 'r2']);
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('falls back to StopWithMeta.routes when departures are empty (services ended)', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: [] as TimetableEntry[],
      isBoardableOnServiceDay: true,
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2')],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('returns empty set when both departures and routes are empty', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: [] as TimetableEntry[],
      isBoardableOnServiceDay: false,
      agencies: [],
      routes: [],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set());
  });

  it('prefers departures over routes when both are available', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: makeEntries(['r1']),
      isBoardableOnServiceDay: true,
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2'), makeRoute('r3')],
    };
    // Only r1 from departures, not r2/r3 from routes
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1']));
  });
});

describe('getRouteIdsForStop', () => {
  it('returns null when stopId is null', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(getRouteIdsForStop(null, map)).toBeNull();
  });

  it('returns null when stopId is not in map', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(getRouteIdsForStop('unknown-stop', map)).toBeNull();
  });

  it('returns null when entries are empty', () => {
    const map = new Map<string, TimetableEntry[]>([['stop-1', []]]);
    expect(getRouteIdsForStop('stop-1', map)).toBeNull();
  });

  it('returns a Set of route IDs for a stop with departures', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B', 'route-C'])],
    ]);
    const result = getRouteIdsForStop('stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B', 'route-C']));
  });
});

describe('buildTimetableEntriesMap', () => {
  it('returns an empty map for an empty array', () => {
    expect(buildTimetableEntriesMap([])).toEqual(new Map());
  });

  it('builds a map keyed by stop_id with entries as values', () => {
    const a = makeStopWithContext(makeStop('stop-a'), ['r1']);
    const b = makeStopWithContext(makeStop('stop-b'), ['r2']);
    const result = buildTimetableEntriesMap([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('stop-a')).toBe(a.departures);
    expect(result.get('stop-b')).toBe(b.departures);
  });

  it('last entry wins when duplicate stop IDs exist', () => {
    const first = makeStopWithContext(makeStop('dup'), ['r1']);
    const second = makeStopWithContext(makeStop('dup'), ['r2']);
    const result = buildTimetableEntriesMap([first, second]);
    expect(result.size).toBe(1);
    expect(result.get('dup')).toBe(second.departures);
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
    const map = new Map<string, TimetableEntry[]>();
    const result = resolveSelectedRouteIds('route-X', null, map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('prioritizes selectedRouteId over selectedStopId', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B'])],
    ]);
    const result = resolveSelectedRouteIds('route-X', 'stop-1', map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('delegates to getRouteIdsForStop when selectedRouteId is null', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B'])],
    ]);
    const result = resolveSelectedRouteIds(null, 'stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B']));
  });

  it('returns null when both selectedRouteId and selectedStopId are null', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(resolveSelectedRouteIds(null, null, map)).toBeNull();
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
