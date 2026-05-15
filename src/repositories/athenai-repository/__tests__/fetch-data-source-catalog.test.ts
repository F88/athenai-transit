import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';
import { describe, expect, it } from 'vitest';
import { fetchDataSourceCatalog } from '../fetch-data-source-catalog';
import { createFixtureV2, TestDataSourceV2 } from './fixtures/test-data-source-v2';

function makeCatalogFixture(): DataSourceCatalogBundle {
  return {
    bundle_version: 3,
    kind: 'data-source-catalog',
    metadata: { v: 1, data: { createdAt: '2026-05-15T00:00:00Z' } },
    sources: { v: 1, data: {} },
    globalInsights: {
      v: 1,
      data: { file: { sizeBytes: 0 }, counts: { stopGeo: 0 } },
    },
  };
}

describe('fetchDataSourceCatalog', () => {
  it('returns the catalog and elapsed time on success', async () => {
    const catalog = makeCatalogFixture();
    const fixture = createFixtureV2();
    const dataSource = new TestDataSourceV2({ test: fixture }, {}, {}, catalog);

    const result = await fetchDataSourceCatalog(dataSource);

    expect(result.catalog).toBe(catalog);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it('returns null catalog with elapsed time when the data source has no catalog', async () => {
    const fixture = createFixtureV2();
    const dataSource = new TestDataSourceV2({ test: fixture });

    const result = await fetchDataSourceCatalog(dataSource);

    expect(result.catalog).toBeNull();
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it('normalizes thrown errors (e.g. envelope mismatch) to null catalog', async () => {
    const envelopeError = new Error(
      'global/data-source-catalog.json: invalid bundle_version (expected 3, got 2)',
    );
    const fixture = createFixtureV2();
    const dataSource = new TestDataSourceV2({ test: fixture }, {}, {}, null, envelopeError);

    const result = await fetchDataSourceCatalog(dataSource);

    expect(result.catalog).toBeNull();
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });
});
