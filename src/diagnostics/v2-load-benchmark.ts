/**
 * @module v2-load-benchmark
 *
 * Benchmarks v2 data source loading performance.
 * Loads ALL bundles for ALL sources and measures timing.
 *
 * Useful for:
 * - Validating pipeline output (bundle sizes, record counts)
 * - Tuning bundle structure (split/merge decisions)
 * - Comparing CDN/compression configurations
 *
 * Activated by `?diag=v2-load` URL parameter. The app still renders
 * normally after the benchmark completes.
 */

import { createLogger } from '../utils/logger';
import { FetchDataSourceV2 } from '../datasources/fetch-data-source-v2';
import type { TransitDataSourceV2 } from '../datasources/transit-data-source-v2';

const logger = createLogger('diag:v2-load');

/**
 * Load all v2 bundles for all sources and log performance results.
 *
 * Phase 1: all data bundles in parallel (startup-critical path).
 * Phase 2: all shapes + insights bundles in parallel (lazy path).
 * Phase 3: global insights bundle.
 *
 * @param prefixes - Source identifiers to load.
 * @param dataSource - Data source to load from. Defaults to {@link FetchDataSourceV2}.
 */
export async function runV2LoadBenchmark(
  prefixes: string[],
  dataSource: TransitDataSourceV2 = new FetchDataSourceV2(),
): Promise<void> {
  logger.info(`Loading ${prefixes.length} sources: [${prefixes.join(', ')}]`);
  const t0 = performance.now();

  // --- Phase 1: data bundles (startup-critical) ---
  const dataResults = await Promise.allSettled(prefixes.map((p) => dataSource.loadData(p)));
  const dataMs = Math.round(performance.now() - t0);

  const loaded: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < prefixes.length; i++) {
    const r = dataResults[i];
    if (r.status === 'fulfilled') {
      const d = r.value.data;
      loaded.push(prefixes[i]);
      logger.info(
        `${prefixes[i]}: stops=${d.stops.data.length} routes=${d.routes.data.length} tripPatterns=${Object.keys(d.tripPatterns.data).length} timetableStops=${Object.keys(d.timetable.data).length}`,
      );
    } else {
      failed.push(prefixes[i]);
      logger.warn(`${prefixes[i]}: FAILED — ${String(r.reason)}`);
    }
  }
  logger.info(
    `Data bundles: ${loaded.length}/${prefixes.length} loaded in ${dataMs}ms` +
      (failed.length > 0 ? ` (failed: [${failed.join(', ')}])` : ''),
  );

  if (loaded.length === 0) {
    return;
  }

  // --- Phase 2: shapes + insights for ALL sources ---
  const t1 = performance.now();

  const shapesResults = await Promise.allSettled(loaded.map((p) => dataSource.loadShapes(p)));
  const insightsResults = await Promise.allSettled(loaded.map((p) => dataSource.loadInsights(p)));

  let shapesLoaded = 0;
  let shapesNull = 0;
  for (let i = 0; i < loaded.length; i++) {
    const r = shapesResults[i];
    if (r.status === 'fulfilled' && r.value) {
      shapesLoaded++;
      logger.info(`${loaded[i]}/shapes: ${Object.keys(r.value.shapes.data).length} routes`);
    } else if (r.status === 'fulfilled') {
      shapesNull++;
    } else {
      logger.warn(`${loaded[i]}/shapes: FAILED — ${String(r.reason)}`);
    }
  }
  logger.info(`Shapes bundles: ${shapesLoaded} loaded, ${shapesNull} not available`);

  let insightsLoaded = 0;
  let insightsNull = 0;
  for (let i = 0; i < loaded.length; i++) {
    const r = insightsResults[i];
    if (r.status === 'fulfilled' && r.value) {
      insightsLoaded++;
      const sections: string[] = [];
      if (r.value.tripPatternStats) {
        sections.push('tripPatternStats');
      }
      if (r.value.tripPatternGeo) {
        sections.push('tripPatternGeo');
      }
      if (r.value.stopStats) {
        sections.push('stopStats');
      }
      logger.info(`${loaded[i]}/insights: [${sections.join(', ')}]`);
    } else if (r.status === 'fulfilled') {
      insightsNull++;
    } else {
      logger.warn(`${loaded[i]}/insights: FAILED — ${String(r.reason)}`);
    }
  }
  logger.info(`Insights bundles: ${insightsLoaded} loaded, ${insightsNull} not available`);

  const perSourceMs = Math.round(performance.now() - t1);

  // --- Phase 3: global insights ---
  const t2 = performance.now();
  const globalInsights = await dataSource.loadGlobalInsights();
  const globalMs = Math.round(performance.now() - t2);

  if (globalInsights) {
    logger.info(
      `global/insights: stopGeo=${globalInsights.stopGeo ? Object.keys(globalInsights.stopGeo.data).length + ' stops' : 'none'}`,
    );
  } else {
    logger.info(`global/insights: not available`);
  }

  const totalMs = Math.round(performance.now() - t0);
  logger.info(
    `Total: ${totalMs}ms (data=${dataMs}ms, shapes+insights=${perSourceMs}ms, global=${globalMs}ms)`,
  );
}
