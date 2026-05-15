/**
 * Tests for validate-data-source-catalog.ts.
 *
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateDataSourceCatalogBundle } from '../validate-data-source-catalog';

const TMP_DIR = join(import.meta.dirname, '.tmp-validate-data-source-catalog-test');
const GLOBAL_DIR = join(TMP_DIR, 'global');

function writeCatalog(data: unknown): void {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(join(GLOBAL_DIR, 'data-source-catalog.json'), JSON.stringify(data));
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validateDataSourceCatalogBundle', () => {
  it('returns error when file does not exist', () => {
    const result = validateDataSourceCatalogBundle(TMP_DIR);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('error');
    expect(result.issues[0].message).toContain('not found');
    expect(result.sourceCount).toBe(0);
  });

  it('returns error on invalid JSON', () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    writeFileSync(join(GLOBAL_DIR, 'data-source-catalog.json'), '{invalid');

    const result = validateDataSourceCatalogBundle(TMP_DIR);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe('error');
    expect(result.issues[0].message).toContain('Failed to parse');
  });

  it('detects invalid bundle_version and kind', () => {
    writeCatalog({
      bundle_version: 1,
      kind: 'wrong-kind',
      metadata: { v: 1, data: { createdAt: '2026-05-15T00:00:00.000Z' } },
      sources: { v: 1, data: {} },
      globalInsights: {
        v: 1,
        data: { file: { sizeBytes: 0 }, counts: { stopGeo: 0 } },
      },
    });

    const result = validateDataSourceCatalogBundle(TMP_DIR);

    expect(result.issues.some((i) => i.message.includes('bundle_version'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('Invalid kind'))).toBe(true);
  });

  it('validates a minimal valid DataSourceCatalogBundle', () => {
    writeCatalog({
      bundle_version: 3,
      kind: 'data-source-catalog',
      metadata: { v: 1, data: { createdAt: '2026-05-15T00:00:00.000Z' } },
      sources: { v: 1, data: {} },
      globalInsights: {
        v: 1,
        data: { file: { sizeBytes: 0 }, counts: { stopGeo: 0 } },
      },
    });

    const result = validateDataSourceCatalogBundle(TMP_DIR);

    expect(result.issues).toHaveLength(0);
    expect(result.sourceCount).toBe(0);
  });
});
