import { describe, expect, it } from 'vitest';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import type { StopWithMeta } from '../../../types/app/transit-composed';
import { makeRoute, makeStop } from '../../../__tests__/helpers';
import { buildStopRouteTypeMap } from '../stop-route-type-map';

function makeMeta(stopId: string, routeTypes: AppRouteTypeValue[]): StopWithMeta {
  // One Route per requested type, distinct route_ids so dedupe is observable.
  const routes = routeTypes.map((rt, i) => makeRoute(`${stopId}-r${i}`, rt));
  return { stop: makeStop(stopId), distance: 0, agencies: [], routes };
}

describe('buildStopRouteTypeMap', () => {
  it('returns an empty map for an empty input array', () => {
    expect(buildStopRouteTypeMap([])).toEqual(new Map());
  });

  it('maps a single stop with a single route', () => {
    const map = buildStopRouteTypeMap([makeMeta('s1', [3])]);
    expect(map.size).toBe(1);
    expect(map.get('s1')).toEqual([3]);
  });

  it('deduplicates and sorts ascending for a stop with multiple routes', () => {
    const map = buildStopRouteTypeMap([makeMeta('s1', [3, 1, 3, 2, 1])]);
    expect(map.get('s1')).toEqual([1, 2, 3]);
  });

  it('omits stops whose routes array is empty', () => {
    const empty: StopWithMeta = { stop: makeStop('s1'), distance: 0, agencies: [], routes: [] };
    const withRoute = makeMeta('s2', [3]);
    const map = buildStopRouteTypeMap([empty, withRoute]);
    expect(map.has('s1')).toBe(false);
    expect(map.get('s2')).toEqual([3]);
    expect(map.size).toBe(1);
  });

  it('lets the last occurrence win when stop_id appears more than once', () => {
    // Mirrors how `app.tsx` concatenates inBoundStops and radiusStops: a
    // stop_id present in both passes ends up with the second pass's
    // route_types in the resulting Map.
    const first = makeMeta('s1', [3]);
    const second = makeMeta('s1', [1, 2]);
    const map = buildStopRouteTypeMap([first, second]);
    expect(map.get('s1')).toEqual([1, 2]);
  });

  it('does not mutate the input stops or their routes arrays', () => {
    const routesA = [makeRoute('r0', 3), makeRoute('r1', 1)];
    const stop: StopWithMeta = {
      stop: makeStop('s1'),
      distance: 0,
      agencies: [],
      routes: routesA,
    };
    const input = [stop];
    const snapshotRouteIds = routesA.map((r) => r.route_id);
    const snapshotRouteTypes = routesA.map((r) => r.route_type);

    buildStopRouteTypeMap(input);

    expect(input).toHaveLength(1);
    expect(stop.routes).toBe(routesA);
    expect(routesA.map((r) => r.route_id)).toEqual(snapshotRouteIds);
    expect(routesA.map((r) => r.route_type)).toEqual(snapshotRouteTypes);
  });

  it('returns a freshly constructed Map each call', () => {
    const stops = [makeMeta('s1', [3])];
    const first = buildStopRouteTypeMap(stops);
    const second = buildStopRouteTypeMap(stops);
    expect(first).not.toBe(second);
    expect(first.get('s1')).toEqual(second.get('s1'));
  });
});
