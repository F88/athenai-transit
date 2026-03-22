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
});
