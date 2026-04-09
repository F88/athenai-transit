/**
 * Tests for validate-service-group-resolution.ts.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateServiceGroupResolution } from '../validate-service-group-resolution';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-service-group-resolution-test');

function writeBundles(prefix: string, dataBundle: unknown, insightsBundle: unknown): void {
  const dir = join(TMP_DIR, prefix);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'data.json'), JSON.stringify(dataBundle));
  writeFileSync(join(dir, 'insights.json'), JSON.stringify(insightsBundle));
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validateServiceGroupResolution', () => {
  it('reports unresolved active days as error', () => {
    writeBundles(
      'case-unresolved',
      {
        bundle_version: 2,
        kind: 'data',
        calendar: {
          v: 1,
          data: {
            services: [],
            exceptions: [{ i: 'svc-ex', d: '20260104', t: 1 }],
          },
        },
      },
      {
        bundle_version: 2,
        kind: 'insights',
        serviceGroups: {
          v: 1,
          data: [{ key: 'wd', serviceIds: ['svc-wd'] }],
        },
      },
    );

    const result = validateServiceGroupResolution('case-unresolved', TMP_DIR);

    expect(result.unresolvedDays).toBe(1);
    expect(result.checkedDays).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('error');
    expect(result.issues[0].message).toContain('service-group resolution failed');
  });

  it('passes when at least one group overlaps active service IDs', () => {
    writeBundles(
      'case-resolved',
      {
        bundle_version: 2,
        kind: 'data',
        calendar: {
          v: 1,
          data: {
            services: [
              {
                i: 'svc-wd',
                d: [1, 1, 1, 1, 1, 0, 0],
                s: '20260101',
                e: '20260131',
              },
            ],
            exceptions: [],
          },
        },
      },
      {
        bundle_version: 2,
        kind: 'insights',
        serviceGroups: {
          v: 1,
          data: [{ key: 'wd', serviceIds: ['svc-wd'] }],
        },
      },
    );

    const result = validateServiceGroupResolution('case-resolved', TMP_DIR);

    expect(result.unresolvedDays).toBe(0);
    expect(result.checkedDays).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });

  it('returns no issues when required files are missing', () => {
    const result = validateServiceGroupResolution('missing', TMP_DIR);
    expect(result.issues).toEqual([]);
    expect(result.checkedDays).toBe(0);
    expect(result.unresolvedDays).toBe(0);
  });
});
