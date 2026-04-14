/**
 * Tests for build-trip-pattern-stats.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  ServiceGroupEntry,
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../../src/types/data/transit-v2-json';
import { buildTripPatternStats } from '../build-trip-pattern-stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimetableGroup(
  patternId: string,
  si: number,
  stopDeps: Record<string, number[]>,
): TimetableGroupV2Json {
  // Arrival = departure for simplicity
  return {
    v: 2,
    tp: patternId,
    si,
    d: stopDeps,
    a: stopDeps,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTripPatternStats', () => {
  describe('freq', () => {
    it('counts departures for a basic pattern', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550, 610] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560, 620] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].freq).toBe(3);
    });

    it('sums departures across multiple service IDs in a group', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540], svc2: [600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550], svc2: [610] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1', 'svc2'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].freq).toBe(3); // 2 + 1
    });

    it('separates freq by service group', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc_wd: [480, 540, 600], svc_sa: [480, 540] })],
        s2: [makeTimetableGroup('p1', 1, { svc_wd: [490, 550, 610], svc_sa: [490, 550] })],
      };

      const groups: ServiceGroupEntry[] = [
        { key: 'wd', serviceIds: ['svc_wd'] },
        { key: 'sa', serviceIds: ['svc_sa'] },
      ];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].freq).toBe(3);
      expect(result['sa']['p1'].freq).toBe(2);
    });

    it('uses interior stop for circular route freq (avoids 2x)', () => {
      // Circular: s1 → s2 → s3 → s1
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's1' }],
        },
      };

      // s1 appears at si=0 (origin) and si=3 (terminal), each with 3 deps
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] }),
          makeTimetableGroup('p1', 3, { svc1: [500, 560, 620] }),
        ],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550, 610] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [495, 555, 615] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // freq = origin (si=0) departures = 3 — no longer needs interior stop workaround
      expect(result['wd']['p1'].freq).toBe(3);
    });

    it('omits pattern when timetable is empty (no departures)', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {};

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1']).toBeUndefined();
    });

    it('omits pattern for service group with no matching departures', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc_wd: [480, 540] })],
        s2: [makeTimetableGroup('p1', 1, { svc_wd: [490, 550] })],
        s3: [makeTimetableGroup('p1', 2, { svc_wd: [500, 560] })],
      };

      const groups: ServiceGroupEntry[] = [
        { key: 'wd', serviceIds: ['svc_wd'] },
        { key: 'sa', serviceIds: ['svc_sa'] },
      ];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // Weekday: has departures
      expect(result['wd']['p1'].freq).toBe(2);
      expect(result['wd']['p1'].rd).toEqual([20, 10, 0]);

      // Saturday: no departures — pattern omitted
      expect(result['sa']['p1']).toBeUndefined();
    });

    it('omits empty stops pattern', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [] as { id: string }[] },
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, {}, groups);

      expect(result['wd']['p1']).toBeUndefined();
    });

    it('omits single-stop pattern with no departures', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {};

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1']).toBeUndefined();
    });

    it('returns empty groupStats when no patterns exist', () => {
      const patterns: Record<string, TripPatternJson> = {};

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, {}, groups);

      expect(result['wd']).toEqual({});
    });

    it('returns empty result when service groups is empty', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      const result = buildTripPatternStats(patterns, {}, []);

      expect(result).toEqual({});
    });
  });

  describe('rd (remaining duration)', () => {
    it('computes rd for a simple 3-stop pattern', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      // Each trip takes 10 min per segment
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550, 610] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560, 620] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(3);
      expect(rd[2]).toBe(0); // terminal
      expect(rd[1]).toBe(10); // 10 min to terminal
      expect(rd[0]).toBe(20); // 20 min to terminal
    });

    it('rd is monotonically decreasing', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
        },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [485, 545] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [495, 555] })],
        s4: [makeTimetableGroup('p1', 3, { svc1: [510, 570] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(4);
      for (let i = 0; i < rd.length - 1; i++) {
        expect(rd[i]).toBeGreaterThanOrEqual(rd[i + 1]);
      }
      expect(rd[rd.length - 1]).toBe(0);
    });

    it('rd last element is always 0', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [500] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd[result['wd']['p1'].rd.length - 1]).toBe(0);
    });

    it('handles single-stop pattern (rd = [0])', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd).toEqual([0]);
    });

    it('handles stop with no timetable entry (gap interpolation)', () => {
      // 4 stops where s2 has no timetable entry, but s1→s2 and s2→s3
      // segments can be interpolated from neighboring known segments
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
        },
      };

      // s2 has no timetable entry; s1→s3 = 20 min, s3→s4 = 10 min
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
        // s2 missing
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560] })],
        s4: [makeTimetableGroup('p1', 3, { svc1: [510, 570] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(4);
      expect(rd[3]).toBe(0); // terminal
      // s3→s4 segment = 10 min (known)
      expect(rd[2]).toBe(10);
      // Gap segments (s1→s2 and s2→s3) should be interpolated from neighbor
      // The known neighbor is s3→s4 = 10, so gap fills with 10
      expect(rd[1]).toBeGreaterThan(0);
      expect(rd[0]).toBeGreaterThan(rd[1]);
    });

    it('computes rd for circular route via interpolation of origin/terminal segments', () => {
      // Circular: s1 → s2 → s3 → s1
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's1' }],
        },
      };

      // Origin s1 has 2x departures (interleaved start/return)
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 500, 540, 560, 600, 620] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550, 610] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [495, 555, 615] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(4);
      expect(rd[3]).toBe(0); // terminal

      // Interior segment s2→s3: median diff = 5 min
      expect(rd[2]).toBe(5);

      // Origin and terminal segments are interpolated from the interior segment
      // So rd[1] includes the interpolated terminal segment + rd[2]
      expect(rd[1]).toBeGreaterThan(rd[2]);
      expect(rd[0]).toBeGreaterThan(rd[1]);

      // Total ride time should be reasonable (not inflated by 2x alignment issue)
      // With 3 segments of ~5 min each, total should be ~15 min
      expect(rd[0]).toBeLessThan(30);
    });

    it('uses median for segment travel times', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      // 3 trips with different travel times: 10, 12, 20 → median = 12
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 552, 620] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd[0]).toBe(12);
      expect(result['wd']['p1'].rd[1]).toBe(0);
    });

    it('rounds rd to 1 decimal place', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      // 2 trips: travel time = 7 and 8 → median = 7.5
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [487, 548] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd[0]).toBe(7.5);
      expect(result['wd']['p1'].rd[1]).toBe(0);
    });

    it('computes median as average of two middle values for even trip count', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      // 4 trips with travel times: 8, 10, 12, 14 → median = (10+12)/2 = 11
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600, 660] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [488, 550, 612, 674] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd[0]).toBe(11);
    });

    it('filters out negative time diffs between consecutive stops', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }] },
      };

      // 3 trips: diffs = 10, -5 (negative, filtered), 10 → median of [10, 10] = 10
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 545, 600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 540, 610] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].rd[0]).toBe(10);
    });

    it('computes rd for 3-stop circular with si-aware separation', () => {
      // Circular with exactly 3 stops: s1 → s2 → s1
      // si splits s1 into 2 groups (si=0 origin, si=2 terminal), so segments
      // can be computed correctly via positional alignment.
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's1' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, { svc1: [480, 540] }), // origin departures
          makeTimetableGroup('p1', 2, { svc1: [500, 560] }), // terminal arrivals
        ],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // freq = 2 (origin trips per day)
      expect(result['wd']['p1'].freq).toBe(2);
      // s1(si=0)→s2 = 10 min, s2→s1(si=2) = 10 min → rd = [20, 10, 0]
      expect(result['wd']['p1'].rd).toEqual([20, 10, 0]);
    });

    it('handles 2-stop circular pattern with si-aware separation', () => {
      // 2-stop circular: [s1, s1] — origin and terminal are the same stop_id,
      // separated by si into 2 distinct groups. With si, this case is no longer
      // a known limitation.
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's1' }] },
      };

      // s1 split into si=0 (origin) and si=1 (terminal arrival)
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, { svc1: [480, 540] }),
          makeTimetableGroup('p1', 1, { svc1: [500, 560] }),
        ],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // freq = 2 (origin trips per day) — no longer 4 (2x merged)
      expect(result['wd']['p1'].freq).toBe(2);
      // segment(si=0 → si=1) = 20 min
      expect(result['wd']['p1'].rd).toEqual([20, 0]);
    });

    it('preserves zero travel time between consecutive stops (not treated as gap)', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
        },
      };

      // s2→s3: same departure time (diff = 0), a valid zero-minute segment
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [490] })], // same as s2
        s4: [makeTimetableGroup('p1', 3, { svc1: [500] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      // Total: s1→s2 = 10, s2→s3 = 0, s3→s4 = 10 → total = 20
      expect(rd).toEqual([20, 10, 10, 0]);
    });

    it('computes rd independently for multiple patterns', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'A', stops: [{ id: 's1' }, { id: 's2' }] },
        p2: { v: 2, r: 'r1', h: 'B', stops: [{ id: 's3' }, { id: 's4' }] },
      };

      // si is the position within the pattern, so s3 in p2 is si=0 and s4 is si=1
      // (the perl batch update naively used the digit in the stop name, so s3/s4
      // got si=2/3 which are wrong for a 2-stop pattern)
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })],
        s3: [makeTimetableGroup('p2', 0, { svc1: [480, 540] })],
        s4: [makeTimetableGroup('p2', 1, { svc1: [500, 560] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].freq).toBe(2);
      expect(result['wd']['p1'].rd).toEqual([10, 0]);
      expect(result['wd']['p2'].freq).toBe(2);
      expect(result['wd']['p2'].rd).toEqual([20, 0]);
    });

    it('skips segment when departure counts differ between consecutive stops', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      // s1 has 3 deps, s2 has 2 deps (count mismatch), s3 has 2 deps
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })],
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(3);
      expect(rd[2]).toBe(0);
      // s2→s3 segment: counts match (2==2), median = 10 min
      expect(rd[1]).toBe(10);
      // s1→s2 segment: counts mismatch (3!=2), skipped, interpolated from neighbor
      expect(rd[0]).toBeGreaterThan(rd[1]);
    });

    it('fills gap at start of segment array (copy from following)', () => {
      // s1 has 3 deps, s2 has 2 deps → segment 0 (s1→s2) count mismatch → NO_DATA
      // segment 1 (s2→s3) is known → gap copies from next neighbor
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] })], // 3 deps
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })], // 2 deps (mismatch)
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560] })], // 2 deps
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(3);
      expect(rd[2]).toBe(0);
      // s2→s3 = 10 min (known, counts match)
      expect(rd[1]).toBe(10);
      // s1→s2 gap filled from next neighbor (10) → rd[0] = 10 + 10 = 20
      expect(rd[0]).toBe(20);
    });

    it('fills gap at end of segment array (copy from preceding)', () => {
      // s2 has 2 deps, s3 has 3 deps → segment 1 (s2→s3) count mismatch → NO_DATA
      // segment 0 (s1→s2) is known → gap copies from previous neighbor
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })], // 2 deps
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })], // 2 deps
        s3: [makeTimetableGroup('p1', 2, { svc1: [500, 560, 620] })], // 3 deps (mismatch)
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(3);
      expect(rd[2]).toBe(0);
      // s2→s3 gap filled from previous neighbor (s1→s2 = 10) → rd[1] = 10
      expect(rd[1]).toBe(10);
      // rd[0] = segment(s1→s2) + rd[1] = 10 + 10 = 20
      expect(rd[0]).toBe(20);
    });

    it('handles all-negative diffs by gap interpolation from neighbors', () => {
      // s2 departs BEFORE s1 for all trips → all diffs negative → NO_DATA
      // The NO_DATA gap is then filled by interpolation from the known neighbor
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [500, 560] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490, 550] })], // earlier than s1
        s3: [makeTimetableGroup('p1', 2, { svc1: [510, 570] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(3);
      expect(rd[2]).toBe(0);
      // s1→s2: all negative → NO_DATA, filled by gap interpolation from s2→s3 (20 min)
      // s2→s3: diffs = [20, 20] → 20
      expect(rd[1]).toBe(20);
      // s1→s2 gap interpolated from s2→s3 → 20
      expect(rd[0]).toBe(40);
    });

    it('does not confuse 0 (valid) with NO_DATA (-1) during gap interpolation', () => {
      // s2→s3 has 0 travel time (valid), s3→s4 and s4→s5 are gaps (s4 missing)
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }],
        },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480] })],
        s2: [makeTimetableGroup('p1', 1, { svc1: [490] })], // +10
        s3: [makeTimetableGroup('p1', 2, { svc1: [490] })], // +0 (same time, valid)
        // s4 missing → NO_DATA gap
        s5: [makeTimetableGroup('p1', 4, { svc1: [495] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);
      const rd = result['wd']['p1'].rd;

      expect(rd).toHaveLength(5);
      expect(rd[4]).toBe(0);
      // s3→s4 gap: prev neighbor = 0 (s2→s3), next neighbor = ? (s4→s5 also gap)
      // Actually s4 is missing so both s3→s4 and s4→s5 are gaps
      // Only s1→s2 (10) and s2→s3 (0) are known
      // Gaps filled: s3→s4 copies from prev (0), s4→s5 copies from prev (0)
      // So rd = [10+0+0+0, 0+0+0, 0+0, 0, 0] = [10, 0, 0, 0, 0]
      expect(rd[0]).toBe(10);
      expect(rd[1]).toBe(0);
      expect(rd[2]).toBe(0);
    });

    it('omits pattern when timetable has entries only for other patterns', () => {
      const patterns: Record<string, TripPatternJson> = {
        p1: { v: 2, r: 'r1', h: 'Terminal', stops: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      };

      // Timetable entries exist but for a different pattern
      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p_other', 0, { svc1: [480] })],
        s2: [makeTimetableGroup('p_other', 1, { svc1: [490] })],
        s3: [makeTimetableGroup('p_other', 2, { svc1: [500] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Issue #47: duplicate stop_id within pattern (6-shape, circular, complex)
  // ---------------------------------------------------------------------------
  describe('duplicate stop_id within pattern (Issue #47)', () => {
    it('6-shape: freq is single-trip count, not double (toaran:p72 風)', () => {
      // Pattern: s1 → s2 → s1 → s3 (s1 at non-terminal middle position 2)
      // Equivalent to 都営大江戸線 都庁前 [0, 28] in toaran:p72
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's1' }, { id: 's3' }],
        },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          // si=0 origin departures (3 trips)
          makeTimetableGroup('p1', 0, { svc1: [480, 540, 600] }),
          // si=2 mid-trip pass-through (3 trips, same physical pass — different time)
          makeTimetableGroup('p1', 2, { svc1: [490, 550, 610] }),
        ],
        s2: [makeTimetableGroup('p1', 1, { svc1: [485, 545, 605] })],
        s3: [makeTimetableGroup('p1', 3, { svc1: [495, 555, 615] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // freq = origin (si=0) trip count = 3, NOT 6 (would be the broken merged value)
      expect(result['wd']['p1'].freq).toBe(3);
      // rd should be computed correctly even with duplicate stop in middle
      // s1(si=0)→s2 = 5, s2→s1(si=2) = 5, s1(si=2)→s3 = 5 → rd = [15, 10, 5, 0]
      expect(result['wd']['p1'].rd).toEqual([15, 10, 5, 0]);
    });

    it('complex multi-duplicate: per-pattern freq excludes double-counting (actvnav 風)', () => {
      // Pattern: s1 → s2 → s3 → s1 → s2 → s4 (s1 at [0,3], s2 at [1,4])
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [
            { id: 's1' },
            { id: 's2' },
            { id: 's3' },
            { id: 's1' },
            { id: 's2' },
            { id: 's4' },
          ],
        },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [
          makeTimetableGroup('p1', 0, { svc1: [480, 540] }),
          makeTimetableGroup('p1', 3, { svc1: [486, 546] }),
        ],
        s2: [
          makeTimetableGroup('p1', 1, { svc1: [482, 542] }),
          makeTimetableGroup('p1', 4, { svc1: [488, 548] }),
        ],
        s3: [makeTimetableGroup('p1', 2, { svc1: [484, 544] })],
        s4: [makeTimetableGroup('p1', 5, { svc1: [490, 550] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      // freq = trip count from origin (si=0) = 2, NOT 4 (would be naive sum)
      expect(result['wd']['p1'].freq).toBe(2);
    });

    it('consecutive duplicate (dwell): each si is treated as independent group', () => {
      // Pattern: s1 → s2 → s2 → s3 (s2 at consecutive positions 1 and 2, dwell)
      const patterns: Record<string, TripPatternJson> = {
        p1: {
          v: 2,
          r: 'r1',
          h: 'Terminal',
          stops: [{ id: 's1' }, { id: 's2' }, { id: 's2' }, { id: 's3' }],
        },
      };

      const timetable: Record<string, TimetableGroupV2Json[]> = {
        s1: [makeTimetableGroup('p1', 0, { svc1: [480, 540] })],
        s2: [
          // dwell: same departure time at si=1 and si=2
          makeTimetableGroup('p1', 1, { svc1: [485, 545] }),
          makeTimetableGroup('p1', 2, { svc1: [485, 545] }),
        ],
        s3: [makeTimetableGroup('p1', 3, { svc1: [490, 550] })],
      };

      const groups: ServiceGroupEntry[] = [{ key: 'wd', serviceIds: ['svc1'] }];

      const result = buildTripPatternStats(patterns, timetable, groups);

      expect(result['wd']['p1'].freq).toBe(2);
      // s1→s2(si=1) = 5, s2(si=1)→s2(si=2) = 0 (dwell), s2(si=2)→s3 = 5 → rd = [10, 5, 5, 0]
      expect(result['wd']['p1'].rd).toEqual([10, 5, 5, 0]);
    });
  });
});
