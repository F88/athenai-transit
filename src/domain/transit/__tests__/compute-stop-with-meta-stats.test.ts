import { describe, expect, it } from 'vitest';

import { makeStop, makeStopWithContext } from '../../../__tests__/helpers';
import type { Agency, AppRouteTypeValue } from '../../../types/app/transit';
import type { StopWithContext } from '../../../types/app/transit-composed';
import { computeStopWithMetaStats } from '../compute-stop-with-meta-stats';

function makeAgency(id: string): Agency {
  return {
    agency_id: id,
    agency_name: `Agency ${id}`,
    agency_long_name: `Agency ${id}`,
    agency_short_name: '',
    agency_names: {},
    agency_long_names: {},
    agency_short_names: {},
    agency_url: '',
    agency_lang: 'ja',
    agency_timezone: 'Asia/Tokyo',
    agency_fare_url: '',
    agency_colors: [],
  };
}

function withAgencies(swc: StopWithContext, agencies: Agency[]): StopWithContext {
  return { ...swc, agencies };
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

  // A multi-stop set exercising every field at once, with cross-stop AND
  // intra-stop repeats of agencies / routes / route types, asserted as a whole
  // so a metric leaking into the wrong field is caught.
  it('aggregates all metrics together, deduping every entity dimension', () => {
    const agencyA = makeAgency('a');
    const agencyB = makeAgency('b');
    const agencyC = makeAgency('c');
    const stops: StopWithContext[] = [
      // routes r1,r2 both type 3; agencies a,b (a duplicated within the stop)
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1', 'r2'], [3]), [
        agencyA,
        agencyA,
        agencyB,
      ]),
      // routes r2 (repeat, type 3), r3 (type 2); agency b (repeat across stops)
      withAgencies(makeStopWithContext(makeStop('s2'), ['r2', 'r3'], [3, 2]), [agencyB]),
      // route r4 (type 11); agency c
      withAgencies(makeStopWithContext(makeStop('s3'), ['r4'], [11]), [agencyC]),
    ];

    expect(computeStopWithMetaStats(stops)).toEqual({
      stopCount: 3,
      agencyCount: 3, // a, b, c
      routeCount: 4, // r1, r2, r3, r4
      routeTypeCount: 3, // 3, 2, 11
    });
  });

  it('counts a service-less stop in stopCount but contributes no agencies/routes', () => {
    const agencyA = makeAgency('a');
    const stops: StopWithContext[] = [
      withAgencies(makeStopWithContext(makeStop('s1'), ['r1'], [3]), [agencyA]),
      makeStopWithContext(makeStop('empty'), []), // no routes/agencies, no service
    ];
    expect(computeStopWithMetaStats(stops)).toEqual({
      stopCount: 2,
      agencyCount: 1,
      routeCount: 1,
      routeTypeCount: 1,
    });
  });

  it('dedupes duplicate routes within a single stop', () => {
    const stats = computeStopWithMetaStats([
      makeStopWithContext(makeStop('s1'), ['r1', 'r1'], [3]),
    ]);
    expect(stats.routeCount).toBe(1);
    expect(stats.routeTypeCount).toBe(1);
  });

  it('counts falsy-but-valid route types (0, -1)', () => {
    // The `!= null` guard must keep 0 (tram) and -1 (unknown); a truthy check
    // would wrongly drop them.
    const stats = computeStopWithMetaStats([
      makeStopWithContext(makeStop('s1'), ['r0', 'rm1'], [0, -1]),
    ]);
    expect(stats.routeTypeCount).toBe(2);
  });

  it('skips a route with a missing route_type without counting it as a type', () => {
    const swc = makeStopWithContext(makeStop('s1'), ['r1'], [3]);
    // Malformed data: a route whose route_type is absent at runtime.
    const malformed: StopWithContext = {
      ...swc,
      routes: [{ ...swc.routes[0], route_type: undefined as unknown as AppRouteTypeValue }],
    };
    const stats = computeStopWithMetaStats([malformed]);
    expect(stats.routeCount).toBe(1); // route still counted by id
    expect(stats.routeTypeCount).toBe(0); // missing type not counted
  });

  it('counts stopCount by element, not by distinct stop_id', () => {
    // Two entries with the same stop_id still count as two stops: callers are
    // expected to pass one entry per stop, so stopCount is `stops.length`.
    const stops = [
      makeStopWithContext(makeStop('dup'), ['r1'], [3]),
      makeStopWithContext(makeStop('dup'), ['r2'], [2]),
    ];
    expect(computeStopWithMetaStats(stops).stopCount).toBe(2);
  });
});
