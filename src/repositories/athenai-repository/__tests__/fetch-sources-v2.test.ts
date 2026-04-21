import { describe, expect, it } from 'vitest';
import type { TransitDataSourceV2 } from '../../../datasources/transit-data-source-v2';
import { fetchSourcesV2 } from '../fetch-sources-v2';
import { createFixtureV2, TestDataSourceV2 } from './fixtures/test-data-source-v2';

describe('fetchSourcesV2', () => {
  it('loads all requested sources and reports them as loaded', async () => {
    const fixture = createFixtureV2();
    const dataSource = new TestDataSourceV2({
      alpha: { ...fixture, prefix: 'alpha' },
      beta: { ...fixture, prefix: 'beta' },
    });

    const result = await fetchSourcesV2(['alpha', 'beta'], dataSource);

    expect(result.sources.map((source) => source.prefix)).toEqual(['alpha', 'beta']);
    expect(result.loadResult.loaded).toEqual(['alpha', 'beta']);
    expect(result.loadResult.failed).toEqual([]);
  });

  it('keeps successful sources when another source fails', async () => {
    const fixture = createFixtureV2();
    const dataSource = new TestDataSourceV2({ alpha: { ...fixture, prefix: 'alpha' } });

    const result = await fetchSourcesV2(['alpha', 'missing'], dataSource);

    expect(result.sources.map((source) => source.prefix)).toEqual(['alpha']);
    expect(result.loadResult.loaded).toEqual(['alpha']);
    expect(result.loadResult.failed).toHaveLength(1);
    expect(result.loadResult.failed[0].prefix).toBe('missing');
    expect(result.loadResult.failed[0].error).toBeInstanceOf(Error);
  });

  it('reports thrown load errors as failures', async () => {
    const fixture = createFixtureV2();
    const dataSource: TransitDataSourceV2 = {
      loadData(prefix) {
        if (prefix === 'alpha') {
          return Promise.resolve({ ...fixture, prefix });
        }
        return Promise.reject(new Error('boom'));
      },
      loadShapes() {
        return Promise.resolve(null);
      },
      loadInsights() {
        return Promise.resolve(null);
      },
      loadGlobalInsights() {
        return Promise.resolve(null);
      },
    };

    const result = await fetchSourcesV2(['alpha', 'beta'], dataSource);

    expect(result.loadResult.failed).toHaveLength(1);
    expect(result.loadResult.failed[0].error).toBeInstanceOf(Error);
    expect(result.loadResult.failed[0].error.message).toBe('boom');
  });
});
