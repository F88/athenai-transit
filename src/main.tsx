import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './i18n';
import App from './app';
import { SourceLoadStateProvider } from './contexts/source-load-state-provider';
import { TransitRepositoryProvider } from './contexts/transit-repository-provider';
import { DataSourceManager } from './config/data-source-manager';
import { resolveFetchDataSources } from './domain/datasource/resolve-fetch-data-sources';
import type { TransitRepository } from './repositories/transit-repository';
import { AthenaiRepositoryV2, type LoadResult } from './repositories/athenai-repository';
import {
  cleanupInvalidQueryParams,
  getDiagParam,
  getRepoParam,
  getSourcesParam,
} from './lib/query-params';
import { TILE_SOURCES } from './config/tile-sources';
import { createLogger } from './lib/logger';

const logger = createLogger('App');

async function createRepository(): Promise<{
  repository: TransitRepository;
  loadResult: LoadResult;
}> {
  const repo = getRepoParam();

  if (repo === 'mock') {
    logger.info('Using MockRepository (?repo=mock)');
    const { MockRepository } = await import('./repositories/mock-repository');
    return { repository: new MockRepository(), loadResult: { loaded: [], failed: [] } };
  }

  const dsm = new DataSourceManager();
  const prefixes = resolveFetchDataSources(
    dsm.getGroups(),
    dsm.getEnabledPrefixes(),
    getSourcesParam(),
  );

  logger.info(`Using AthenaiRepositoryV2: [${prefixes.join(', ')}]`);
  const { repository, loadResult } = await AthenaiRepositoryV2.create(prefixes);
  if (loadResult.failed.length > 0) {
    logger.warn(
      `Failed to load ${loadResult.failed.length} source(s): [${loadResult.failed.map((f) => f.prefix).join(', ')}]`,
    );
  }
  return { repository, loadResult };
}

async function init() {
  // Remove invalid query params (e.g., legacy ?repo=v1, malformed ?time=) from the URL.
  cleanupInvalidQueryParams(TILE_SOURCES.length);

  const { repository, loadResult } = await createRepository();

  // Run diagnostics if requested via query param.
  // Dynamic import: diagnostics code is not loaded on normal page visits.
  const diag = getDiagParam();
  if (diag) {
    try {
      const { runDiagnostics } = await import('./diagnostics');
      await runDiagnostics(diag, repository);
    } catch (e) {
      logger.warn('Diagnostics failed:', e);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TransitRepositoryProvider repository={repository}>
        <SourceLoadStateProvider initialLoadResult={loadResult} sourcesParam={getSourcesParam()}>
          <App />
        </SourceLoadStateProvider>
      </TransitRepositoryProvider>
    </StrictMode>,
  );
}

void init();
