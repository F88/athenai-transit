import { useEffect, useState } from 'react';
import { DataSourceManager } from '../config/data-source-manager';
import { resolveFetchDataSources } from '../domain/datasource/resolve-fetch-data-sources';
import { loadEnabledGroupIdsFromStorage } from '../domain/datasource/data-source-selection-storage';
import { getDiagParam, getRepoParam, getSourcesParam } from '../lib/query-params';
import { createLogger } from '../lib/logger';
import {
  AthenaiRepositoryV2,
  formatBootLoadProgressSummary,
  formatLoadActivitySummary,
  type LoadResult,
  type RepositoryLoadProgressSummary,
} from '../repositories/athenai-repository';
import type { TransitRepository } from '../repositories/transit-repository';

const logger = createLogger('AppBootstrap');

type AppBootstrapReadyState = {
  status: 'ready';
  repository: TransitRepository;
  loadResult: LoadResult;
};

type AppBootstrapLoadingState = {
  status: 'loading';
};

type AppBootstrapErrorState = {
  status: 'error';
  error: Error;
};

export type AppBootstrapState =
  | AppBootstrapLoadingState
  | AppBootstrapReadyState
  | AppBootstrapErrorState;

let bootstrapPromise: Promise<AppBootstrapReadyState> | null = null;
let hasLoggedBootstrapMount = false;

async function createRepository(): Promise<{
  repository: TransitRepository;
  loadResult: LoadResult;
}> {
  const repo = getRepoParam();

  if (repo === 'mock') {
    logger.info('Using MockRepository (?repo=mock)');
    const { MockRepository } = await import('../repositories/mock-repository');
    return {
      repository: new MockRepository(),
      loadResult: { loaded: [], failed: [] },
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

  const { repository, loadResult } = await AthenaiRepositoryV2.create(
    prefixes,
    undefined,
    onLoadProgress,
  );
  if (loadResult.failed.length > 0) {
    logger.warn(
      `Failed to load ${loadResult.failed.length} source(s): [${loadResult.failed.map((f) => f.prefix).join(', ')}]`,
    );
  }
  return { repository, loadResult };
}

async function bootstrapApplication(): Promise<AppBootstrapReadyState> {
  const { repository, loadResult } = await createRepository();
  if (logger.isEnabled('debug')) {
    logger.debug('bootstrap repository ready');
  }

  const diag = getDiagParam();
  if (diag) {
    try {
      if (logger.isEnabled('debug')) {
        logger.debug(`bootstrap diagnostics started: ${diag}`);
      }
      const { runDiagnostics } = await import('../diagnostics');
      await runDiagnostics(diag, repository);
      if (logger.isEnabled('debug')) {
        logger.debug(`bootstrap diagnostics complete: ${diag}`);
      }
    } catch (error) {
      logger.warn('Diagnostics failed:', error);
    }
  }

  return {
    status: 'ready',
    repository,
    loadResult,
  };
}

function getBootstrapPromise(): Promise<AppBootstrapReadyState> {
  if (bootstrapPromise === null) {
    if (logger.isEnabled('debug')) {
      logger.debug('bootstrap repository boot started');
    }
    bootstrapPromise = bootstrapApplication();
  }
  return bootstrapPromise;
}

export function useAppBootstrap(): AppBootstrapState {
  const [state, setState] = useState<AppBootstrapState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    if (!hasLoggedBootstrapMount && logger.isEnabled('debug')) {
      hasLoggedBootstrapMount = true;
      logger.debug('bootstrap shell mounted: app is running without repository');
    }

    void getBootstrapPromise()
      .then((readyState) => {
        if (!cancelled) {
          if (logger.isEnabled('debug')) {
            logger.debug('bootstrap async phase complete: switching to app providers');
          }
          setState(readyState);
        }
      })
      .catch((error: unknown) => {
        const resolvedError = error instanceof Error ? error : new Error(String(error));
        logger.error('App bootstrap failed:', resolvedError);
        if (!cancelled) {
          setState({ status: 'error', error: resolvedError });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
