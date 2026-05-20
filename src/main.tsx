import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './i18n';
import BootstrapApp from './bootstrap-app';
import { applyStoredAppTheme } from './lib/app-theme';
import { cleanupInvalidQueryParams } from './lib/query-params';
import { TILE_SOURCES } from './config/tile-sources';

// Apply the persisted theme before the bootstrap shell is rendered.
applyStoredAppTheme();

// Remove invalid query params (e.g., legacy ?repo=v1, malformed ?time=) from the URL.
cleanupInvalidQueryParams(TILE_SOURCES.length);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootstrapApp />
  </StrictMode>,
);
