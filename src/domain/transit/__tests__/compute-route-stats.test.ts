import { describe, expect, it } from 'vitest';

import { makeRoute } from '../../../__tests__/helpers';
import type { AppRouteTypeValue, Route } from '../../../types/app/transit';
import { computeRouteStats } from '../compute-route-stats';

/** A route with an explicit agency_id (agencyCount derives from each route). */
function routeOf(id: string, routeType: AppRouteTypeValue, agencyId: string): Route {
  return { ...makeRoute(id, routeType), agency_id: agencyId };
}

describe('computeRouteStats', () => {
  it('returns all-zero stats for no routes', () => {
    expect(computeRouteStats([])).toEqual({ routeCount: 0, agencyCount: 0, routeTypeCount: 0 });
  });

  // Exercises all three dimensions at once with duplicates, asserted as a whole
  // so a metric leaking into the wrong field is caught.
  it('counts distinct routes / agencies / route types together, deduping', () => {
    const routes = [
      routeOf('r1', 3, 'a'),
      routeOf('r1', 3, 'a'), // exact duplicate
      routeOf('r2', 3, 'a'), // same agency + type, new route
      routeOf('r3', 2, 'b'), // new route, type, agency
      routeOf('r4', 11, 'a'), // new route + type, agency a again
    ];
    expect(computeRouteStats(routes)).toEqual({
      routeCount: 4, // r1, r2, r3, r4
      agencyCount: 2, // a, b
      routeTypeCount: 3, // 3, 2, 11
    });
  });

  it('keeps falsy-but-valid route types (0, -1)', () => {
    // The `!= null` guard must keep 0 (tram) and -1 (unknown); a truthy check
    // would wrongly drop them.
    const stats = computeRouteStats([routeOf('r0', 0, 'a'), routeOf('rm1', -1, 'a')]);
    expect(stats.routeTypeCount).toBe(2);
  });

  it('skips a missing route_type without counting it as a type', () => {
    const malformed: Route = {
      ...routeOf('r1', 3, 'a'),
      route_type: undefined as unknown as AppRouteTypeValue,
    };
    const stats = computeRouteStats([malformed, routeOf('r2', 3, 'a')]);
    expect(stats.routeCount).toBe(2); // both counted by id
    expect(stats.routeTypeCount).toBe(1); // only r2's type 3
  });

  it('counts distinct agencies by agency_id', () => {
    const routes = [routeOf('r1', 3, 'a'), routeOf('r2', 3, 'b'), routeOf('r3', 3, 'a')];
    expect(computeRouteStats(routes).agencyCount).toBe(2);
  });
});
