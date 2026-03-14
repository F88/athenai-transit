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

const logger = createLogger('App');

async function createRepository(): Promise<TransitRepository> {
  // Use MockRepository when ?mock-data is in the URL.
  // Intentionally available in production builds for UI testing and demos.
  if (new URLSearchParams(window.location.search).has('mock-data')) {
    logger.info('Using MockRepository (?mock-data)');
    const { MockRepository } = await import('./repositories/mock-repository');
    return new MockRepository();
  }
  const dsm = new DataSourceManager();
  const prefixes = dsm.getEnabledPrefixes();
  logger.info(`Using AthenaiRepository: [${prefixes.join(', ')}]`);
  return AthenaiRepository.create(prefixes);
}

async function init() {
  const repository = await createRepository();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TransitRepositoryProvider repository={repository}>
        <App />
      </TransitRepositoryProvider>
    </StrictMode>,
  );
}

void init();
