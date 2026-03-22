/**
 * Tests for validate-insights.ts validateInsightsBundle function.
 *
 * Creates temporary InsightsBundle files and validates them,
 * verifying correct detection of structural issues.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { InsightsBundle } from '../../../../../../src/types/data/transit-v2-json';
import { validateInsightsBundle } from '../validate-insights';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-insights-test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeBundle(prefix: string, bundle: unknown): void {
  const dir = join(TMP_DIR, prefix);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'insights.json'), JSON.stringify(bundle));
}

function makeValidBundle(): InsightsBundle {
  return {
    bundle_version: 2,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [{ key: 'wd', serviceIds: ['test:SVC1'] }],
    },
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateInsightsBundle', () => {
  describe('file and structure checks', () => {
    it('reports error when insights.json does not exist', () => {
      const result = validateInsightsBundle('nonexistent', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('not found');
    });

    it('reports error for invalid JSON', () => {
      const dir = join(TMP_DIR, 'bad-json');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'insights.json'), '{invalid json');

      const result = validateInsightsBundle('bad-json', TMP_DIR);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].level).toBe('error');
      expect(result.issues[0].message).toContain('Failed to parse');
    });

    it('reports error for wrong bundle_version', () => {
      writeBundle('bad-ver', { ...makeValidBundle(), bundle_version: 1 });
      const result = validateInsightsBundle('bad-ver', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('bundle_version'))).toBe(true);
    });

    it('reports error for wrong kind', () => {
      writeBundle('bad-kind', { ...makeValidBundle(), kind: 'data' });
      const result = validateInsightsBundle('bad-kind', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('kind'))).toBe(true);
    });

    it('passes for a valid bundle', () => {
      writeBundle('valid', makeValidBundle());

      const result = validateInsightsBundle('valid', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.serviceGroupCount).toBe(1);
    });
  });

  describe('serviceGroups section', () => {
    it('reports error when serviceGroups is missing', () => {
      const bundle = { bundle_version: 2, kind: 'insights' };
      writeBundle('no-sg', bundle);

      const result = validateInsightsBundle('no-sg', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('serviceGroups')),
      ).toBe(true);
    });

    it('reports error for wrong serviceGroups.v', () => {
      const bundle = makeValidBundle();
      (bundle.serviceGroups as unknown as Record<string, unknown>).v = 2;
      writeBundle('bad-sg-v', bundle);

      const result = validateInsightsBundle('bad-sg-v', TMP_DIR);
      expect(
        result.issues.some(
          (i) => i.message.includes('serviceGroups.v') && i.message.includes('expected 1'),
        ),
      ).toBe(true);
    });

    it('reports error when serviceGroups.data is not an array', () => {
      const bundle = {
        bundle_version: 2,
        kind: 'insights',
        serviceGroups: { v: 1, data: { wd: ['test:SVC1'] } },
      };
      writeBundle('bad-sg-data', bundle);

      const result = validateInsightsBundle('bad-sg-data', TMP_DIR);
      expect(
        result.issues.some((i) => i.level === 'error' && i.message.includes('serviceGroups.data')),
      ).toBe(true);
      expect(result.serviceGroupCount).toBe(0);
    });

    it('counts service groups correctly', () => {
      const bundle: InsightsBundle = {
        bundle_version: 2,
        kind: 'insights',
        serviceGroups: {
          v: 1,
          data: [
            { key: 'wd', serviceIds: ['test:SVC1'] },
            { key: 'sa', serviceIds: ['test:SVC2'] },
            { key: 'su', serviceIds: ['test:SVC3'] },
          ],
        },
      };
      writeBundle('multi-sg', bundle);

      const result = validateInsightsBundle('multi-sg', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.serviceGroupCount).toBe(3);
    });
  });

  describe('optional sections', () => {
    it('passes for valid tripPatternGeo section', () => {
      const bundle: InsightsBundle = {
        ...makeValidBundle(),
        tripPatternGeo: {
          v: 1,
          data: { p1: { dist: 5.0, pathDist: 6.5, cl: false } },
        },
      };
      writeBundle('valid-geo', bundle);

      const result = validateInsightsBundle('valid-geo', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.tripPatternGeoCount).toBe(1);
    });

    it('reports error for wrong tripPatternGeo.v', () => {
      const bundle = {
        ...makeValidBundle(),
        tripPatternGeo: { v: 2, data: {} },
      };
      writeBundle('bad-geo-v', bundle);

      const result = validateInsightsBundle('bad-geo-v', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('tripPatternGeo.v'))).toBe(true);
    });

    it('reports error when tripPatternGeo.data is not a record', () => {
      const bundle = {
        ...makeValidBundle(),
        tripPatternGeo: { v: 1, data: [1, 2, 3] },
      };
      writeBundle('bad-geo-data', bundle);

      const result = validateInsightsBundle('bad-geo-data', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('tripPatternGeo.data'))).toBe(true);
    });

    it('passes for valid tripPatternStats section', () => {
      const bundle: InsightsBundle = {
        ...makeValidBundle(),
        tripPatternStats: {
          v: 1,
          data: { wd: { p1: { freq: 10, rd: [20, 10, 0] } } },
        },
      };
      writeBundle('valid-stats', bundle);

      const result = validateInsightsBundle('valid-stats', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.tripPatternStatsGroupCount).toBe(1);
    });

    it('reports error for wrong tripPatternStats.v', () => {
      const bundle = {
        ...makeValidBundle(),
        tripPatternStats: { v: 2, data: {} },
      };
      writeBundle('bad-stats-v', bundle);

      const result = validateInsightsBundle('bad-stats-v', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('tripPatternStats.v'))).toBe(true);
    });

    it('reports error when tripPatternStats.data is not a record', () => {
      const bundle = {
        ...makeValidBundle(),
        tripPatternStats: { v: 1, data: [1, 2, 3] },
      };
      writeBundle('bad-stats-data', bundle);

      const result = validateInsightsBundle('bad-stats-data', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('tripPatternStats.data'))).toBe(true);
    });

    it('passes for valid stopStats section', () => {
      const bundle: InsightsBundle = {
        ...makeValidBundle(),
        stopStats: {
          v: 1,
          data: { wd: { s1: { freq: 15, rc: 2, rtc: 1, ed: 360, ld: 1380 } } },
        },
      };
      writeBundle('valid-ss', bundle);

      const result = validateInsightsBundle('valid-ss', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.stopStatsGroupCount).toBe(1);
    });

    it('reports error for wrong stopStats.v', () => {
      const bundle = {
        ...makeValidBundle(),
        stopStats: { v: 2, data: {} },
      };
      writeBundle('bad-ss-v', bundle);

      const result = validateInsightsBundle('bad-ss-v', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('stopStats.v'))).toBe(true);
    });

    it('reports error when stopStats.data is not a record', () => {
      const bundle = {
        ...makeValidBundle(),
        stopStats: { v: 1, data: [1, 2, 3] },
      };
      writeBundle('bad-ss-data', bundle);

      const result = validateInsightsBundle('bad-ss-data', TMP_DIR);
      expect(result.issues.some((i) => i.message.includes('stopStats.data'))).toBe(true);
    });

    it('returns zero counts when optional sections are absent', () => {
      writeBundle('no-optional', makeValidBundle());

      const result = validateInsightsBundle('no-optional', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.tripPatternGeoCount).toBe(0);
      expect(result.tripPatternStatsGroupCount).toBe(0);
      expect(result.stopStatsGroupCount).toBe(0);
    });

    it('passes for bundle with all optional sections', () => {
      const bundle: InsightsBundle = {
        ...makeValidBundle(),
        tripPatternGeo: {
          v: 1,
          data: { p1: { dist: 1.0, pathDist: 1.5, cl: false } },
        },
        tripPatternStats: {
          v: 1,
          data: { wd: { p1: { freq: 5, rd: [10, 0] } } },
        },
        stopStats: {
          v: 1,
          data: { wd: { s1: { freq: 5, rc: 1, rtc: 1, ed: 480, ld: 1080 } } },
        },
      };
      writeBundle('all-optional', bundle);

      const result = validateInsightsBundle('all-optional', TMP_DIR);
      expect(result.issues).toHaveLength(0);
      expect(result.tripPatternGeoCount).toBe(1);
      expect(result.tripPatternStatsGroupCount).toBe(1);
      expect(result.stopStatsGroupCount).toBe(1);
    });
  });
});
