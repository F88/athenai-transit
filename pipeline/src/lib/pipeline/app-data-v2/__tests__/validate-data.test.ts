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
    bundle_version: 2,
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
      v: 1,
      data: [
        {
          i: 'test:A1',
          n: 'Test Agency',
          sn: 'Test',
          u: 'https://example.com',
          l: 'ja',
          tz: 'Asia/Tokyo',
          fu: '',
          cs: [{ b: 'FF0000', t: 'FFFFFF' }],
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
            d: { 'test:SVC1': [480] },
            a: { 'test:SVC1': [480] },
          },
        ],
      },
    },
    tripPatterns: {
      v: 2,
      data: {
        'test:P1': { v: 2, r: 'test:R1', h: 'Terminal', stops: ['test:S1'] },
      },
    },
    translations: {
      v: 1,
      data: {
        headsigns: {},
        stop_headsigns: {},
        stop_names: {},
        route_names: {},
        agency_names: {},
        agency_short_names: {},
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
            'test:P1': { v: 2, r: 'test:R1', h: 'Terminal', stops: ['test:S1', 'test:S2'] },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              { v: 2, tp: 'test:P1', d: { 'test:SVC1': [480] }, a: { 'test:SVC1': [480] } },
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
            'test:P1': { v: 2, r: 'test:R_MISSING', h: 'Terminal', stops: ['test:S1'] },
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
            'test:P1': { v: 2, r: 'test:R1', h: 'Terminal', stops: ['test:S_MISSING'] },
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
            'test:P1': { v: 2, r: 'test:R1', h: 'Terminal A', stops: ['test:S1', 'test:S2'] },
            'test:P2': { v: 2, r: 'test:R2', h: 'Terminal B', stops: ['test:S2', 'test:S3'] },
          },
        },
        timetable: {
          v: 2,
          data: {
            'test:S1': [
              { v: 2, tp: 'test:P1', d: { 'test:SVC1': [480] }, a: { 'test:SVC1': [480] } },
            ],
            'test:S2': [
              { v: 2, tp: 'test:P1', d: { 'test:SVC1': [485] }, a: { 'test:SVC1': [485] } },
              { v: 2, tp: 'test:P2', d: { 'test:SVC1': [490] }, a: { 'test:SVC1': [490] } },
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
            'test:P1': { v: 2, r: 'test:R_MISSING', h: 'Terminal', stops: ['test:S1'] },
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
});
