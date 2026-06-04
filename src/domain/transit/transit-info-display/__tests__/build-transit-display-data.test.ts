/**
 * Tests for build-transit-display-data.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  agencyTobus,
  baseStop,
  busRoute,
  createEntry,
  railRoute,
  subwayRoute,
} from '../../../../stories/fixtures';
import type { InfoLevel } from '../../../../types/app/settings';
import type { Route } from '../../../../types/app/transit';
import type { StopWithContext } from '../../../../types/app/transit-composed';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../../route-type-display-order';
import {
  clusterCandidatesByRouteType,
  transitDisplayMaxEntriesFor,
  type TransitDisplayCandidate,
} from '../build-transit-display-data';

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

/** Minimal stop context; clustering only reads each candidate's route_type, not the stop. */
const STUB_STOP: StopWithContext = {
  stop: baseStop,
  agencies: [agencyTobus],
  routes: [busRoute],
  routeTypes: [3],
  stopTimes: [],
  stopServiceState: 'boardable',
};

/** A candidate for a trip on the given route (route.route_type drives clustering). */
function candidateOf(route: Route): TransitDisplayCandidate {
  return { entry: createEntry({ route }), stopWithContext: STUB_STOP };
}

describe('clusterCandidatesByRouteType', () => {
  it("'route': one cluster per route type in display order, candidates placed by type", () => {
    const subway = candidateOf(subwayRoute); // route_type 1
    const bus = candidateOf(busRoute); // route_type 3

    const clusters = clusterCandidatesByRouteType([subway, bus], { kind: 'route' });

    // One cluster per ROUTE_TYPE_DISPLAY_ORDER entry, each a single-type cluster.
    expect(clusters.map((c) => c.routeTypes)).toEqual(ROUTE_TYPE_DISPLAY_ORDER.map((t) => [t]));
    expect(clusters.find((c) => c.routeTypes[0] === busRoute.route_type)?.candidates).toEqual([
      bus,
    ]);
    expect(clusters.find((c) => c.routeTypes[0] === subwayRoute.route_type)?.candidates).toEqual([
      subway,
    ]);
  });

  it("'none': a single cluster of all candidates; routeTypes are present types in display order", () => {
    const subway = candidateOf(subwayRoute); // 1
    const bus = candidateOf(busRoute); // 3

    const clusters = clusterCandidatesByRouteType([subway, bus], { kind: 'none' });

    expect(clusters).toHaveLength(1);
    // 3 precedes 1 in ROUTE_TYPE_DISPLAY_ORDER.
    expect(clusters[0].routeTypes).toEqual([3, 1]);
    expect(clusters[0].candidates).toEqual([subway, bus]);
  });

  it("'custom': one cluster per group, keeping each group's own order (not display order)", () => {
    const subway = candidateOf(subwayRoute); // 1
    const rail = candidateOf(railRoute); // 2
    const bus = candidateOf(busRoute); // 3

    const clusters = clusterCandidatesByRouteType([subway, rail, bus], {
      kind: 'custom',
      groups: [[1], [1, 2], [3, 1]],
    });

    expect(clusters).toHaveLength(3);
    // [1, 2] stays [1, 2] (group order), not the display order [2, 1].
    expect(clusters.map((c) => c.routeTypes)).toEqual([[1], [1, 2], [3, 1]]);
  });

  it("'custom': overlapping groups put a route type on every matching board", () => {
    const subway = candidateOf(subwayRoute); // 1
    const rail = candidateOf(railRoute); // 2

    const clusters = clusterCandidatesByRouteType([subway, rail], {
      kind: 'custom',
      groups: [[1], [1, 2]],
    });

    // subway (1) appears in both clusters; candidates keep the input order.
    expect(clusters[0].candidates).toEqual([subway]);
    expect(clusters[1].candidates).toEqual([subway, rail]);
  });

  it("'custom': drops route types absent from the candidates", () => {
    const subway = candidateOf(subwayRoute); // 1; route_type 2 is absent

    const clusters = clusterCandidatesByRouteType([subway], { kind: 'custom', groups: [[2, 1]] });

    expect(clusters[0].routeTypes).toEqual([1]); // 2 dropped (not present)
    expect(clusters[0].candidates).toEqual([subway]);
  });
});
