/**
 * Tests for build-stop-stats.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { CalendarJson } from '@contracts/data/transit-json';
import type {
  RouteV2Json,
  ServiceGroupEntry,
  TimetableGroupV2Json,
  TripPatternJson,
} from '@contracts/data/transit-v2-json';
import { buildStopStats } from '../build-stop-stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(id: string, routeType: number): RouteV2Json {
  return { v: 2, i: id, s: '', l: '', t: routeType, c: '000000', tc: 'FFFFFF', ai: 'a1' };
}

function makeTimetableGroup(
  patternId: string,
  si: number,
  deps: Record<string, number[]>,
): TimetableGroupV2Json {
  return { v: 2, tp: patternId, si, d: deps, a: deps };
}

/**
 * Build a calendar where every service in `groups` is active on a single
 * shared day. Existing freq expectations (sums across in-group services)
 * remain valid because every grouped service co-occurs on that day.
 */
function calendarFromGroups(groups: ServiceGroupEntry[]): CalendarJson {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group.serviceIds) {
      ids.add(id);
    }
  }
  return {
    services: [...ids].map((i) => ({
      i,
      s: '20260501',
      e: '20260501',
      d: [1, 1, 1, 1, 1, 1, 1],
    })),
    exceptions: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildStopStats', () => {
  it('computes basic stats (freq, rc, rtc, ed, ld)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)]; // bus

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [360, 480, 600, 720] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

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
      p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
      p2: { v: 2, r: 'r2', h: 'B', stops: [{ id: 's1' }, { id: 's3' }] },
    };

    const routes = [makeRoute('r1', 3), makeRoute('r2', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', 0, { svc1: [480, 540] }),
        makeTimetableGroup('p2', 0, { svc1: [500, 560, 620] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(5); // 2 + 3
    expect(result['wd']['s1'].rc).toBe(2); // r1, r2
    expect(result['wd']['s1'].rtc).toBe(1); // both route_type 3
    expect(result['wd']['s1'].ed).toBe(480);
    expect(result['wd']['s1'].ld).toBe(620);
  });

  it('counts distinct route types', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
      p2: { v: 2, r: 'r2', h: 'B', stops: [{ id: 's1' }, { id: 's3' }] },
    };

    const routes = [
      makeRoute('r1', 3), // bus
      makeRoute('r2', 1), // subway
    ];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', 0, { svc1: [480] }),
        makeTimetableGroup('p2', 0, { svc1: [500] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].rtc).toBe(2); // bus + subway
  });

  it('handles overnight departures (ld >= 1440)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [360, 1500] })], // 6:00 and 25:00
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].ed).toBe(360);
    expect(result['wd']['s1'].ld).toBe(1500);
  });

  it('separates stats by service group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc_wd: [480, 540, 600], svc_sa: [480, 600] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['sa']['s1'].freq).toBe(2);
  });

  it('excludes stops with no stop times in a service group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    // s1 only has weekday stop times
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc_wd: [480] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1']).toBeDefined();
    expect(result['sa']['s1']).toBeUndefined();
  });

  it('handles empty timetable', () => {
    const patterns: Record<string, TripPatternJson> = {};
    const routes: RouteV2Json[] = [];
    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats({}, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']).toEqual({});
  });

  it('skips timetable groups whose pattern ID is not in patterns map', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', 0, { svc1: [480] }),
        makeTimetableGroup('p_unknown', 0, { svc1: [500] }), // pattern not in map
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    // Only p1's stop time is counted, p_unknown is skipped
    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
  });

  it('counts rc=1 when multiple patterns share the same route', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
      p2: { v: 2, r: 'r1', h: 'B', stops: [{ id: 's1' }, { id: 's3' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', 0, { svc1: [480] }),
        makeTimetableGroup('p2', 0, { svc1: [500] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(2);
    expect(result['wd']['s1'].rc).toBe(1); // same route
    expect(result['wd']['s1'].rtc).toBe(1);
  });

  it('handles route not found in routes array (rtc excludes unknown routes)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r_unknown', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes: RouteV2Json[] = []; // route not in array

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
    expect(result['wd']['s1'].rtc).toBe(0); // route type unknown
  });

  it('returns empty result when service groups is empty', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };
    const routes = [makeRoute('r1', 3)];
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
    };

    const result = buildStopStats(timetable, patterns, routes, [], { services: [], exceptions: [] });

    expect(result).toEqual({});
  });

  it('counts 2x stop times at circular route origin/terminal stop', () => {
    // Circular: s1 → s2 → s3 → s1
    const patterns: Record<string, TripPatternJson> = {
      p1: {
        v: 2,
        r: 'r1',
        h: 'Terminal',
        stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's1' }],
      },
    };

    const routes = [makeRoute('r1', 3)];

    // s1 has 2x stop times (origin + terminal), interior stops have 3
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [480, 500, 540, 560, 600, 620] })],
      s2: [makeTimetableGroup('p1', 0, { svc1: [490, 550, 610] })],
      s3: [makeTimetableGroup('p1', 0, { svc1: [495, 555, 615] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    // Origin/terminal stop has 2x stop times — this is correct for stopStats
    // because the bus physically passes through this stop twice per trip
    expect(result['wd']['s1'].freq).toBe(6);
    expect(result['wd']['s2'].freq).toBe(3);
    expect(result['wd']['s3'].freq).toBe(3);
  });

  it('does not count stop times from timetable groups with no matching service IDs', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    // Timetable has stop times only for svc_wd, not svc_sa
    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc_wd: [480, 540, 600] })],
      s2: [makeTimetableGroup('p1', 0, { svc_wd: [490, 550, 610] })],
    };

    const groups: ServiceGroupEntry[] = [
      { key: 'wd', serviceIds: ['svc_wd'] },
      { key: 'sa', serviceIds: ['svc_sa'] },
    ];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['wd']['s1'].rc).toBe(1);
    // s1 has no Saturday stop times → not in sa group
    expect(result['sa']['s1']).toBeUndefined();
    expect(result['sa']['s2']).toBeUndefined();
  });

  it('sums freq across multiple service IDs in same group', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540], svc2: [600] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1', 'svc2'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(3);
    expect(result['wd']['s1'].ed).toBe(480);
    expect(result['wd']['s1'].ld).toBe(600);
  });

  it('sets ed === ld when only one stop time exists', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };

    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [720] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].ed).toBe(720);
    expect(result['wd']['s1'].ld).toBe(720);
  });

  it('computes ed/ld across multiple timetable groups (min of eds, max of lds)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
      p2: { v: 2, r: 'r2', h: 'B', stops: [{ id: 's1' }, { id: 's3' }] },
    };

    const routes = [makeRoute('r1', 3), makeRoute('r2', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p1', 0, { svc1: [600, 720] }), // ed=600, ld=720
        makeTimetableGroup('p2', 0, { svc1: [360, 1440] }), // ed=360, ld=1440
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    expect(result['wd']['s1'].freq).toBe(4);
    expect(result['wd']['s1'].ed).toBe(360); // min across groups
    expect(result['wd']['s1'].ld).toBe(1440); // max across groups
  });

  it('handles empty serviceIds in group (no stop times counted)', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
    };
    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
      s2: [makeTimetableGroup('p1', 0, { svc1: [490] })],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'empty', serviceIds: [] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    // No service IDs → no stop times → all stops excluded
    expect(Object.keys(result['empty'])).toHaveLength(0);
  });

  it('skips multiple timetable groups with unknown pattern IDs', () => {
    const patterns: Record<string, TripPatternJson> = {
      p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
    };
    const routes = [makeRoute('r1', 3)];

    const timetable: Record<string, TimetableGroupV2Json[]> = {
      s1: [
        makeTimetableGroup('p_unknown1', 0, { svc1: [480] }),
        makeTimetableGroup('p_unknown2', 0, { svc1: [540] }),
        makeTimetableGroup('p1', 0, { svc1: [600] }),
      ],
    };

    const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

    const result = buildStopStats(timetable, patterns, routes, groups, calendarFromGroups(groups));

    // Only p1 counted, unknown patterns skipped
    expect(result['wd']['s1'].freq).toBe(1);
    expect(result['wd']['s1'].rc).toBe(1);
    expect(result['wd']['s1'].ed).toBe(600);
    expect(result['wd']['s1'].ld).toBe(600);
  });

  // -------------------------------------------------------------------------
  // Issue #219 regression: freq must reflect per-day max, not service sum
  // -------------------------------------------------------------------------
  describe('disjoint-date services in same group (Issue #219)', () => {
    it('returns max one-day freq, not the sum across services that never co-occur', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
      };

      const routes = [makeRoute('r1', 3)];

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, {
            svc_a: [480, 540, 600],
            svc_b: [481, 541, 601],
          }),
        ],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'g', serviceIds: ['svc_a', 'svc_b'] }];

      // svc_a active 2026-05-01 only; svc_b active 2026-05-02 only.
      const calendar: CalendarJson = {
        services: [
          { i: 'svc_a', s: '20260501', e: '20260501', d: [1, 1, 1, 1, 1, 1, 1] },
          { i: 'svc_b', s: '20260502', e: '20260502', d: [1, 1, 1, 1, 1, 1, 1] },
        ],
        exceptions: [],
      };

      const result = buildStopStats(timetable, patterns, routes, groups, calendar);

      // Each service contributes 3 stop times on its single active day.
      // Old (buggy) implementation produced 6 (= 3 + 3); fixed value is 3.
      expect(result['g']['s1'].freq).toBe(3);
      // rc / rtc / ed / ld remain calendar-agnostic (any service in the group).
      expect(result['g']['s1'].rc).toBe(1);
      expect(result['g']['s1'].rtc).toBe(1);
      expect(result['g']['s1'].ed).toBe(480);
      expect(result['g']['s1'].ld).toBe(601);
    });

    it('includes calendar_dates-only services in the per-day max', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
      };

      const routes = [makeRoute('r1', 3)];

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, {
            wd_svc: [480, 540],
            hol_svc: [481],
          }),
        ],
      };

      const groups: ServiceGroupEntry[] = [
        { key: 'wd', serviceIds: ['wd_svc', 'hol_svc'] },
      ];

      // wd_svc weekdays 2026-05-04..2026-05-08; hol_svc added on 2026-05-05 only.
      const calendar: CalendarJson = {
        services: [
          { i: 'wd_svc', s: '20260504', e: '20260508', d: [1, 1, 1, 1, 1, 0, 0] },
        ],
        exceptions: [{ i: 'hol_svc', d: '20260505', t: 1 }],
      };

      const result = buildStopStats(timetable, patterns, routes, groups, calendar);

      // On 2026-05-05 both services active: 2 + 1 = 3. Other weekdays: 2 only.
      expect(result['wd']['s1'].freq).toBe(3);
    });

    it('returns empty groupStats when the calendar has no parseable dates', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
      };

      const routes = [makeRoute('r1', 3)];

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildStopStats(timetable, patterns, routes, groups, {
        services: [],
        exceptions: [],
      });

      expect(result['wd']).toEqual({});
    });
  });
});
