/**
 * Tests for validate-data.ts validateDataBundle function.
 *
 * Creates temporary DataBundle files and validates them,
 * verifying correct detection of structural, referential,
 * and data quality issues.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataBundle } from '../../../../../../src/types/data/transit-v2-json';
import { validateDataBundle } from '../validate-data';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-data-test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeBundle(prefix: string, bundle: unknown): void {
  const dir = join(TMP_DIR, prefix);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'data.json'), JSON.stringify(bundle));
}

/**
 * Build a minimal valid DataBundle.
 *
 * All sections are present with correct versions. The default data
 * includes one stop, one route, one pattern, one timetable group,
 * and one calendar service, forming a valid referential graph.
 */
function makeValidBundle(overrides?: Partial<DataBundle>): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: [{ v: 2, i: 'test:S1', n: 'Test Stop', a: 35.68, o: 139.76, l: 0 }],
    },
    routes: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'test:R1',
          s: 'R1',
          l: 'Route 1',
          t: 3,
          c: 'FF0000',
          tc: 'FFFFFF',
          ai: 'test:A1',
        },
      ],
    },
    agency: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'test:A1',
          n: 'Test Agency',
          u: 'https://example.com',
          tz: 'Asia/Tokyo',
          l: 'ja',
        },
      ],
    },
    calendar: {
      v: 1,
      data: {
        services: [{ i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20261231' }],
        exceptions: [],
      },
    },
    feedInfo: {
      v: 1,
      data: {
        pn: 'Test',
        pu: 'https://example.com',
        l: 'ja',
        s: '20260101',
        e: '20261231',
        v: '1.0',
      },
    },
    timetable: {
      v: 2,
      data: {
        'test:S1': [
          {
            v: 2,
            tp: 'test:P1',
            si: 0,
            d: { 'test:SVC1': [480] },
            a: { 'test:SVC1': [480] },
          },
        ],
      },
    },
    tripPatterns: {
      v: 2,
      data: {
        'test:P1': { v: 2, r: 'test:R1', h: 'Terminal', stops: [{ id: 'test:S1' }] },
      },
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateDataBundle', () => {
  describe('file and structure checks', () => {
    it('reports error when data.json does not exist', () => {
      const result = validateDataBundle('nonexistent', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('not found');
    });

    it('reports error for invalid JSON', () => {
      const dir = join(TMP_DIR, 'bad-json');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'data.json'), '{invalid json');

      const result = validateDataBundle('bad-json', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('Failed to parse');
    });

    it('reports error for wrong bundle_version', () => {
      const bundle = makeValidBundle();
      (bundle as unknown as Record<string, unknown>).bundle_version = 1;
      writeBundle('bad-ver', bundle);

      const result = validateDataBundle('bad-ver', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('bundle_version'))).toBe(true);
    });

    it('reports error for wrong kind', () => {
      const bundle = makeValidBundle();
      (bundle as unknown as Record<string, unknown>).kind = 'shapes';
      writeBundle('bad-kind', bundle);

      const result = validateDataBundle('bad-kind', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('kind'))).toBe(true);
    });

    it('passes for a valid bundle', () => {
      writeBundle('valid', makeValidBundle());

      const result = validateDataBundle('valid', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.stopCount).toBe(1);
      expect(result.routeCount).toBe(1);
      expect(result.serviceCount).toBe(1);
      expect(result.patternCount).toBe(1);
      expect(result.timetableStopCount).toBe(1);
    });
  });

  describe('section version checks', () => {
    it('reports error for wrong section version', () => {
      const bundle = makeValidBundle();
      (bundle.stops as unknown as Record<string, unknown>).v = 1;
      writeBundle('bad-sv', bundle);

      const result = validateDataBundle('bad-sv', TMP_DIR);
      expect(
        result.issues.some(
          (i) => i.message.includes('stops.v') && i.message.includes('expected 2'),
        ),
      ).toBe(true);
    });

    it('reports error for missing section', () => {
      const bundle = makeValidBundle();
      delete (bundle as unknown as Record<string, unknown>).lookup;
      writeBundle('no-lookup', bundle);

      const result = validateDataBundle('no-lookup', TMP_DIR);
      expect(
        result.issues.some((i) => i.message.includes('Missing required section: lookup')),
      ).toBe(true);
    });
  });

  describe('non-empty warnings', () => {
    it('warns when stops is empty', () => {
      const bundle = makeValidBundle({
        stops: { v: 2, data: [] },
        timetable: { v: 2, data: {} },
        tripPatterns: { v: 2, data: {} },
      });
      writeBundle('empty-stops', bundle);

      const result = validateDataBundle('empty-stops', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'warn' && i.message.includes('0 stops'))).toBe(
        true,
      );
    });

    it('warns when routes is empty', () => {
      const bundle = makeValidBundle({
        routes: { v: 2, data: [] },
        timetable: { v: 2, data: {} },
        tripPatterns: { v: 2, data: {} },
      });
      writeBundle('empty-routes', bundle);

      const result = validateDataBundle('empty-routes', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'warn' && i.message.includes('0 routes'))).toBe(
        true,
      );
    });

    it('warns when calendar services is empty', () => {
      const bundle = makeValidBundle({
        calendar: { v: 1, data: { services: [], exceptions: [] } },
      });
      writeBundle('empty-cal', bundle);

      const result = validateDataBundle('empty-cal', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'warn' && i.message.includes('0 services')),
      ).toBe(true);
    });
  });

  describe('calendar expiration', () => {
    it('warns when earliest end_date has already passed', () => {
      const bundle = makeValidBundle({
        calendar: {
          v: 1,
          data: {
            services: [{ i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20240101', e: '20240301' }],
            exceptions: [],
          },
        },
      });
      writeBundle('expired', bundle);

      const result = validateDataBundle('expired', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'warn' && i.message.includes('expired'))).toBe(
        true,
      );
    });

    it('warns when earliest end_date is within 30 days', () => {
      // Use fake timers to control "now"
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));

      const bundle = makeValidBundle({
        calendar: {
          v: 1,
          data: {
            services: [{ i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20260701' }],
            exceptions: [],
          },
        },
      });
      writeBundle('expiring-soon', bundle);

      const result = validateDataBundle('expiring-soon', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'warn' && i.message.includes('within 30 days')),
      ).toBe(true);
    });

    it('does not warn for far-future end_date', () => {
      writeBundle('far-future', makeValidBundle());

      const result = validateDataBundle('far-future', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('expire'))).toBe(false);
      expect(result.issues.some((i) => i.message.includes('expired'))).toBe(false);
    });

    it('ignores invalid calendar date (e.g. 20260299)', () => {
      const bundle = makeValidBundle({
        calendar: {
          v: 1,
          data: {
            services: [{ i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20260299' }],
            exceptions: [],
          },
        },
      });
      writeBundle('bad-date', bundle);

      const result = validateDataBundle('bad-date', TMP_DIR);
      // Invalid date is unparseable, so no expiration warning is emitted
      expect(result.issues.some((i) => i.message.includes('expire'))).toBe(false);
      expect(result.issues.some((i) => i.message.includes('expired'))).toBe(false);
    });

    it('picks earliest end_date among multiple services', () => {
      const bundle = makeValidBundle({
        calendar: {
          v: 1,
          data: {
            services: [
              { i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20240101', e: '20240301' },
              { i: 'test:SVC2', d: [0, 0, 0, 0, 0, 1, 1], s: '20260101', e: '20261231' },
            ],
            exceptions: [],
          },
        },
      });
      writeBundle('mixed-cal', bundle);

      const result = validateDataBundle('mixed-cal', TMP_DIR);
      // Should warn about the expired service (20240301)
      expect(result.issues.some((i) => i.level === 'warn' && i.message.includes('expired'))).toBe(
        true,
      );
    });
  });

  describe('stop coordinate range', () => {
    it('reports error for lat out of range', () => {
      const bundle = makeValidBundle({
        stops: { v: 2, data: [{ v: 2, i: 'test:S1', n: 'Bad', a: 91, o: 139.76, l: 0 }] },
      });
      writeBundle('bad-lat', bundle);

      const result = validateDataBundle('bad-lat', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lat'))).toBe(
        true,
      );
    });

    it('reports error for negative lat out of range', () => {
      const bundle = makeValidBundle({
        stops: { v: 2, data: [{ v: 2, i: 'test:S1', n: 'Bad', a: -91, o: 139.76, l: 0 }] },
      });
      writeBundle('bad-neg-lat', bundle);

      const result = validateDataBundle('bad-neg-lat', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lat'))).toBe(
        true,
      );
    });

    it('reports error for lon out of range', () => {
      const bundle = makeValidBundle({
        stops: { v: 2, data: [{ v: 2, i: 'test:S1', n: 'Bad', a: 35.68, o: 181, l: 0 }] },
      });
      writeBundle('bad-lon', bundle);

      const result = validateDataBundle('bad-lon', TMP_DIR);
      expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lon'))).toBe(
        true,
      );
    });

    it('accepts valid edge coordinates', () => {
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:S1', n: 'Edge1', a: -90, o: -180, l: 0 },
            { v: 2, i: 'test:S2', n: 'Edge2', a: 90, o: 180, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:S1' }, { id: 'test:S2' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              { v: 2, tp: 'test:P1', si: 0, d: { 'test:SVC1': [480] }, a: { 'test:SVC1': [480] } },
            ],
          },
        },
      });
      writeBundle('edge-coords', bundle);

      const result = validateDataBundle('edge-coords', TMP_DIR);
      expect(
        result.issues.filter((i) => i.message.includes('lat') || i.message.includes('lon')),
      ).toHaveLength(0);
    });
  });

  describe('referential integrity: tripPatterns → routes/stops', () => {
    it('reports error when tripPattern references nonexistent route', () => {
      const bundle = makeValidBundle({
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': { v: 2, r: 'test:R_MISSING', h: 'Terminal', stops: [{ id: 'test:S1' }] },
          },
        },
      });
      writeBundle('bad-route-ref', bundle);

      const result = validateDataBundle('bad-route-ref', TMP_DIR);
      expect(
        result.issues.some(
          (i) =>
            i.level === 'error' && i.message.includes('route') && i.message.includes('R_MISSING'),
        ),
      ).toBe(true);
    });

    it('reports error when tripPattern references nonexistent stop', () => {
      const bundle = makeValidBundle({
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': { v: 2, r: 'test:R1', h: 'Terminal', stops: [{ id: 'test:S_MISSING' }] },
          },
        },
      });
      writeBundle('bad-stop-ref', bundle);

      const result = validateDataBundle('bad-stop-ref', TMP_DIR);
      expect(
        result.issues.some(
          (i) =>
            i.level === 'error' && i.message.includes('stop') && i.message.includes('S_MISSING'),
        ),
      ).toBe(true);
    });
  });

  describe('referential integrity: timetable → tripPatterns', () => {
    it('reports error when timetable references nonexistent tripPattern', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P_MISSING',
                si: 0,
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480] },
              },
            ],
          },
        },
      });
      writeBundle('bad-tp-ref', bundle);

      const result = validateDataBundle('bad-tp-ref', TMP_DIR);
      expect(
        result.issues.some(
          (i) =>
            i.level === 'error' &&
            i.message.includes('tripPattern') &&
            i.message.includes('P_MISSING'),
        ),
      ).toBe(true);
    });
  });

  describe('timetable d/a array length consistency', () => {
    it('reports error when d and a have different lengths', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480, 540] },
                a: { 'test:SVC1': [480] },
              },
            ],
          },
        },
      });
      writeBundle('da-mismatch', bundle);

      const result = validateDataBundle('da-mismatch', TMP_DIR);
      expect(
        result.issues.some(
          (i) =>
            i.level === 'error' && i.message.includes('d.length') && i.message.includes('a.length'),
        ),
      ).toBe(true);
    });

    it('reports error when d has service_id but a does not', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480], 'test:SVC2': [600] },
                a: { 'test:SVC1': [480] },
              },
            ],
          },
        },
      });
      writeBundle('missing-a-sid', bundle);

      const result = validateDataBundle('missing-a-sid', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('no arrivals')),
      ).toBe(true);
    });

    it('reports error when a has service_id but d does not (= symmetric to d-only)', () => {
      // a[sid] without d[sid] is the same kind of anomaly as the inverse.
      // Builders always populate d and a together; a single-sided entry
      // is a regression sign and must be flagged.
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480], 'test:SVC2': [600] },
              },
            ],
          },
        },
      });
      writeBundle('missing-d-sid', bundle);

      const result = validateDataBundle('missing-d-sid', TMP_DIR);
      expect(
        result.issues.some(
          (i) => i.level === 'error' && i.message.includes('has arrivals but no departures'),
        ),
      ).toBe(true);
    });

    it('passes when d and a have matching lengths', () => {
      writeBundle('da-ok', makeValidBundle());

      const result = validateDataBundle('da-ok', TMP_DIR);
      expect(
        result.issues.filter(
          (i) => i.message.includes('d.length') || i.message.includes('arrivals'),
        ),
      ).toHaveLength(0);
    });
  });

  describe('counts', () => {
    it('counts stops, routes, services, patterns, and timetable stops correctly', () => {
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:S1', n: 'Stop 1', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:S2', n: 'Stop 2', a: 35.69, o: 139.77, l: 0 },
            { v: 2, i: 'test:S3', n: 'Stop 3', a: 35.7, o: 139.78, l: 0 },
          ],
        },
        routes: {
          v: 2,
          data: [
            {
              v: 2,
              i: 'test:R1',
              s: 'R1',
              l: 'Route 1',
              t: 3,
              c: 'FF0000',
              tc: 'FFFFFF',
              ai: 'test:A1',
            },
            {
              v: 2,
              i: 'test:R2',
              s: 'R2',
              l: 'Route 2',
              t: 3,
              c: '00FF00',
              tc: '000000',
              ai: 'test:A1',
            },
          ],
        },
        calendar: {
          v: 1,
          data: {
            services: [
              { i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20261231' },
              { i: 'test:SVC2', d: [0, 0, 0, 0, 0, 1, 1], s: '20260101', e: '20261231' },
            ],
            exceptions: [],
          },
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal A',
              stops: [{ id: 'test:S1' }, { id: 'test:S2' }],
            },
            'test:P2': {
              v: 2,
              r: 'test:R2',
              h: 'Terminal B',
              stops: [{ id: 'test:S2' }, { id: 'test:S3' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              { v: 2, tp: 'test:P1', si: 0, d: { 'test:SVC1': [480] }, a: { 'test:SVC1': [480] } },
            ],
            'test:S2': [
              // test:S2 is at index 1 in P1 ([S1, S2]) and index 0 in P2 ([S2, S3])
              { v: 2, tp: 'test:P1', si: 1, d: { 'test:SVC1': [485] }, a: { 'test:SVC1': [485] } },
              { v: 2, tp: 'test:P2', si: 0, d: { 'test:SVC1': [490] }, a: { 'test:SVC1': [490] } },
            ],
          },
        },
      });
      writeBundle('counts', bundle);

      const result = validateDataBundle('counts', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.stopCount).toBe(3);
      expect(result.routeCount).toBe(2);
      expect(result.serviceCount).toBe(2);
      expect(result.patternCount).toBe(2);
      expect(result.timetableStopCount).toBe(2);
    });
  });

  describe('multiple issues', () => {
    it('detects coordinate error and referential error simultaneously', () => {
      const bundle = makeValidBundle({
        stops: { v: 2, data: [{ v: 2, i: 'test:S1', n: 'Bad', a: 91, o: 139.76, l: 0 }] },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': { v: 2, r: 'test:R_MISSING', h: 'Terminal', stops: [{ id: 'test:S1' }] },
          },
        },
      });
      writeBundle('multi-issue', bundle);

      const result = validateDataBundle('multi-issue', TMP_DIR);
      const latError = result.issues.find((i) => i.message.includes('lat'));
      const refError = result.issues.find((i) => i.message.includes('route'));
      expect(latError).toBeDefined();
      expect(refError).toBeDefined();
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Issue #47: si validation
  // ---------------------------------------------------------------------------
  describe('si validation (Issue #47)', () => {
    it('rejects negative si', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: -1,
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480] },
              },
            ],
          },
        },
      });
      writeBundle('neg-si', bundle);
      const result = validateDataBundle('neg-si', TMP_DIR);
      const siError = result.issues.find((i) => i.message.includes('si must be a non-negative'));
      expect(siError).toBeDefined();
    });

    it('rejects si >= pattern.stops.length', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 5, // pattern only has 1 stop
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480] },
              },
            ],
          },
        },
      });
      writeBundle('out-of-range', bundle);
      const result = validateDataBundle('out-of-range', TMP_DIR);
      const siError = result.issues.find((i) => i.message.includes('out of range'));
      expect(siError).toBeDefined();
    });

    it('rejects si pointing to wrong stop_id', () => {
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:S1', n: 'A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:S2', n: 'B', a: 35.69, o: 139.77, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:S1' }, { id: 'test:S2' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            // S2 is at index 1, but we wrongly say si=0 (which points to S1)
            'test:S2': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [490] },
                a: { 'test:SVC1': [490] },
              },
            ],
          },
        },
      });
      writeBundle('wrong-stop', bundle);
      const result = validateDataBundle('wrong-stop', TMP_DIR);
      const siError = result.issues.find((i) =>
        i.message.includes('points to "test:S1" in pattern'),
      );
      expect(siError).toBeDefined();
    });

    it('rejects duplicate (stop_id, tp, si) triple', () => {
      const bundle = makeValidBundle({
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480] },
              },
              // Duplicate (stop, tp, si)
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [540] },
                a: { 'test:SVC1': [540] },
              },
            ],
          },
        },
      });
      writeBundle('dup-triple', bundle);
      const result = validateDataBundle('dup-triple', TMP_DIR);
      const dupError = result.issues.find((i) => i.message.includes('duplicate (tp, si)'));
      expect(dupError).toBeDefined();
    });

    it('accepts multiple groups with same (stop_id, tp) but different si', () => {
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:S1', n: 'A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:S2', n: 'B', a: 35.69, o: 139.77, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            // Circular: S1 → S2 → S1 (S1 at indices 0 and 2)
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:S1' }, { id: 'test:S2' }, { id: 'test:S1' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0, // origin
                d: { 'test:SVC1': [480] },
                a: { 'test:SVC1': [480] },
              },
              {
                v: 2,
                tp: 'test:P1',
                si: 2, // terminal arrival
                d: { 'test:SVC1': [500] },
                a: { 'test:SVC1': [500] },
              },
            ],
            'test:S2': [
              {
                v: 2,
                tp: 'test:P1',
                si: 1,
                d: { 'test:SVC1': [490] },
                a: { 'test:SVC1': [490] },
              },
            ],
          },
        },
      });
      writeBundle('valid-circular', bundle);
      const result = validateDataBundle('valid-circular', TMP_DIR);
      const siErrors = result.issues.filter(
        (i) =>
          i.message.includes('si ') ||
          i.message.includes('duplicate (tp, si)') ||
          i.message.includes('out of range'),
      );
      expect(siErrors).toHaveLength(0);
    });
  });

  describe('cross-group d/a length consistency (Issue #156)', () => {
    /**
     * Build a 3-stop pattern with one timetable group per stop, one
     * service. Defaults give a uniform-length bundle; overrides per stop
     * let each test inject specific d/a arrays for the mismatch fixtures.
     */
    function buildBundleWithThreeStops(perStop: {
      A: { d: number[]; a: number[] };
      B: { d: number[]; a: number[] };
      C: { d: number[]; a: number[] };
    }): DataBundle {
      return makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:SA', n: 'Stop A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:SB', n: 'Stop B', a: 35.69, o: 139.77, l: 0 },
            { v: 2, i: 'test:SC', n: 'Stop C', a: 35.7, o: 139.78, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:SA' }, { id: 'test:SB' }, { id: 'test:SC' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:SA': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': perStop.A.d },
                a: { 'test:SVC1': perStop.A.a },
              },
            ],
            'test:SB': [
              {
                v: 2,
                tp: 'test:P1',
                si: 1,
                d: { 'test:SVC1': perStop.B.d },
                a: { 'test:SVC1': perStop.B.a },
              },
            ],
            'test:SC': [
              {
                v: 2,
                tp: 'test:P1',
                si: 2,
                d: { 'test:SVC1': perStop.C.d },
                a: { 'test:SVC1': perStop.C.a },
              },
            ],
          },
        },
      });
    }

    it('#1: accepts uniform d.length / a.length across emitted groups', () => {
      const bundle = buildBundleWithThreeStops({
        A: { d: [480, 540, 600], a: [480, 540, 600] },
        B: { d: [482, 542, 602], a: [482, 542, 602] },
        C: { d: [484, 544, 604], a: [484, 544, 604] },
      });
      writeBundle('cgl-uniform', bundle);
      const result = validateDataBundle('cgl-uniform', TMP_DIR);
      const crossGroupIssues = result.issues.filter((i) =>
        i.message.includes('differs across emitted groups'),
      );
      expect(crossGroupIssues).toHaveLength(0);
    });

    it('#2: flags d.length mismatch with patternId / serviceId / example stops', () => {
      const bundle = buildBundleWithThreeStops({
        A: { d: [480, 540, 600], a: [480, 540, 600] },
        B: { d: [482, 542], a: [482, 542] }, // shorter
        C: { d: [484, 544, 604], a: [484, 544, 604] },
      });
      writeBundle('cgl-d-mismatch', bundle);
      const result = validateDataBundle('cgl-d-mismatch', TMP_DIR);
      const dErrors = result.issues.filter(
        (i) => i.message.includes('d.length differs across emitted groups') && i.level === 'error',
      );
      expect(dErrors).toHaveLength(1);
      // Message must identify pattern, service, both differing lengths, and example labels.
      const m = dErrors[0].message;
      expect(m).toContain('test:P1');
      expect(m).toContain('test:SVC1');
      expect(m).toContain('2');
      expect(m).toContain('3');
      // Example labels combine stopId and si (= disambiguates circular patterns).
      expect(m).toMatch(/test:S[ABC]@si=\d+/);
    });

    it('#3: flags a.length mismatch independently of d', () => {
      const bundle = buildBundleWithThreeStops({
        // d is uniform across all stops; only a differs at stop B.
        A: { d: [480, 540, 600], a: [480, 540, 600] },
        B: { d: [482, 542, 602], a: [482, 542] },
        C: { d: [484, 544, 604], a: [484, 544, 604] },
      });
      writeBundle('cgl-a-mismatch', bundle);
      const result = validateDataBundle('cgl-a-mismatch', TMP_DIR);
      const aErrors = result.issues.filter(
        (i) => i.message.includes('a.length differs across emitted groups') && i.level === 'error',
      );
      const dErrors = result.issues.filter((i) =>
        i.message.includes('d.length differs across emitted groups'),
      );
      expect(aErrors).toHaveLength(1);
      expect(dErrors).toHaveLength(0);
      expect(aErrors[0].message).toContain('test:P1');
      expect(aErrors[0].message).toContain('test:SVC1');
    });

    it('#4: accepts pattern with stops missing a timetable group', () => {
      // Pattern has 3 stops in `pattern.stops`, but only 2 of them have an
      // emitted timetable group. The two emitted groups agree on length;
      // the missing third stop must NOT trigger any cross-group issue.
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:SA', n: 'Stop A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:SB', n: 'Stop B', a: 35.69, o: 139.77, l: 0 },
            { v: 2, i: 'test:SC', n: 'Stop C', a: 35.7, o: 139.78, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:SA' }, { id: 'test:SB' }, { id: 'test:SC' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:SA': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480, 540] },
                a: { 'test:SVC1': [480, 540] },
              },
            ],
            // test:SB omitted on purpose (= ODPT-style sparse pattern).
            'test:SC': [
              {
                v: 2,
                tp: 'test:P1',
                si: 2,
                d: { 'test:SVC1': [484, 544] },
                a: { 'test:SVC1': [484, 544] },
              },
            ],
          },
        },
      });
      writeBundle('cgl-missing-group', bundle);
      const result = validateDataBundle('cgl-missing-group', TMP_DIR);
      const crossGroupIssues = result.issues.filter((i) =>
        i.message.includes('differs across emitted groups'),
      );
      expect(crossGroupIssues).toHaveLength(0);
    });

    it('#5: does not require all groups to share the same set of serviceIds', () => {
      // Stop A has both svc1 and svc2; stop B has only svc1. svc1 length
      // matches between A and B. The validator must NOT fail on the svc2
      // partial coverage — that is a different invariant (out of scope).
      const bundle = makeValidBundle({
        calendar: {
          v: 1,
          data: {
            services: [
              { i: 'test:SVC1', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20261231' },
              { i: 'test:SVC2', d: [0, 0, 0, 0, 0, 1, 1], s: '20260101', e: '20261231' },
            ],
            exceptions: [],
          },
        },
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:SA', n: 'Stop A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:SB', n: 'Stop B', a: 35.69, o: 139.77, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:SA' }, { id: 'test:SB' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:SA': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480, 540], 'test:SVC2': [600] },
                a: { 'test:SVC1': [480, 540], 'test:SVC2': [600] },
              },
            ],
            'test:SB': [
              {
                v: 2,
                tp: 'test:P1',
                si: 1,
                d: { 'test:SVC1': [482, 542] },
                a: { 'test:SVC1': [482, 542] },
              },
            ],
          },
        },
      });
      writeBundle('cgl-partial-svc', bundle);
      const result = validateDataBundle('cgl-partial-svc', TMP_DIR);
      const crossGroupIssues = result.issues.filter((i) =>
        i.message.includes('differs across emitted groups'),
      );
      expect(crossGroupIssues).toHaveLength(0);
    });

    it('#6: flags mismatch on a-only serviceId (= union keyset behavior)', () => {
      // sidA appears only in `a`, never in `d`. The cross-group validator
      // must still examine sidA for `a.length` consistency: stop A has 3
      // arrivals, stop B has 2 — that is a mismatch.
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:SA', n: 'Stop A', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:SB', n: 'Stop B', a: 35.69, o: 139.77, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              stops: [{ id: 'test:SA' }, { id: 'test:SB' }],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:SA': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: {},
                a: { 'test:SVC1': [480, 540, 600] },
              },
            ],
            'test:SB': [
              {
                v: 2,
                tp: 'test:P1',
                si: 1,
                d: {},
                a: { 'test:SVC1': [482, 542] },
              },
            ],
          },
        },
      });
      writeBundle('cgl-a-only-svc', bundle);
      const result = validateDataBundle('cgl-a-only-svc', TMP_DIR);
      const aErrors = result.issues.filter(
        (i) => i.message.includes('a.length differs across emitted groups') && i.level === 'error',
      );
      expect(aErrors).toHaveLength(1);
      expect(aErrors[0].message).toContain('test:P1');
      expect(aErrors[0].message).toContain('test:SVC1');
    });

    it('#7: disambiguates circular pattern via si in example labels', () => {
      // Circular / 6-shape pattern: same stopId at two si positions in
      // pattern.stops. The two emitted groups for that stopId can have
      // different lengths (different visits of a loop). Without si, the
      // error message would list `test:SLoop` under both lengths and be
      // ambiguous. The label `${stopId}@si=N` disambiguates them.
      const bundle = makeValidBundle({
        stops: {
          v: 2,
          data: [
            { v: 2, i: 'test:SA', n: 'Stop A (start)', a: 35.68, o: 139.76, l: 0 },
            { v: 2, i: 'test:SLoop', n: 'Stop Loop (visited twice)', a: 35.69, o: 139.77, l: 0 },
            { v: 2, i: 'test:SC', n: 'Stop C (terminal)', a: 35.7, o: 139.78, l: 0 },
          ],
        },
        tripPatterns: {
          v: 2,
          data: {
            'test:P1': {
              v: 2,
              r: 'test:R1',
              h: 'Terminal',
              // SA -> SLoop -> SC -> SLoop (= circular: SLoop visited at si=1 and si=3)
              stops: [
                { id: 'test:SA' },
                { id: 'test:SLoop' },
                { id: 'test:SC' },
                { id: 'test:SLoop' },
              ],
            },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:SA': [
              {
                v: 2,
                tp: 'test:P1',
                si: 0,
                d: { 'test:SVC1': [480, 540, 600] },
                a: { 'test:SVC1': [480, 540, 600] },
              },
            ],
            'test:SLoop': [
              // First visit (si=1) emits 3 entries.
              {
                v: 2,
                tp: 'test:P1',
                si: 1,
                d: { 'test:SVC1': [482, 542, 602] },
                a: { 'test:SVC1': [482, 542, 602] },
              },
              // Second visit (si=3) emits only 2 entries — length mismatch.
              {
                v: 2,
                tp: 'test:P1',
                si: 3,
                d: { 'test:SVC1': [486, 546] },
                a: { 'test:SVC1': [486, 546] },
              },
            ],
            'test:SC': [
              {
                v: 2,
                tp: 'test:P1',
                si: 2,
                d: { 'test:SVC1': [484, 544, 604] },
                a: { 'test:SVC1': [484, 544, 604] },
              },
            ],
          },
        },
      });
      writeBundle('cgl-circular', bundle);
      const result = validateDataBundle('cgl-circular', TMP_DIR);
      const dErrors = result.issues.filter(
        (i) => i.message.includes('d.length differs across emitted groups') && i.level === 'error',
      );
      expect(dErrors).toHaveLength(1);
      const m = dErrors[0].message;
      // Both si positions of test:SLoop must be unambiguously identifiable.
      expect(m).toContain('test:SLoop@si=1');
      expect(m).toContain('test:SLoop@si=3');
      // Both differing lengths (3 and 2) appear.
      expect(m).toContain('2');
      expect(m).toContain('3');
    });
  });
});
