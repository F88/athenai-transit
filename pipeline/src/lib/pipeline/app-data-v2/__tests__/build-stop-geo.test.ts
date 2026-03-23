/**
 * Tests for build-stop-geo.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { StopEntry } from '../build-stop-geo';
import { buildStopGeo, buildParentStopGeo } from '../build-stop-geo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStop(
  id: string,
  lat: number,
  lon: number,
  routeIds: string[],
  routeFreqs?: Record<string, number>,
  parentStation?: string,
): StopEntry {
  const freqs = new Map<string, number>();
  if (routeFreqs) {
    for (const [rid, f] of Object.entries(routeFreqs)) {
      freqs.set(rid, f);
    }
  } else {
    for (const rid of routeIds) {
      freqs.set(rid, 10);
    }
  }
  return {
    id,
    lat,
    lon,
    routeIds: new Set(routeIds),
    routeFreqs: freqs,
    parentStation,
    locationType: 0,
  };
}

// ---------------------------------------------------------------------------
// buildStopGeo
// ---------------------------------------------------------------------------

describe('buildStopGeo', () => {
  describe('nr', () => {
    it('computes nr to nearest different-route stop', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1']),
        makeStop('s2', 35.681, 139.76, ['r2']), // ~111m away, different route
        makeStop('s3', 35.69, 139.76, ['r1']), // ~1.1km away, same route
      ];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].nr).toBeGreaterThan(0);
      expect(result['s1'].nr).toBeLessThan(0.2); // ~111m
    });

    it('does not count same-route stops as different', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1']),
        makeStop('s2', 35.681, 139.76, ['r1']), // same route, closer
        makeStop('s3', 35.69, 139.76, ['r2']), // different route, farther
      ];

      const result = buildStopGeo(stops, 'ho');

      // nr should be to s3, not s2
      expect(result['s1'].nr).toBeGreaterThan(1.0);
    });

    it('returns nr=0 when no different-route stop exists', () => {
      const stops = [makeStop('s1', 35.68, 139.76, ['r1']), makeStop('s2', 35.681, 139.76, ['r1'])];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].nr).toBe(0);
    });

    it('handles stop with multiple routes', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1', 'r2']),
        makeStop('s2', 35.681, 139.76, ['r1']), // subset of s1's routes
        makeStop('s3', 35.69, 139.76, ['r3']), // completely different
      ];

      const result = buildStopGeo(stops, 'ho');

      // s2 has no route outside s1's set, so nr should be to s3
      expect(result['s1'].nr).toBeGreaterThan(1.0);
    });
  });

  describe('wp', () => {
    it('computes wp to nearest different-parent_station stop', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1'], undefined, 'ps1'),
        makeStop('s2', 35.681, 139.76, ['r2'], undefined, 'ps1'), // same ps
        makeStop('s3', 35.682, 139.76, ['r3'], undefined, 'ps2'), // different ps
      ];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].wp).toBeDefined();
      // Should be to s3 (different ps), not s2 (same ps)
      expect(result['s1'].wp!).toBeGreaterThan(0.2);
    });

    it('omits wp when stop has no parent_station', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1']), // no ps
        makeStop('s2', 35.681, 139.76, ['r2'], undefined, 'ps2'),
      ];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].wp).toBeUndefined();
    });

    it('omits wp when no different-ps stop exists', () => {
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1'], undefined, 'ps1'),
        makeStop('s2', 35.681, 139.76, ['r2'], undefined, 'ps1'),
      ];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].wp).toBeUndefined();
    });
  });

  describe('cn (connectivity)', () => {
    it('counts unique routes within 300m', () => {
      // s2 is ~111m from s1 (within 300m), s3 is ~1.1km (outside)
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1'], { r1: 10 }),
        makeStop('s2', 35.681, 139.76, ['r2'], { r2: 20 }),
        makeStop('s3', 35.69, 139.76, ['r3'], { r3: 30 }),
      ];

      const result = buildStopGeo(stops, 'ho');

      // s1 + s2 within 300m = 2 unique routes
      expect(result['s1'].cn!['ho'].rc).toBe(2);
      expect(result['s1'].cn!['ho'].freq).toBe(30); // max(10, 20) per route = 10+20
      expect(result['s1'].cn!['ho'].sc).toBe(1); // s2 only
    });

    it('uses max freq per route across stops', () => {
      // Same route r1 at two nearby stops with different freq
      const stops = [
        makeStop('s1', 35.68, 139.76, ['r1'], { r1: 10 }),
        makeStop('s2', 35.6801, 139.76, ['r1'], { r1: 50 }), // ~11m, same route higher freq
      ];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].cn!['ho'].rc).toBe(1); // 1 unique route
      expect(result['s1'].cn!['ho'].freq).toBe(50); // max freq
    });

    it('omits cn when no routes exist', () => {
      const stops = [makeStop('s1', 35.68, 139.76, [], {})];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].cn).toBeUndefined();
    });

    it('includes self routes in cn', () => {
      // Only one stop, no neighbors
      const stops = [makeStop('s1', 35.68, 139.76, ['r1'], { r1: 10 })];

      const result = buildStopGeo(stops, 'ho');

      expect(result['s1'].cn!['ho'].rc).toBe(1);
      expect(result['s1'].cn!['ho'].freq).toBe(10);
      expect(result['s1'].cn!['ho'].sc).toBe(0);
    });
  });

  it('rounds nr and wp to 3 decimal places', () => {
    const stops = [
      makeStop('s1', 35.6812, 139.7671, ['r1'], undefined, 'ps1'),
      makeStop('s2', 35.6896, 139.7006, ['r2'], undefined, 'ps2'),
    ];

    const result = buildStopGeo(stops, 'ho');

    const nrStr = result['s1'].nr.toString();
    const nrDecimals = nrStr.includes('.') ? nrStr.split('.')[1].length : 0;
    expect(nrDecimals).toBeLessThanOrEqual(3);

    const wpStr = result['s1'].wp!.toString();
    const wpDecimals = wpStr.includes('.') ? wpStr.split('.')[1].length : 0;
    expect(wpDecimals).toBeLessThanOrEqual(3);
  });

  it('produces output for all input stops', () => {
    const stops = [
      makeStop('s1', 35.68, 139.76, ['r1']),
      makeStop('s2', 35.69, 139.77, ['r2']),
      makeStop('s3', 35.7, 139.78, ['r3']),
    ];

    const result = buildStopGeo(stops, 'ho');

    expect(Object.keys(result)).toHaveLength(3);
  });

  it('returns empty record for empty input', () => {
    const result = buildStopGeo([], 'ho');

    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildParentStopGeo
// ---------------------------------------------------------------------------

describe('buildParentStopGeo', () => {
  it('derives nr as min of children', () => {
    const childGeo: Record<
      string,
      import('../../../../../../src/types/data/transit-v2-json').StopGeoJson
    > = {
      c1: { nr: 0.1, cn: { ho: { rc: 5, freq: 100, sc: 3 } } },
      c2: { nr: 0.05, cn: { ho: { rc: 5, freq: 100, sc: 3 } } },
      c3: { nr: 0.2, cn: { ho: { rc: 5, freq: 100, sc: 3 } } },
    };

    const parents: StopEntry[] = [
      {
        id: 'p1',
        lat: 35.68,
        lon: 139.76,
        routeIds: new Set(),
        routeFreqs: new Map(),
        locationType: 1,
      },
    ];
    const childrenMap = new Map([['p1', ['c1', 'c2', 'c3']]]);

    const result = buildParentStopGeo(parents, childrenMap, childGeo, [], 'ho');

    expect(result['p1'].nr).toBe(0.05); // min
  });

  it('derives wp as min of children', () => {
    const childGeo: Record<
      string,
      import('../../../../../../src/types/data/transit-v2-json').StopGeoJson
    > = {
      c1: { nr: 0.1, wp: 0.3 },
      c2: { nr: 0.1, wp: 0.15 },
    };

    const parents: StopEntry[] = [
      {
        id: 'p1',
        lat: 35.68,
        lon: 139.76,
        routeIds: new Set(),
        routeFreqs: new Map(),
        locationType: 1,
      },
    ];
    const childrenMap = new Map([['p1', ['c1', 'c2']]]);

    const result = buildParentStopGeo(parents, childrenMap, childGeo, [], 'ho');

    expect(result['p1'].wp).toBe(0.15); // min
  });

  it('omits wp when no children have wp', () => {
    const childGeo: Record<
      string,
      import('../../../../../../src/types/data/transit-v2-json').StopGeoJson
    > = {
      c1: { nr: 0.1 },
      c2: { nr: 0.1 },
    };

    const parents: StopEntry[] = [
      {
        id: 'p1',
        lat: 35.68,
        lon: 139.76,
        routeIds: new Set(),
        routeFreqs: new Map(),
        locationType: 1,
      },
    ];
    const childrenMap = new Map([['p1', ['c1', 'c2']]]);

    const result = buildParentStopGeo(parents, childrenMap, childGeo, [], 'ho');

    expect(result['p1'].wp).toBeUndefined();
  });

  it('computes cn at parent coordinates', () => {
    const childGeo: Record<
      string,
      import('../../../../../../src/types/data/transit-v2-json').StopGeoJson
    > = {
      c1: { nr: 0.1 },
    };

    const parents: StopEntry[] = [
      {
        id: 'p1',
        lat: 35.68,
        lon: 139.76,
        routeIds: new Set(),
        routeFreqs: new Map(),
        locationType: 1,
      },
    ];
    const childrenMap = new Map([['p1', ['c1']]]);

    // Nearby l=0 stop with routes
    const allL0: StopEntry[] = [makeStop('nearby', 35.6801, 139.76, ['r1'], { r1: 50 })];

    const result = buildParentStopGeo(parents, childrenMap, childGeo, allL0, 'ho');

    expect(result['p1'].cn).toBeDefined();
    expect(result['p1'].cn!['ho'].rc).toBe(1);
    expect(result['p1'].cn!['ho'].freq).toBe(50);
  });

  it('skips parents with no children in childGeo', () => {
    const parents: StopEntry[] = [
      {
        id: 'p1',
        lat: 35.68,
        lon: 139.76,
        routeIds: new Set(),
        routeFreqs: new Map(),
        locationType: 1,
      },
    ];
    const childrenMap = new Map<string, string[]>([['p1', []]]);

    const result = buildParentStopGeo(parents, childrenMap, {}, [], 'ho');

    expect(result['p1']).toBeUndefined();
  });
});
