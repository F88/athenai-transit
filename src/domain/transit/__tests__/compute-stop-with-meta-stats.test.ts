import { describe, expect, it } from 'vitest';

import { makeRoute, makeStop } from '../../../__tests__/helpers';
import type { AppRouteTypeValue, Route } from '../../../types/app/transit';
import type { StopWithMeta } from '../../../types/app/transit-composed';
import { computeStopWithMetaStats } from '../compute-stop-with-meta-stats';

/** A route with an explicit agency_id (agencyCount derives from each route). */
function routeOf(id: string, routeType: AppRouteTypeValue, agencyId: string): Route {
  return { ...makeRoute(id, routeType), agency_id: agencyId };
}

/** A minimal StopWithMeta carrying the given routes (the only field summarized). */
function stopWith(routes: Route[]): StopWithMeta {
  return { stop: makeStop('s'), agencies: [], routes };
}

describe('computeStopWithMetaStats', () => {
  it('returns all-zero stats for an empty stop set', () => {
    expect(computeStopWithMetaStats([])).toEqual({
      stopCount: 0,
      agencyCount: 0,
      routeCount: 0,
      routeTypeCount: 0,
    });
  });

  // Multi-stop set exercising every field at once, with cross-stop AND intra-stop
  // repeats of routes / agencies / route types, asserted as a whole so a metric
  // leaking into the wrong field is caught.
  it('aggregates all metrics together, deduping every entity dimension', () => {
    const stops: StopWithMeta[] = [
      // r1 (listed twice in this stop), r2 -- both type 3, agency a
      stopWith([routeOf('r1', 3, 'a'), routeOf('r1', 3, 'a'), routeOf('r2', 3, 'a')]),
      // r2 (repeat across stops), r3 type 2 agency b
      stopWith([routeOf('r2', 3, 'a'), routeOf('r3', 2, 'b')]),
      // r4 type 11 agency c
      stopWith([routeOf('r4', 11, 'c')]),
    ];

    expect(computeStopWithMetaStats(stops)).toEqual({
      stopCount: 3,
      agencyCount: 3, // a, b, c
      routeCount: 4, // r1, r2, r3, r4
      routeTypeCount: 3, // 3, 2, 11
    });
  });

  it('counts a route-less stop in stopCount but not in route/agency counts', () => {
    const stops: StopWithMeta[] = [
      stopWith([routeOf('r1', 3, 'a')]),
      stopWith([]), // no routes
    ];
    expect(computeStopWithMetaStats(stops)).toEqual({
      stopCount: 2,
      agencyCount: 1,
      routeCount: 1,
      routeTypeCount: 1,
    });
  });

  it('counts falsy-but-valid route types (0, -1)', () => {
    // The `!= null` guard must keep 0 (tram) and -1 (unknown).
    const stats = computeStopWithMetaStats([
      stopWith([routeOf('r0', 0, 'a'), routeOf('rm1', -1, 'a')]),
    ]);
    expect(stats.routeTypeCount).toBe(2);
  });

  it('skips a route with a missing route_type without counting it as a type', () => {
    const malformed: Route = {
      ...routeOf('r1', 3, 'a'),
      route_type: undefined as unknown as AppRouteTypeValue,
    };
    const stats = computeStopWithMetaStats([stopWith([malformed])]);
    expect(stats.routeCount).toBe(1); // still counted by id
    expect(stats.routeTypeCount).toBe(0); // missing type not counted
  });

  it('counts stopCount by element, not by distinct stop_id', () => {
    // Both stops share a stop_id; stopCount is stops.length, so they count as two.
    const stops = [stopWith([routeOf('r1', 3, 'a')]), stopWith([routeOf('r2', 2, 'a')])];
    expect(computeStopWithMetaStats(stops).stopCount).toBe(2);
  });
});
