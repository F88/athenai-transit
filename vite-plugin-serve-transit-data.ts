import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { TRANSIT_DATA_DELIVERY_BASE_DIR } from './scripts/copy-pipeline-data';

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root directory holding the transit data delivery directories produced by
 * `npm run data:deliver:local` (e.g. `__AT_DATA__/data-v2`, `__AT_DATA__/next-dev`).
 * The transit data path's last segment selects which dataset to serve (e.g.
 * `/data-v2` -> `<deliveryRoot>/data-v2`), so switching
 * `VITE_TRANSIT_DATA_PATH` picks among the synced datasets.
 *
 * The base dir name is imported from the sync script so dev serving and
 * `data:deliver:local` stay in lockstep (single source of truth): flipping
 * `TRANSIT_DATA_DELIVERY_BASE_DIR` moves both the sync destination and the
 * dev serving root together.
 */
const DELIVERY_ROOT = path.join(REPO_ROOT, TRANSIT_DATA_DELIVERY_BASE_DIR);

/**
 * Dev-server plugin that serves a synced transit data directory at the
 * app's transit data path (`VITE_TRANSIT_DATA_PATH`). The path's last
 * segment selects which dataset under the delivery root to serve (e.g.
 * `/data-v2` -> `<deliveryRoot>/data-v2`, `/next-dev` ->
 * `<deliveryRoot>/next-dev`).
 *
 * This lets `npm run dev` serve the data produced by `npm run data:deliver:local`.
 * It is a no-op when:
 * - not the dev server (`apply: 'serve'`), or
 * - data is fetched cross-origin (`VITE_TRANSIT_DATA_ORIGIN` is set), or
 * - the data path is the origin root (`/`), which would shadow the app.
 *
 * Requests under the data path are treated as a JSON API, not SPA routes:
 * a missing file returns 404 instead of falling through to Vite's SPA
 * `index.html`. When the selected dataset directory does not exist, the
 * middleware is still mounted and every request under the path 404s (with
 * a startup warning), so a wrong `VITE_TRANSIT_DATA_PATH` (or a missing
 * `data:deliver:local`) fails loudly instead of silently returning `index.html`.
 *
 * @param opts.basePath - `VITE_TRANSIT_DATA_PATH` (e.g. `/data-v2`).
 * @param opts.origin - `VITE_TRANSIT_DATA_ORIGIN` (empty = same-origin).
 */
export function serveTransitData(opts: { basePath: string; origin: string }): Plugin {
  const base = normalizeBasePath(opts.basePath);

  return {
    name: 'serve-transit-data-dev',
    apply: 'serve',
    configureServer(server) {
      const log = server.config.logger;

      if (opts.origin.trim() !== '') {
        log.info(
          `[serve-transit-data] disabled: cross-origin data ` +
            `(VITE_TRANSIT_DATA_ORIGIN="${opts.origin}")`,
        );
        return;
      }
      if (base === '') {
        log.info('[serve-transit-data] disabled: transit data path is the origin root ("/")');
        return;
      }

      // The last path segment selects which synced dataset to serve.
      const segment = base.split('/').filter(Boolean).pop() ?? '';
      const serveDir = path.resolve(DELIVERY_ROOT, segment);

      // Guard: the resolved directory must stay inside the delivery root.
      // If it escapes, do not mount and leave the request to Vite.
      if (serveDir !== DELIVERY_ROOT && !serveDir.startsWith(DELIVERY_ROOT + path.sep)) {
        log.warn(
          `[serve-transit-data] disabled: resolved path escapes the delivery root ` +
            `(VITE_TRANSIT_DATA_PATH="${opts.basePath}")`,
        );
        return;
      }

      // Announce the mount so the active dataset is visible in the dev log.
      log.info(
        `[serve-transit-data] serving "${path.relative(REPO_ROOT, serveDir)}/" ` +
          `at "${base}" (VITE_TRANSIT_DATA_PATH="${opts.basePath}")`,
      );

      // Warn at startup if the selected dataset is missing. The middleware
      // is still mounted below and every request under `base` will 404,
      // surfacing a wrong VITE_TRANSIT_DATA_PATH or a missing data:deliver:local.
      if (!isExistingDirectory(serveDir)) {
        log.warn(
          `[serve-transit-data] transit data not found: ${path.relative(REPO_ROOT, serveDir)} ` +
            `(from VITE_TRANSIT_DATA_PATH="${opts.basePath}"); requests under "${base}" will 404. ` +
            `Did you run "npm run data:deliver:local"?`,
        );
      }

      server.middlewares.use(base, (req, res) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const resolved = path.resolve(path.join(serveDir, urlPath));

        // Prevent path traversal outside the served directory.
        if (resolved !== serveDir && !resolved.startsWith(serveDir + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let stat: fs.Stats;
        try {
          stat = fs.statSync(resolved);
        } catch {
          // Data paths are a JSON API, not SPA routes: return 404 rather
          // than calling next(), which would let Vite's SPA fallback serve
          // index.html for a missing data file.
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        if (!stat.isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(resolved).pipe(res);
      });
    },
  };
}

/**
 * Normalize a base path for mounting: ensure a single leading slash, no
 * trailing slash. `/` (or empty) yields `''`, meaning "do not mount".
 */
function normalizeBasePath(value: string): string {
  let base = (value ?? '').trim();
  if (base === '' || base === '/') {
    return '';
  }
  if (!base.startsWith('/')) {
    base = `/${base}`;
  }
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }
  return base;
}

/**
 * Whether the given path exists and is a directory.
 */
function isExistingDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
