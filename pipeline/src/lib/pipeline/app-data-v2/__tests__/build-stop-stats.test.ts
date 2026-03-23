/**
 * Tests for build-stop-stats.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  RouteV2Json,
  ServiceGroupEntry,
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../../src/types/data/transit-v2-json';
import { buildStopStats } from '../build-stop-stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(id: string, routeType: number): RouteV2Json {
  return { v: 2, i: id, s: '', l: '', t: routeType, c: '000000', tc: 'FFFFFF', ai: 'a1' };
}

function makeTimetableGroup(
  patternId: string,
  deps: Record<string, number[]>,
): TimetableGroupV2Json {
  return { v: 2, tp: patternId, d: deps, a: deps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildStopStats', () => {
  it('computes basic stats (freq, rc, rtc, ed, ld)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)]; // bus

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [360, 480, 600, 720] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1']).toEqual({
      freq: 4,
      rc: 1,
      rtc: 1,
      ed: 360,
      ld: 720,
    });
  });

  it('aggregates across multiple patterns at the same stop', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
      p2: { v: 2, r: 'r2', h: 'B', stops: ['s1', 's3'] },
    };

    const routes = [makeRoute('r1', 3), makeRoute('r2', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', { svc1: [480, 540] }),
        makeTimetableGroup('p2', { svc1: [500, 560, 620] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(5); // 2 + 3
    expect(result['wd']['s1'].rc).toBe(2); // r1, r2
    expect(result['wd']['s1'].rtc).toBe(1); // both route_type 3
    expect(result['wd']['s1'].ed).toBe(480);
    expect(result['wd']['s1'].ld).toBe(620);
  });

  it('counts distinct route types', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
      p2: { v: 2, r: 'r2', h: 'B', stops: ['s1', 's3'] },
    };

    const routes = [
      makeRoute('r1', 3), // bus
      makeRoute('r2', 1), // subway
    ];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480] }), makeTimetableGroup('p2', { svc1: [500] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].rtc).toBe(2); // bus + subway
  });

  it('handles overnight departures (ld >= 1440)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [360, 1500] })], // 6:00 and 25:00
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].ed).toBe(360);
    expect(result['wd']['s1'].ld).toBe(1500);
  });

  it('separates stats by service group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc_wd: [480, 540, 600], svc_sa: [480, 600] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['sa']['s1'].freq).toBe(2);
  });

  it('excludes stops with no departures in a service group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    // s1 only has weekday departures
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc_wd: [480] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1']).toBeDefined();
    expect(result['sa']['s1']).toBeUndefined();
  });

  it('handles empty timetable', () => {
    const patterns: Record<string, TripPatternJson> = {};
    const routes: RouteV2Json[] = [];
    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats({}, patterns, routes, groups);

    expect(result['wd']).toEqual({});
  });

  it('skips timetable groups whose pattern ID is not in patterns map', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', { svc1: [480] }),
        makeTimetableGroup('p_unknown', { svc1: [500] }), // pattern not in map
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    // Only p1's departure is counted, p_unknown is skipped
    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
  });

  it('counts rc=1 when multiple patterns share the same route', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
      p2: { v: 2, r: 'r1', h: 'B', stops: ['s1', 's3'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480] }), makeTimetableGroup('p2', { svc1: [500] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(2);
    expect(result['wd']['s1'].rc).toBe(1); // same route
    expect(result['wd']['s1'].rtc).toBe(1);
  });

  it('handles route not found in routes array (rtc excludes unknown routes)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r_unknown', h: 'A', stops: ['s1', 's2'] },
    };

    const routes: RouteV2Json[] = []; // route not in array

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
    expect(result['wd']['s1'].rtc).toBe(0); // route type unknown
  });

  it('returns empty result when service groups is empty', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };
    const routes = [makeRoute('r1', 3)];
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480] })],
    };

    const result = buildStopStats(timetable, patterns, routes, []);

    expect(result).toEqual({});
  });

  it('counts 2x departures at circular route origin/terminal stop', () => {
    // Circular: s1 → s2 → s3 → s1
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2', 's3', 's1'] },
    };

    const routes = [makeRoute('r1', 3)];

    // s1 has 2x departures (origin + terminal), interior stops have 3
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480, 500, 540, 560, 600, 620] })],
      s2: [makeTimetableGroup('p1', { svc1: [490, 550, 610] })],
      s3: [makeTimetableGroup('p1', { svc1: [495, 555, 615] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    // Origin/terminal stop has 2x departures — this is correct for stopStats
    // because the bus physically passes through this stop twice per trip
    expect(result['wd']['s1'].freq).toBe(6);
    expect(result['wd']['s2'].freq).toBe(3);
    expect(result['wd']['s3'].freq).toBe(3);
  });

  it('does not count departures from timetable groups with no matching service IDs', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    // Timetable has departures only for svc_wd, not svc_sa
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc_wd: [480, 540, 600] })],
      s2: [makeTimetableGroup('p1', { svc_wd: [490, 550, 610] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['wd']['s1'].rc).toBe(1);
    // s1 has no Saturday departures → not in sa group
    expect(result['sa']['s1']).toBeUndefined();
    expect(result['sa']['s2']).toBeUndefined();
  });

  it('sums freq across multiple service IDs in same group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480, 540], svc2: [600] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1', 'svc2'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['wd']['s1'].ed).toBe(480);
    expect(result['wd']['s1'].ld).toBe(600);
  });

  it('sets ed === ld when only one departure exists', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [720] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].ed).toBe(720);
    expect(result['wd']['s1'].ld).toBe(720);
  });

  it('computes ed/ld across multiple timetable groups (min of eds, max of lds)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: ['s1', 's2'] },
      p2: { v: 2, r: 'r2', h: 'B', stops: ['s1', 's3'] },
    };

    const routes = [makeRoute('r1', 3), makeRoute('r2', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', { svc1: [600, 720] }), // ed=600, ld=720
        makeTimetableGroup('p2', { svc1: [360, 1440] }), // ed=360, ld=1440
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    expect(result['wd']['s1'].freq).toBe(4);
    expect(result['wd']['s1'].ed).toBe(360); // min across groups
    expect(result['wd']['s1'].ld).toBe(1440); // max across groups
  });

  it('handles empty serviceIds in group (no departures counted)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1', 's2'] },
    };
    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', { svc1: [480] })],
      s2: [makeTimetableGroup('p1', { svc1: [490] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'empty', serviceIds: [] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    // No service IDs → no departures → all stops excluded
    expect(Object.keys(result['empty'])).toHaveLength(0);
  });

  it('skips multiple timetable groups with unknown pattern IDs', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: ['s1'] },
    };
    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p_unknown1', { svc1: [480] }),
        makeTimetableGroup('p_unknown2', { svc1: [540] }),
        makeTimetableGroup('p1', { svc1: [600] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups);

    // Only p1 counted, unknown patterns skipped
    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
    expect(result['wd']['s1'].ed).toBe(600);
    expect(result['wd']['s1'].ld).toBe(600);
  });
});
