import { describe, it, expect } from 'vitest';
import { flattenDepartures } from '../flatten-departures';
import { makeRoute } from '../../../__tests__/helpers';
import type { DepartureGroup } from '../../../types/app/transit-composed';

function makeGroup(
  routeId: string,
  headsign: string,
  times: Date[],
  routeType: 0 | 1 | 2 | 3 = 3,
): DepartureGroup {
  return {
    route: makeRoute(routeId, routeType),
    headsign,
    headsign_names: {},
    departures: times,
  };
}

describe('flattenDepartures', () => {
  it('returns empty array for empty input', () => {
    expect(flattenDepartures([])).toEqual([]);
  });

  it('flattens a single group with one departure', () => {
    const time = new Date('2026-03-04T09:00:00');
    const groups = [makeGroup('r1', 'North', [time])];
    const result = flattenDepartures(groups);

    expect(result).toHaveLength(1);
    expect(result[0].route.route_id).toBe('r1');
    expect(result[0].headsign).toBe('North');
    expect(result[0].departure).toBe(time);
  });

  it('flattens multiple groups and sorts by departure time', () => {
    const t1 = new Date('2026-03-04T09:00:00');
    const t2 = new Date('2026-03-04T09:05:00');
    const t3 = new Date('2026-03-04T09:10:00');

    const groups = [makeGroup('r1', 'North', [t3, t1]), makeGroup('r2', 'South', [t2])];
    const result = flattenDepartures(groups);

    expect(result).toHaveLength(3);
    expect(result[0].departure).toBe(t1);
    expect(result[1].departure).toBe(t2);
    expect(result[2].departure).toBe(t3);
  });

  it('breaks ties by route_type (ascending)', () => {
    const time = new Date('2026-03-04T09:00:00');
    const groups = [makeGroup('bus1', 'A', [time], 3), makeGroup('tram1', 'B', [time], 0)];
    const result = flattenDepartures(groups);

    expect(result).toHaveLength(2);
    expect(result[0].route.route_type).toBe(0); // tram first
    expect(result[1].route.route_type).toBe(3); // bus second
  });

  it('breaks ties by route_id (ascending) when time and route_type match', () => {
    const time = new Date('2026-03-04T09:00:00');
    const groups = [makeGroup('r_z', 'A', [time], 3), makeGroup('r_a', 'B', [time], 3)];
    const result = flattenDepartures(groups);

    expect(result).toHaveLength(2);
    expect(result[0].route.route_id).toBe('r_a');
    expect(result[1].route.route_id).toBe('r_z');
  });

  it('shares references to route and departure objects (not copies)', () => {
    const time = new Date('2026-03-04T09:00:00');
    const groups = [makeGroup('r1', 'North', [time])];
    const result = flattenDepartures(groups);

    expect(result[0].route).toBe(groups[0].route);
    expect(result[0].departure).toBe(time);
  });

  it('handles group with no departures', () => {
    const groups = [makeGroup('r1', 'North', [])];
    expect(flattenDepartures(groups)).toEqual([]);
  });
});
