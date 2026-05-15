import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';

import type { TransitDataSourceV2 } from '../../datasources/transit-data-source-v2';
import { createLogger } from '../../lib/logger';

const logger = createLogger('AthenaiRepositoryV2');

export interface FetchDataSourceCatalogResult {
  /** The fetched catalog bundle, or null when unavailable. */
  catalog: DataSourceCatalogBundle | null;
  /** Elapsed time in milliseconds, regardless of success or failure. */
  ms: number;
}

/**
 * Fetch the global data-source catalog bundle, normalizing all failures
 * (including bundle envelope mismatch) to `null`.
 *
 * Mirrors how `enrichStopInsights` handles `loadGlobalInsights`: catalog
 * absence degrades catalog UI only and does not affect transit query, so
 * any error is logged as a warning and converted to `null`.
 */
export async function fetchDataSourceCatalog(
  dataSource: TransitDataSourceV2,
): Promise<FetchDataSourceCatalogResult> {
  const start = performance.now();
  const catalog = await dataSource.loadDataSourceCatalog().catch((err: unknown) => {
    logger.warn('Failed to load data source catalog:', err);
    return null;
  });
  return { catalog, ms: performance.now() - start };
}
