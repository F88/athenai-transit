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
import { loadEnabledGroupIdsFromStorage } from './domain/datasource/data-source-selection-storage';
import type { TransitRepository } from './repositories/transit-repository';
import {
  AthenaiRepositoryV2,
  formatBootLoadProgressSummary,
  formatLoadActivitySummary,
  type LoadResult,
  type RepositoryLoadProgressSummary,
} from './repositories/athenai-repository';
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
  loadProgress: RepositoryLoadProgressSummary;
}> {
  const repo = getRepoParam();

  if (repo === 'mock') {
    logger.info('Using MockRepository (?repo=mock)');
    const { MockRepository } = await import('./repositories/mock-repository');
    return {
      repository: new MockRepository(),
      loadResult: { loaded: [], failed: [] },
      loadProgress: {
        boot: {
          totalSources: 0,
          startedSources: 0,
          completedSources: 0,
          failedSources: 0,
          progressRatio: 1,
          lastRequiredEvent: null,
        },
        activity: {
          requestCounts: { started: 0, succeeded: 0, skipped: 0, failed: 0 },
          totalEncodedBytes: 0,
          totalDecodedBytes: 0,
          lastEvent: null,
        },
      },
    };
  }

  const dsm = new DataSourceManager(loadEnabledGroupIdsFromStorage());
  const prefixes = resolveFetchDataSources(
    dsm.getGroups(),
    dsm.getEnabledDataSources(),
    getSourcesParam(),
  );

  logger.info(`Using AthenaiRepositoryV2: [${prefixes.join(', ')}]`);
  const bootStartTime = performance.now();
  let hasLoggedBootComplete = false;
  const onLoadProgress = (summary: RepositoryLoadProgressSummary) => {
    if (logger.isEnabled('debug')) {
      logger.debug(formatBootLoadProgressSummary(summary.boot));
      logger.debug(formatLoadActivitySummary(summary.activity));
    }

    if (!hasLoggedBootComplete && summary.boot.progressRatio === 1) {
      hasLoggedBootComplete = true;
      const bootMs = Math.round(performance.now() - bootStartTime);
      logger.info(
        `Required data load complete in ${bootMs}ms: ${formatBootLoadProgressSummary(summary.boot, { mode: 'complete' })} | ${formatLoadActivitySummary(summary.activity, { mode: 'snapshot' })}`,
      );
    }
  };

  const { repository, loadResult, loadProgress } = await AthenaiRepositoryV2.create(
    prefixes,
    undefined,
    onLoadProgress,
  );
  if (loadResult.failed.length > 0) {
    logger.warn(
      `Failed to load ${loadResult.failed.length} source(s): [${loadResult.failed.map((f) => f.prefix).join(', ')}]`,
    );
  }
  return { repository, loadResult, loadProgress };
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
