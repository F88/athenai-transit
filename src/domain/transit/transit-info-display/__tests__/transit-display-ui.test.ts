/**
 * Tests for transit-display-ui.ts -- UI presentation helpers
 * (row caps, sort ordering, empty-state resolution).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { makeRoute, makeStop } from '../../../../__tests__/helpers';
import type { InfoLevel } from '../../../../types/app/settings';
import type { AppRouteTypeValue, Route } from '../../../../types/app/transit';
import type { StopWithContext } from '../../../../types/app/transit-composed';
import {
  type TransitDisplayCategory,
  type TransitDisplayDataWithMetaData,
} from '../build-transit-display-data';
import {
  resolveTransitDisplayState,
  sortTransitDisplayDataWithMetaData,
  transitDisplayMaxEntriesFor,
  transitDisplayMaxEntriesPerRouteFor,
} from '../transit-display-ui';

describe('transitDisplayMaxEntriesFor', () => {
  it('returns the configured row cap for each info level', () => {
    expect(transitDisplayMaxEntriesFor('simple')).toBe(10);
    expect(transitDisplayMaxEntriesFor('normal')).toBe(10);
    expect(transitDisplayMaxEntriesFor('detailed')).toBe(20);
    expect(transitDisplayMaxEntriesFor('verbose')).toBe(20);
  });

  it('returns a positive cap for every info level', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      expect(transitDisplayMaxEntriesFor(level)).toBeGreaterThan(0);
    }
  });
});

describe('transitDisplayMaxEntriesPerRouteFor', () => {
  it('returns the configured per-route row cap for each info level', () => {
    expect(transitDisplayMaxEntriesPerRouteFor('simple')).toBe(3);
    expect(transitDisplayMaxEntriesPerRouteFor('normal')).toBe(5);
    expect(transitDisplayMaxEntriesPerRouteFor('detailed')).toBe(10);
    expect(transitDisplayMaxEntriesPerRouteFor('verbose')).toBe(10);
  });

  it('returns a positive cap for every info level', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      expect(transitDisplayMaxEntriesPerRouteFor(level)).toBeGreaterThan(0);
    }
  });
});

describe('sortTransitDisplayDataWithMetaData', () => {
  /** A display whose only meaningful fields for ordering are route type, route, category, direction. */
  function display(
    routeType: AppRouteTypeValue,
    category: TransitDisplayCategory,
    directions: readonly (0 | 1 | 'none')[] = ['none'],
    routes: readonly Route[] = [],
  ): TransitDisplayDataWithMetaData {
    return {
      meta: {
        category,
        routeTypes: [routeType],
        routes,
        directions,
        max: 10,
        radius: 100,
      },
      data: { routeTypes: [routeType], routes, directions, category, data: [] },
      stats: {
        stopsInRadius: { stopCount: 0, agencyCount: 0, routeCount: 0, routeTypeCount: 0 },
        qualifying: {
          entryCount: 0,
          stopCount: 0,
          agencyCount: 0,
          routeCount: 0,
          routeTypeCount: 0,
        },
      },
    };
  }

  it('orders by route type in ROUTE_TYPE_DISPLAY_ORDER (ferry not hoisted)', () => {
    // display order is [3, 11, 0, 2, 1, 12, 4, ...]: bus(3) < rail(2) < subway(1) < ferry(4)
    const bus = display(3, 'departures');
    const rail = display(2, 'departures');
    const subway = display(1, 'departures');
    const ferry = display(4, 'departures');

    const sorted = sortTransitDisplayDataWithMetaData([subway, ferry, rail, bus]);

    expect(sorted.map((d) => d.meta.routeTypes[0])).toEqual([3, 2, 1, 4]);
  });

  it('within a route type, departures come before arrivals', () => {
    const arr = display(2, 'arrivals');
    const dep = display(2, 'departures');

    expect(sortTransitDisplayDataWithMetaData([arr, dep]).map((d) => d.meta.category)).toEqual([
      'departures',
      'arrivals',
    ]);
  });

  it('within a category, orders by direction (none, 0, 1)', () => {
    const d1 = display(2, 'departures', [1]);
    const d0 = display(2, 'departures', [0]);
    const dn = display(2, 'departures', ['none']);

    expect(
      sortTransitDisplayDataWithMetaData([d1, d0, dn]).map((d) => d.meta.directions[0]),
    ).toEqual(['none', 0, 1]);
  });

  it('applies the three levels together: route type -> direction -> category', () => {
    const railArr0 = display(2, 'arrivals', [0]);
    const busDep = display(3, 'departures', ['none']);
    const railDep1 = display(2, 'departures', [1]);
    const railDep0 = display(2, 'departures', [0]);
    const busArr = display(3, 'arrivals', ['none']);

    const sorted = sortTransitDisplayDataWithMetaData([
      railArr0,
      busDep,
      railDep1,
      railDep0,
      busArr,
    ]);

    // routeType 3 (bus) before 2 (rail) per ROUTE_TYPE_DISPLAY_ORDER; within
    // a route type, direction (none -> 0 -> 1) groups dep / arr pairs together,
    // then category (dep -> arr) decides inside one direction.
    expect(
      sorted.map((d) => ({
        rt: d.meta.routeTypes[0],
        category: d.meta.category,
        dir: d.meta.directions[0],
      })),
    ).toEqual([
      { rt: 3, category: 'departures', dir: 'none' },
      { rt: 3, category: 'arrivals', dir: 'none' },
      { rt: 2, category: 'departures', dir: 0 },
      { rt: 2, category: 'arrivals', dir: 0 },
      { rt: 2, category: 'departures', dir: 1 },
    ]);
  });

  // route_id alphabetical sort: within the same route type, boards are ordered
  // by `meta.routes[0].route_id`. In v2 sources the id is agency-prefixed
  // (e.g. `eidan:ginza`), so agency clustering falls out naturally. Independent
  // of builder input order -- ordering is fully derivable from meta.
  it('within a route type, orders by routes[0].route_id alphabetical', () => {
    const ginza = makeRoute('eidan:ginza', 1);
    const hanzomon = makeRoute('eidan:hanzomon', 1);
    const fukutoshin = makeRoute('eidan:fukutoshin', 1);

    // Pass in an order different from the alphabetical one to prove the sort
    // is driven by the key, not by input order.
    const sorted = sortTransitDisplayDataWithMetaData([
      display(1, 'departures', ['none'], [ginza]),
      display(1, 'departures', ['none'], [hanzomon]),
      display(1, 'departures', ['none'], [fukutoshin]),
    ]);

    expect(sorted.map((d) => d.meta.routes[0]?.route_id)).toEqual([
      'eidan:fukutoshin',
      'eidan:ginza',
      'eidan:hanzomon',
    ]);
  });

  it('applies all four levels: route type -> route -> direction -> category', () => {
    const ginza = makeRoute('eidan:ginza', 1);
    const hanzomon = makeRoute('eidan:hanzomon', 1);

    // Two single-route boards (one per route) for each (direction, category)
    // combination. Sort groups by route first, then by direction with dep / arr
    // paired inside each direction.
    const sorted = sortTransitDisplayDataWithMetaData([
      display(1, 'arrivals', [1], [hanzomon]),
      display(1, 'departures', [0], [hanzomon]),
      display(1, 'arrivals', [0], [ginza]),
      display(1, 'departures', [1], [ginza]),
      display(1, 'departures', [0], [ginza]),
      display(1, 'departures', [1], [hanzomon]),
      display(1, 'arrivals', [0], [hanzomon]),
      display(1, 'arrivals', [1], [ginza]),
    ]);

    expect(
      sorted.map((d) => ({
        routeId: d.meta.routes[0]?.route_id,
        category: d.meta.category,
        dir: d.meta.directions[0],
      })),
    ).toEqual([
      { routeId: 'eidan:ginza', category: 'departures', dir: 0 },
      { routeId: 'eidan:ginza', category: 'arrivals', dir: 0 },
      { routeId: 'eidan:ginza', category: 'departures', dir: 1 },
      { routeId: 'eidan:ginza', category: 'arrivals', dir: 1 },
      { routeId: 'eidan:hanzomon', category: 'departures', dir: 0 },
      { routeId: 'eidan:hanzomon', category: 'arrivals', dir: 0 },
      { routeId: 'eidan:hanzomon', category: 'departures', dir: 1 },
      { routeId: 'eidan:hanzomon', category: 'arrivals', dir: 1 },
    ]);
  });

  // Multi-route boards (routes.length > 1) have `meta.routes` derived from
  // filtered boardCandidates, so the cluster's dep board and arr board can
  // land on different routes[0]. Sort skips the route axis for those, letting
  // direction / category decide -- so dep stays before arr.
  it('skips route axis for boards with multiple routes (multi-route bus cluster keeps dep before arr)', () => {
    const route76 = makeRoute('iyotetsu:76', 3);
    const routeExpress = makeRoute('iyotetsu:express', 3);
    // dep board only sees route76 first; arr board only sees express first
    // (the opposite picks would otherwise win on alphabetical route_id).
    const dep = display(3, 'departures', ['none'], [route76, routeExpress]);
    const arr = display(3, 'arrivals', ['none'], [routeExpress, route76]);

    // Even if `routes[0]` differs between dep and arr (express < 76 in route_id
    // alphabetical), the multi-route detection skips the route axis so
    // category decides: dep before arr.
    expect(sortTransitDisplayDataWithMetaData([arr, dep]).map((d) => d.meta.category)).toEqual([
      'departures',
      'arrivals',
    ]);
  });

  // Direction axis is skipped independently (per-axis), with the same reasoning
  // as the route axis. Real-world trigger: a bus cluster where one route has
  // no direction_id (e.g. long-distance express) only appears as an arrival --
  // arr board's directions[0] = 'none', dep board's directions[0] = 0. Without
  // skipping, direction would mis-order arr before dep.
  it('skips direction axis for boards with multiple directions (multi-direction bus cluster keeps dep before arr)', () => {
    const route76 = makeRoute('iyotetsu:76', 3);
    const routeExpress = makeRoute('iyotetsu:express', 3);
    // Multi-route AND multi-direction. dep has directions [0, 1], arr has
    // ['none', 0, 1] (because the express route only appears in arrivals and
    // has no direction_id). DIRECTIONS index of 'none' (0) < 0 (1), so
    // without the direction-axis skip, arr would sort before dep.
    const dep = display(3, 'departures', [0, 1], [route76, routeExpress]);
    const arr = display(3, 'arrivals', ['none', 0, 1], [route76, routeExpress]);

    expect(sortTransitDisplayDataWithMetaData([arr, dep]).map((d) => d.meta.category)).toEqual([
      'departures',
      'arrivals',
    ]);
  });

  // Multi-route boards skip the direction axis as well (skipDirectionAxis is
  // OR-ed with skipRouteAxis). Reason: even a "single-direction multi-route"
  // board can have a direction value that differs between dep and arr inside
  // the cluster (the offending case is multi-route + single-direction with
  // a per-category direction shift). Trusting direction here would mis-order
  // arrivals before departures, so we skip it whenever the route axis is.
  // Same-category multi-route boards that share routeType keep their input
  // order via stable sort.
  it('skips direction axis when multi-route (single-direction multi-route boards keep input order via stable sort)', () => {
    const route76 = makeRoute('iyotetsu:76', 3);
    const routeA = makeRoute('iyotetsu:a', 3);
    const dep0 = display(3, 'departures', [0], [route76, routeA]);
    const dep1 = display(3, 'departures', [1], [route76, routeA]);

    // Direction is no longer a sort key for multi-route boards, so the two
    // are equal under (routeType, category) and stable sort preserves input
    // order regardless of direction values.
    expect(sortTransitDisplayDataWithMetaData([dep1, dep0])).toEqual([dep1, dep0]);
    expect(sortTransitDisplayDataWithMetaData([dep0, dep1])).toEqual([dep0, dep1]);
  });

  // The minkuru:0636-06 (Tokyo bus stop) regression: multi-route + single-
  // direction where dep's directions[0] differs from arr's directions[0]
  // (because the present-direction set diverges across categories). Without
  // OR-ing skipDirectionAxis with skipRouteAxis, this case would mis-order
  // arrivals before departures.
  it('skips direction axis for multi-route single-direction with category-shifted directions[0] (minkuru regression)', () => {
    const routeT01 = makeRoute('toei:t01', 3);
    const routeMt87 = makeRoute('toei:t87', 3);
    // dep has directions [1] only, arr has ['none'] only -- both length 1
    // but different values. DIRECTIONS.indexOf('none') = 0 < indexOf(1) = 2,
    // so without the OR skip, arr would sort before dep.
    const dep = display(3, 'departures', [1], [routeT01, routeMt87]);
    const arr = display(3, 'arrivals', ['none'], [routeT01, routeMt87]);

    expect(sortTransitDisplayDataWithMetaData([arr, dep]).map((d) => d.meta.category)).toEqual([
      'departures',
      'arrivals',
    ]);
  });

  it('falls back to no route comparison when meta.routes is empty (boards with same routeType/category/direction keep stable order)', () => {
    // Empty routes -> routeId compares as '' for all, so route axis is a no-op.
    // Stable sort preserves the input order within the same key.
    const a = display(2, 'departures', [0]);
    const b = display(2, 'departures', [0]);
    const c = display(2, 'departures', [0]);
    const sorted = sortTransitDisplayDataWithMetaData([a, b, c]);
    expect(sorted).toEqual([a, b, c]);
  });

  it('does not mutate the input array', () => {
    const a = display(2, 'departures');
    const b = display(3, 'departures');
    const input = [a, b];

    sortTransitDisplayDataWithMetaData(input);

    expect(input).toEqual([a, b]);
  });

  it('returns an empty array for empty input', () => {
    expect(sortTransitDisplayDataWithMetaData([])).toEqual([]);
  });
});

describe('resolveTransitDisplayState', () => {
  function stop(
    stopServiceState: StopWithContext['stopServiceState'] = 'boardable',
  ): StopWithContext {
    return {
      stop: makeStop('s'),
      agencies: [],
      routes: [],
      routeTypes: [],
      stopTimes: [],
      stopServiceState,
    };
  }

  it("returns 'no-stops' for an empty stop set", () => {
    expect(resolveTransitDisplayState([])).toBe('no-stops');
  });

  it("returns 'no-service' when every stop is out of service today", () => {
    expect(resolveTransitDisplayState([stop('no-service'), stop('no-service')])).toBe('no-service');
  });

  it("returns 'ready' when at least one stop has service", () => {
    expect(resolveTransitDisplayState([stop('no-service'), stop('boardable')])).toBe('ready');
    expect(resolveTransitDisplayState([stop('boardable')])).toBe('ready');
  });
});
