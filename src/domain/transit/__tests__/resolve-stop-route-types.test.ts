import { describe, expect, it } from 'vitest';
import type { AppRouteTypeValue, Route } from '../../../types/app/transit';
import { resolveStopRouteTypes } from '../resolve-stop-route-types';

function makeRoute(routeType: AppRouteTypeValue): Pick<Route, 'route_type'> {
  return { route_type: routeType };
}

describe('resolveStopRouteTypes', () => {
  it('returns route types from routeTypeMap when present', () => {
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['s1', [3, 1]]]);

    const result = resolveStopRouteTypes({
      stopId: 's1',
      routeTypeMap,
      routes: [makeRoute(2)],
      unknownPolicy: 'include-unknown',
    });

    expect(result).toEqual([3, 1]);
  });

  it('falls back to routes when routeTypeMap has no value', () => {
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>();

    const result = resolveStopRouteTypes({
      stopId: 's1',
      routeTypeMap,
      routes: [makeRoute(2), makeRoute(3), makeRoute(2)],
      unknownPolicy: 'include-unknown',
    });

    expect(result).toEqual([2, 3]);
  });

  it('uses routes when routeTypeMap entry is empty', () => {
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['s1', []]]);

    const result = resolveStopRouteTypes({
      stopId: 's1',
      routeTypeMap,
      routes: [makeRoute(11), makeRoute(0)],
      unknownPolicy: 'include-unknown',
    });

    expect(result).toEqual([0, 11]);
  });

  it('returns [-1] for include-unknown when unresolved', () => {
    const result = resolveStopRouteTypes({
      stopId: 's1',
      routeTypeMap: new Map(),
      routes: null,
      unknownPolicy: 'include-unknown',
    });

    expect(result).toEqual([-1]);
  });

  it('returns [] for exclude-unknown when unresolved', () => {
    const result = resolveStopRouteTypes({
      stopId: 's1',
      routeTypeMap: new Map(),
      routes: null,
      unknownPolicy: 'exclude-unknown',
    });

    expect(result).toEqual([]);
  });
});
