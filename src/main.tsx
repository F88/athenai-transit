import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './app';
import { TransitRepositoryProvider } from './contexts/transit-repository-provider';
import { DataSourceManager } from './config/data-source-manager';
import { AthenaiRepository } from './repositories/athenai-repository';
import type { TransitRepository } from './repositories/transit-repository';
import { createLogger } from './utils/logger';
import { getDiagParam, getRepoParam } from './utils/query-params';

const logger = createLogger('App');

async function createRepository(): Promise<TransitRepository> {
  const repo = getRepoParam();

  if (repo === 'mock') {
    logger.info('Using MockRepository (?repo=mock)');
    const { MockRepository } = await import('./repositories/mock-repository');
    return new MockRepository();
  }

  const dsm = new DataSourceManager();
  const prefixes = dsm.getEnabledPrefixes();

  if (repo === 'v2') {
    logger.info(`Using AthenaiRepositoryV2: [${prefixes.join(', ')}]`);
    // Dynamic import: v2 repository code is not loaded when using v1.
    const { AthenaiRepositoryV2 } = await import('./repositories/athenai-repository-v2');
    const { repository, loadResult } = await AthenaiRepositoryV2.create(prefixes);
    if (loadResult.failed.length > 0) {
      logger.warn(
        `Failed to load ${loadResult.failed.length} source(s): [${loadResult.failed.map((f) => f.prefix).join(', ')}]`,
      );
    }
    return repository;
  }

  logger.info(`Using AthenaiRepository: [${prefixes.join(', ')}]`);
  return AthenaiRepository.create(prefixes);
}

async function init() {
  const repository = await createRepository();

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
        <App />
      </TransitRepositoryProvider>
    </StrictMode>,
  );
}

void init();
