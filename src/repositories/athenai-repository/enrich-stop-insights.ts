import type { StopWithMeta } from '../../types/app/transit-composed';
import type { TransitDataSourceV2 } from '../../datasources/transit-data-source-v2';
import { createLogger } from '../../lib/logger';
import type { StopInsightsEntry } from './types';

const logger = createLogger('AthenaiRepositoryV2');

/**
 * Enrich stopsMetaMap with per-stop stats and geo data from insights bundles.
 *
 * - stopStats: from per-source InsightsBundle (all service groups stored
 *   in stopInsightsMap for date-aware resolution via resolveStopStats)
 * - stopGeo: from GlobalInsightsBundle
 *
 * Errors (network failures, invalid bundles) are logged as warnings
 * but do not prevent initialization. Stats and geo are optional
 * enhancements — stopsMetaMap entries remain valid without them.
 */
export async function enrichStopInsights(
  stopsMetaMap: Map<string, StopWithMeta>,
  prefixes: string[],
  dataSource: TransitDataSourceV2,
  stopInsightsMap: Map<string, StopInsightsEntry>,
): Promise<void> {
  const t0 = performance.now();

  const [insightsResults, globalResult] = await Promise.all([
    Promise.allSettled(prefixes.map((prefix) => dataSource.loadInsights(prefix))),
    dataSource.loadGlobalInsights().catch((error) => {
      logger.warn('Failed to load global insights:', error);
      return null;
    }),
  ]);

  let statsCount = 0;
  for (let i = 0; i < insightsResults.length; i++) {
    const result = insightsResults[i];
    if (result.status === 'rejected') {
      logger.warn(`Failed to load insights for ${prefixes[i]}:`, result.reason);
      continue;
    }
    if (!result.value) {
      continue;
    }
    const insights = result.value;
    if (!insights.stopStats) {
      continue;
    }

    const groups = insights.serviceGroups.data;
    if (groups.length === 0) {
      continue;
    }

    for (const [groupKey, groupStats] of Object.entries(insights.stopStats.data)) {
      for (const [stopId, stats] of Object.entries(groupStats)) {
        const meta = stopsMetaMap.get(stopId);
        if (!meta) {
          continue;
        }
        let entry = stopInsightsMap.get(stopId);
        if (!entry) {
          entry = { groups, stats: {} };
          stopInsightsMap.set(stopId, entry);
        }
        entry.stats[groupKey] = {
          freq: stats.freq,
          routeCount: stats.rc,
          routeTypeCount: stats.rtc,
          earliestDeparture: stats.ed,
          latestDeparture: stats.ld,
        };
        statsCount++;
      }
    }
  }

  let geoCount = 0;
  if (globalResult?.stopGeo) {
    for (const [stopId, geo] of Object.entries(globalResult.stopGeo.data)) {
      const meta = stopsMetaMap.get(stopId);
      if (!meta) {
        continue;
      }
      meta.geo = {
        nearestRoute: geo.nr,
        walkablePortal: geo.wp,
        connectivity: geo.cn
          ? Object.fromEntries(
              Object.entries(geo.cn).map(([group, connectivity]) => [
                group,
                {
                  routeCount: connectivity.rc,
                  freq: connectivity.freq,
                  stopCount: connectivity.sc,
                },
              ]),
            )
          : undefined,
      };
      geoCount++;
    }
  }

  const elapsed = Math.round(performance.now() - t0);
  logger.info(
    `Stop insights enriched in ${elapsed}ms: stats=${statsCount} stops, geo=${geoCount} stops`,
  );
}
