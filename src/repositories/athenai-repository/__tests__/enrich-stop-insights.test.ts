import { describe, expect, it } from 'vitest';
import type { TransitDataSourceV2 } from '../../../datasources/transit-data-source-v2';
import type { GlobalInsightsBundle, InsightsBundle } from '../../../types/data/transit-v2-json';
import { mergeSourcesV2 } from '..';
import { enrichStopInsights } from '../enrich-stop-insights';
import type { StopInsightsEntry } from '../types';
import { createFixtureV2, createInsightsFixtureV2 } from './fixtures/test-data-source-v2';

function createDataSource(
  insights: InsightsBundle | null,
  globalInsights: GlobalInsightsBundle | null,
): TransitDataSourceV2 {
  return {
    loadData() {
      return Promise.reject(new Error('loadData is not used in this test'));
    },
    loadShapes() {
      return Promise.resolve(null);
    },
    loadInsights() {
      return Promise.resolve(insights);
    },
    loadGlobalInsights() {
      return Promise.resolve(globalInsights);
    },
  };
}

describe('enrichStopInsights', () => {
  it('stores stop stats in stopInsightsMap without mutating StopWithMeta.stats', async () => {
    const merged = mergeSourcesV2([createFixtureV2()]);
    const stopInsightsMap = new Map<string, StopInsightsEntry>();

    await enrichStopInsights(
      merged.stopsMetaMap,
      ['test'],
      createDataSource(createInsightsFixtureV2(), null),
      stopInsightsMap,
    );

    const statsEntry = stopInsightsMap.get('tdn_01');
    expect(statsEntry).toBeDefined();
    if (!statsEntry) {
      throw new Error('Expected stopInsightsMap to contain tdn_01');
    }
    expect(statsEntry.groups.map((group) => group.key)).toEqual(['wd', 'ho']);
    expect(statsEntry.stats.wd).toEqual({
      freq: 100,
      routeCount: 2,
      routeTypeCount: 1,
      earliestDeparture: 490,
      latestDeparture: 730,
    });
    expect(merged.stopsMetaMap.get('tdn_01')!.stats).toBeUndefined();
  });

  it('enriches geo data from the global insights bundle and ignores unknown stops', async () => {
    const merged = mergeSourcesV2([createFixtureV2()]);
    const stopInsightsMap = new Map<string, StopInsightsEntry>();
    const globalInsights: GlobalInsightsBundle = {
      bundle_version: 3,
      kind: 'global-insights',
      stopGeo: {
        v: 1,
        data: {
          tdn_01: {
            nr: 0.12,
            wp: 0.05,
            cn: {
              ho: { rc: 4, freq: 120, sc: 6 },
            },
          },
          unknown_stop: {
            nr: 1,
          },
        },
      },
    };

    await enrichStopInsights(
      merged.stopsMetaMap,
      ['test'],
      createDataSource(null, globalInsights),
      stopInsightsMap,
    );

    expect(merged.stopsMetaMap.get('tdn_01')!.geo).toEqual({
      nearestRoute: 0.12,
      walkablePortal: 0.05,
      connectivity: {
        ho: { routeCount: 4, freq: 120, stopCount: 6 },
      },
    });
    expect(merged.stopsMetaMap.get('unknown_stop')).toBeUndefined();
  });

  it('continues when one prefix fails to load insights', async () => {
    const merged = mergeSourcesV2([createFixtureV2()]);
    const stopInsightsMap = new Map<string, StopInsightsEntry>();
    const insights = createInsightsFixtureV2();
    const dataSource: TransitDataSourceV2 = {
      loadData() {
        return Promise.reject(new Error('loadData is not used in this test'));
      },
      loadShapes() {
        return Promise.resolve(null);
      },
      loadInsights(prefix) {
        if (prefix === 'test') {
          return Promise.resolve(insights);
        }
        return Promise.reject(new Error('failed insight load'));
      },
      loadGlobalInsights() {
        return Promise.resolve(null);
      },
    };

    await enrichStopInsights(merged.stopsMetaMap, ['test', 'bad'], dataSource, stopInsightsMap);

    expect(stopInsightsMap.get('bus_01')?.stats.ho?.freq).toBe(80);
  });
});
