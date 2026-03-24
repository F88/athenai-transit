import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './app';
import { TransitRepositoryProvider } from './contexts/transit-repository-provider';
import { DataSourceManager } from './config/data-source-manager';
import type { TransitRepository } from './repositories/transit-repository';
import { AthenaiRepositoryV2 } from './repositories/athenai-repository-v2';
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

  if (repo === 'v1') {
    logger.info(`Using AthenaiRepository (v1, deprecated): [${prefixes.join(', ')}]`);
    const { AthenaiRepository } = await import('./repositories/athenai-repository');
    return AthenaiRepository.create(prefixes);
  }

  // Default: v2 repository
  logger.info(`Using AthenaiRepositoryV2: [${prefixes.join(', ')}]`);
  const { repository, loadResult } = await AthenaiRepositoryV2.create(prefixes);
  if (loadResult.failed.length > 0) {
    logger.warn(
      `Failed to load ${loadResult.failed.length} source(s): [${loadResult.failed.map((f) => f.prefix).join(', ')}]`,
    );
  }
  return repository;
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
