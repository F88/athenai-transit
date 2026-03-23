/**
 * Tests for validate-global-insights.ts.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateGlobalInsightsBundle } from '../validate-global-insights';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-global-insights-test');
const GLOBAL_DIR = join(TMP_DIR, 'global');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeGlobalInsights(data: unknown): void {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(join(GLOBAL_DIR, 'insights.json'), JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Setup / Teardown
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

describe('validateGlobalInsightsBundle', () => {
  it('returns warn when file does not exist', () => {
    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('warn');
    expect(result.issues[0].message).toContain('not found');
    expect(result.stopGeoCount).toBe(0);
  });

  it('returns error on invalid JSON', () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    writeFileSync(join(GLOBAL_DIR, 'insights.json'), '{invalid');

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('error');
    expect(result.issues[0].message).toContain('Failed to parse');
  });

  it('validates a valid GlobalInsightsBundle with stopGeo', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: {
        v: 1,
        data: {
          s1: { nr: 0.5 },
          s2: { nr: 0.3, wp: 0.1 },
          s3: { nr: 0, cn: { ho: { rc: 2, freq: 10, sc: 1 } } },
        },
      },
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues).toHaveLength(0);
    expect(result.stopGeoCount).toBe(3);
  });

  it('warns when stopGeo section is absent', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('warn');
    expect(result.issues[0].message).toContain('stopGeo section is not present');
    expect(result.stopGeoCount).toBe(0);
  });

  it('detects invalid bundle_version', () => {
    writeGlobalInsights({
      bundle_version: 1,
      kind: 'global-insights',
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('bundle_version'))).toBe(true);
  });

  it('detects invalid kind', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'insights',
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('kind'))).toBe(true);
  });

  it('detects invalid stopGeo.v', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: { v: 2, data: {} },
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('stopGeo.v'))).toBe(true);
  });

  it('detects stopGeo.data as array (invalid)', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: { v: 1, data: [] },
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('expected a record'))).toBe(true);
  });

  it('detects stopGeo as null (invalid)', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: null,
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('expected an object'))).toBe(true);
  });

  it('detects invalid nr type in stopGeo entry', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: {
        v: 1,
        data: {
          s1: { nr: 'not-a-number' },
        },
      },
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('nr: expected number'))).toBe(true);
  });

  it('detects JSON.parse returning null', () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    writeFileSync(join(GLOBAL_DIR, 'insights.json'), 'null');

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('expected an object'))).toBe(true);
  });

  it('detects null entry in stopGeo.data', () => {
    writeGlobalInsights({
      bundle_version: 2,
      kind: 'global-insights',
      stopGeo: {
        v: 1,
        data: {
          s1: null,
        },
      },
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('expected an object, got null'))).toBe(
      true,
    );
  });

  it('uses prefix "global" for all issues', () => {
    writeGlobalInsights({
      bundle_version: 1,
      kind: 'wrong',
    });

    const result = validateGlobalInsightsBundle(TMP_DIR);

    for (const issue of result.issues) {
      expect(issue.prefix).toBe('global');
    }
  });
});
