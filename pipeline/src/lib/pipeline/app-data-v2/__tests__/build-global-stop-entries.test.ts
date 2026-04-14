/**
 * Tests for build-global-stop-entries.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { DataBundle } from '../../../../../../src/types/data/transit-v2-json';
import { extractStopEntries, findSundayServiceIds } from '../build-global-stop-entries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal DataBundle with the given configuration. */
function makeDataBundle(opts: {
  services?: { id: string; d: number[] }[];
  stops?: { i: string; a: number; o: number; l: number; ps?: string }[];
  routes?: { i: string }[];
  patterns?: Record<string, { r: string; stops: { id: string }[] }>;
  timetable?: Record<string, { tp: string; si?: number; d: Record<string, number[]> }[]>;
}): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: (opts.stops ?? []).map((s) => ({
        v: 2 as const,
        i: s.i,
        n: s.i,
        a: s.a,
        o: s.o,
        l: s.l,
        ps: s.ps,
      })),
    },
    routes: {
      v: 2,
      data: (opts.routes ?? []).map((r) => ({
        v: 2 as const,
        i: r.i,
        s: r.i,
        l: r.i,
        t: 3,
        c: '000000',
        tc: 'FFFFFF',
        ai: 'a1',
      })),
    },
    agency: { v: 2, data: [] },
    calendar: {
      v: 1,
      data: {
        services: (opts.services ?? []).map((s) => ({
          i: s.id,
          d: s.d,
          s: '20260101',
          e: '20261231',
        })),
        exceptions: [],
      },
    },
    feedInfo: { v: 1, data: { pn: '', pu: '', l: '', s: '', e: '', v: '' } },
    timetable: {
      v: 2,
      data: Object.fromEntries(
        Object.entries(opts.timetable ?? {}).map(([stopId, groups]) => [
          stopId,
          groups.map((g, idx) => ({ v: 2 as const, tp: g.tp, si: g.si ?? idx, d: g.d, a: g.d })),
        ]),
      ),
    },
    tripPatterns: {
      v: 2,
      data: Object.fromEntries(
        Object.entries(opts.patterns ?? {}).map(([pid, p]) => [
          pid,
          { v: 2 as const, r: p.r, h: 'Terminal', stops: p.stops },
        ]),
      ),
    },
    translations: {
      v: 1,
      data: {
        agency_names: {},
        route_long_names: {},
        route_short_names: {},
        stop_names: {},
        trip_headsigns: {},
        stop_headsigns: {},
      },
    },
    lookup: { v: 2, data: {} },
  };
}

// ---------------------------------------------------------------------------
// findSundayServiceIds
// ---------------------------------------------------------------------------

describe('findSundayServiceIds', () => {
  it('returns service IDs with d[6] === 1', () => {
    const bundle = makeDataBundle({
      services: [
        { id: 'wd', d: [1, 1, 1, 1, 1, 0, 0] },
        { id: 'sa', d: [0, 0, 0, 0, 0, 1, 0] },
        { id: 'su', d: [0, 0, 0, 0, 0, 0, 1] },
        { id: 'all', d: [1, 1, 1, 1, 1, 1, 1] },
      ],
    });

    const result = findSundayServiceIds(bundle);

    expect(result).toEqual(new Set(['su', 'all']));
  });

  it('returns empty set when no Sunday services exist', () => {
    const bundle = makeDataBundle({
      services: [{ id: 'wd', d: [1, 1, 1, 1, 1, 0, 0] }],
    });

    const result = findSundayServiceIds(bundle);

    expect(result.size).toBe(0);
  });

  it('returns empty set when no services exist', () => {
    const bundle = makeDataBundle({ services: [] });

    const result = findSundayServiceIds(bundle);

    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractStopEntries
// ---------------------------------------------------------------------------

describe('extractStopEntries', () => {
  it('builds routeIds from all patterns (day-agnostic)', () => {
    const bundle = makeDataBundle({
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.69, o: 139.77, l: 0 },
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }, { id: 's2' }] },
        p2: { r: 'r2', stops: [{ id: 's1' }] },
      },
    });

    const entries = extractStopEntries(bundle, new Set());

    const s1 = entries.find((e) => e.id === 's1')!;
    expect(s1.routeIds).toEqual(new Set(['r1', 'r2']));

    const s2 = entries.find((e) => e.id === 's2')!;
    expect(s2.routeIds).toEqual(new Set(['r1']));
  });

  it('builds routeFreqs filtered by serviceIds', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
      },
      timetable: {
        s1: [
          {
            tp: 'p1',
            d: {
              'svc-wd': [480, 540, 600],
              'svc-su': [500, 560],
            },
          },
        ],
      },
    });

    // Only count Sunday services
    const entries = extractStopEntries(bundle, new Set(['svc-su']));

    const s1 = entries.find((e) => e.id === 's1')!;
    expect(s1.routeFreqs.get('r1')).toBe(2); // svc-su has 2 departures
  });

  it('sets empty routeIds for stops not in any pattern', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {},
    });

    const entries = extractStopEntries(bundle, new Set());

    expect(entries[0].routeIds.size).toBe(0);
  });

  it('sets empty routeFreqs when no departures match serviceIds', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
      },
      timetable: {
        s1: [{ tp: 'p1', d: { 'svc-wd': [480] } }],
      },
    });

    // Filter to Sunday, but only weekday departures exist
    const entries = extractStopEntries(bundle, new Set(['svc-su']));

    expect(entries[0].routeFreqs.size).toBe(0);
  });

  it('preserves parentStation and locationType', () => {
    const bundle = makeDataBundle({
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0, ps: 'p1' },
        { i: 'p1', a: 35.68, o: 139.76, l: 1 },
      ],
    });

    const entries = extractStopEntries(bundle, new Set());

    const s1 = entries.find((e) => e.id === 's1')!;
    expect(s1.parentStation).toBe('p1');
    expect(s1.locationType).toBe(0);

    const p1 = entries.find((e) => e.id === 'p1')!;
    expect(p1.parentStation).toBeUndefined();
    expect(p1.locationType).toBe(1);
  });

  it('aggregates freqs across multiple service IDs', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
      },
      timetable: {
        s1: [
          {
            tp: 'p1',
            d: {
              'su-1': [480, 540],
              'su-2': [500],
            },
          },
        ],
      },
    });

    const entries = extractStopEntries(bundle, new Set(['su-1', 'su-2']));

    expect(entries[0].routeFreqs.get('r1')).toBe(3); // 2 + 1
  });

  it('skips timetable entries with unknown pattern', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {},
      timetable: {
        s1: [{ tp: 'unknown-pattern', d: { su: [480] } }],
      },
    });

    const entries = extractStopEntries(bundle, new Set(['su']));

    expect(entries[0].routeFreqs.size).toBe(0);
  });

  it('aggregates routeFreqs across multiple timetable groups for same stop', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }] },
        p2: { r: 'r2', stops: [{ id: 's1' }] },
      },
      timetable: {
        s1: [
          { tp: 'p1', d: { su: [480, 540] } },
          { tp: 'p2', d: { su: [500] } },
        ],
      },
    });

    const entries = extractStopEntries(bundle, new Set(['su']));

    const s1 = entries[0];
    expect(s1.routeFreqs.get('r1')).toBe(2);
    expect(s1.routeFreqs.get('r2')).toBe(1);
  });

  it('includes routeIds for weekday-only routes even when filtering Sunday freqs', () => {
    // routeIds is day-agnostic (all patterns), routeFreqs is day-dependent.
    // A weekday-only route should appear in routeIds but NOT in routeFreqs.
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.68, o: 139.76, l: 0 }],
      patterns: {
        p1: { r: 'r-weekday', stops: [{ id: 's1' }] },
        p2: { r: 'r-sunday', stops: [{ id: 's1' }] },
      },
      timetable: {
        s1: [
          { tp: 'p1', d: { wd: [480] } }, // weekday only
          { tp: 'p2', d: { su: [500] } }, // sunday only
        ],
      },
    });

    const entries = extractStopEntries(bundle, new Set(['su']));

    const s1 = entries[0];
    // routeIds: both routes (day-agnostic)
    expect(s1.routeIds).toEqual(new Set(['r-weekday', 'r-sunday']));
    // routeFreqs: only Sunday route has departures
    expect(s1.routeFreqs.has('r-weekday')).toBe(false);
    expect(s1.routeFreqs.get('r-sunday')).toBe(1);
  });

  it('preserves lat/lon coordinates', () => {
    const bundle = makeDataBundle({
      stops: [{ i: 's1', a: 35.123456, o: 139.654321, l: 0 }],
    });

    const entries = extractStopEntries(bundle, new Set());

    expect(entries[0].lat).toBe(35.123456);
    expect(entries[0].lon).toBe(139.654321);
  });

  it('returns empty array when no stops exist', () => {
    const bundle = makeDataBundle({ stops: [] });

    const entries = extractStopEntries(bundle, new Set());

    expect(entries).toEqual([]);
  });

  it('handles circular pattern with duplicate stop in stops array', () => {
    // Circular route: stops = ['s1', 's2', 's1'] — s1 appears twice.
    // routeIds should still contain the route just once.
    const bundle = makeDataBundle({
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.69, o: 139.77, l: 0 },
      ],
      patterns: {
        p1: { r: 'r1', stops: [{ id: 's1' }, { id: 's2' }, { id: 's1' }] },
      },
    });

    const entries = extractStopEntries(bundle, new Set());

    const s1 = entries.find((e) => e.id === 's1')!;
    expect(s1.routeIds).toEqual(new Set(['r1'])); // deduplicated by Set
  });

  it('returns one entry per stop in stops.data', () => {
    const bundle = makeDataBundle({
      stops: [
        { i: 's1', a: 35.68, o: 139.76, l: 0 },
        { i: 's2', a: 35.69, o: 139.77, l: 0 },
        { i: 'p1', a: 35.68, o: 139.76, l: 1 },
      ],
    });

    const entries = extractStopEntries(bundle, new Set());

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.id).sort()).toEqual(['p1', 's1', 's2']);
  });
});
