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
 * Catalog absence degrades catalog UI only and does not affect transit
 * query, so any error is logged as a warning and converted to `null`.
 *
 * The `await` is wrapped in `try/catch` rather than chained with
 * `.catch(...)` so that a synchronous throw from a non-`async`
 * {@link TransitDataSourceV2.loadDataSourceCatalog} implementation is
 * also normalized. The interface contract returns a `Promise` but does
 * not preclude callers throwing before the promise is constructed.
 */
export async function fetchDataSourceCatalog(
  dataSource: TransitDataSourceV2,
): Promise<FetchDataSourceCatalogResult> {
  const start = performance.now();
  let catalog: DataSourceCatalogBundle | null;
  try {
    catalog = await dataSource.loadDataSourceCatalog();
  } catch (err: unknown) {
    logger.warn('Failed to load data source catalog:', err);
    catalog = null;
  }
  return { catalog, ms: performance.now() - start };
}
