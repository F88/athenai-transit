import type { SourceDataV2, TransitDataSourceV2 } from '../../datasources/transit-data-source-v2';
import { createLogger } from '../../lib/logger';
import type { LoadResult } from './types';

const logger = createLogger('AthenaiRepositoryV2');

export interface FetchSourcesV2Result {
  /** Successfully loaded source data, in input prefix order. */
  sources: SourceDataV2[];
  /** Per-prefix success/failure breakdown. */
  loadResult: LoadResult;
  /** Elapsed time in milliseconds for the parallel fetch. */
  ms: number;
}

/**
 * Call {@link TransitDataSourceV2.loadData} inside an `async` wrapper so
 * that a synchronous throw from a non-`async` implementation is
 * normalized to a rejected Promise. Without this guard, a sync throw
 * inside `prefixes.map(...)` would escape the callback before
 * `Promise.allSettled` could observe it, turning a per-source failure
 * into a whole-batch failure that bypasses the `loadResult.failed`
 * accounting below.
 */
async function loadDataSafe(
  dataSource: TransitDataSourceV2,
  prefix: string,
): Promise<SourceDataV2> {
  return dataSource.loadData(prefix);
}

/** Fetch all v2 data bundles in parallel, tracking successes and failures. */
export async function fetchSourcesV2(
  prefixes: string[],
  dataSource: TransitDataSourceV2,
): Promise<FetchSourcesV2Result> {
  const start = performance.now();
  const results = await Promise.allSettled(
    prefixes.map((prefix) => loadDataSafe(dataSource, prefix)),
  );

  const sources: SourceDataV2[] = [];
  const loaded: string[] = [];
  const failed: { prefix: string; error: Error }[] = [];

  for (let i = 0; i < prefixes.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      sources.push(result.value);
      loaded.push(prefixes[i]);
    } else {
      const error =
        result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      failed.push({ prefix: prefixes[i], error });
      logger.warn(`Skipping source "${prefixes[i]}"`, error);
    }
  }

  return { sources, loadResult: { loaded, failed }, ms: performance.now() - start };
}
