/**
 * @module FetchDataSourceV2
 *
 * Loads v2 bundle JSON data via HTTP fetch.
 *
 * Bundle file layout (relative to {@link BASE_PATH}):
 * - `{prefix}/data.json`     — required at startup
 * - `{prefix}/shapes.json`   — lazy-loaded
 * - `{prefix}/insights.json` — lazy-loaded
 * - `global/insights.json`   — lazy-loaded, cross-source
 *
 * Each bundle is validated for `bundle_version` and `kind` after parsing.
 * Required bundles throw on failure; optional bundles return `null`.
 *
 * Content-type is always verified to guard against SPA fallback rewrites
 * (e.g. Vercel returning 200 + HTML for missing static files).
 */

import { createLogger } from '../lib/logger';
import { sanitizeDirName } from '../utils/sanitize-dir-name';
import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '../types/data/transit-v2-json';
import type { SourceDataV2, TransitDataSourceV2 } from './transit-data-source-v2';

const logger = createLogger('FetchDataSourceV2');

/**
 * Base path for transit data files.
 * Configurable via `VITE_TRANSIT_DATA_PATH` environment variable.
 * Defaults to `/data-v2` when not set.
 * The value must be `/<simple-dir-name>` (e.g. `/data-v2`, `/next-dev`).
 */
const BASE_PATH = validateBasePath(import.meta.env.VITE_TRANSIT_DATA_PATH ?? '/data-v2');

function validateBasePath(value: string): string {
  const dir = value.startsWith('/') ? value.slice(1) : value;
  sanitizeDirName(dir, 'VITE_TRANSIT_DATA_PATH');
  return value.startsWith('/') ? value : `/${value}`;
}

/** Expected bundle_version for all v2 bundles. */
const EXPECTED_BUNDLE_VERSION = 2;

/**
 * Default per-request timeout in milliseconds.
 *
 * With 52 potential fetch calls (17 sources × 3 bundle types + 1 global),
 * browser-default timeouts (~300s) would cause unacceptable hangs on
 * slow networks. 30s is generous for a single JSON file — even the
 * largest bundle (minkuru data.json, 18MB) transfers in <1s on 4G.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Pattern for valid source prefixes. */
const PREFIX_PATTERN = /^[a-z0-9_-]+$/;

/**
 * Validate that a parsed JSON object has the expected bundle_version and kind.
 *
 * This is a structural check on the top-level discriminant fields.
 * It does NOT validate individual sections within the bundle — that
 * is the repository's responsibility when consuming the data.
 *
 * @throws When bundle_version or kind does not match expectations.
 */
function validateBundleEnvelope<K extends string>(
  json: unknown,
  expectedKind: K,
  path: string,
): asserts json is { bundle_version: 2; kind: K } {
  if (json === null) {
    throw new Error(`${path}: expected JSON object, got null`);
  }
  if (Array.isArray(json)) {
    throw new Error(`${path}: expected JSON object, got array`);
  }
  if (typeof json !== 'object') {
    throw new Error(`${path}: expected JSON object, got ${typeof json}`);
  }
  const obj = json as Record<string, unknown>;
  if (obj.bundle_version !== EXPECTED_BUNDLE_VERSION) {
    throw new Error(
      `${path}: invalid bundle_version (expected ${EXPECTED_BUNDLE_VERSION}, got ${String(obj.bundle_version)})`,
    );
  }
  if (obj.kind !== expectedKind) {
    throw new Error(
      `${path}: invalid bundle kind (expected "${expectedKind}", got "${String(obj.kind)}")`,
    );
  }
}

/**
 * Validate that the prefix is a safe, expected format.
 *
 * @throws When prefix contains unexpected characters.
 */
function validatePrefix(prefix: string): void {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(`Invalid prefix: "${prefix}"`);
  }
}

/**
 * Result of fetching a bundle file.
 *
 * For optional bundles, `fetchBundle` returns `null` when the data
 * is unavailable (404, HTTP error, timeout, network error, non-JSON
 * content-type, or JSON parse error). See {@link FetchDataSourceV2.fetchBundle}.
 */
interface FetchBundleResult {
  /** Parsed JSON content. */
  json: unknown;
  /**
   * Approximate size via `text.length` (UTF-16 code units).
   * Close to actual bytes for ASCII-dominant JSON; not exact for
   * multi-byte characters. Sufficient for logging and diagnostics.
   */
  sizeApprox: number;
  /** Time spent on network + response.text() (ms). */
  networkMs: number;
  /** Time spent on JSON.parse (ms). */
  parseMs: number;
}

/**
 * Loads v2 bundle JSON files via `fetch`.
 *
 * Each bundle type is fetched and validated independently.
 * The data bundle is required; shapes, insights, and global insights
 * are optional (return `null` on 404 or missing file).
 */
export class FetchDataSourceV2 implements TransitDataSourceV2 {
  private readonly basePath: string;
  private readonly timeoutMs: number;

  /**
   * @param basePath - Base URL path for v2 data files.
   *                   Defaults to {@link BASE_PATH} (`/data-v2`).
   *                   Override in tests to point to a fixture directory.
   * @param timeoutMs - Per-request timeout in milliseconds.
   *                    Defaults to {@link DEFAULT_TIMEOUT_MS} (30s).
   */
  constructor(basePath: string = BASE_PATH, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    // Normalize trailing slash to prevent double-slash in URLs
    this.basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    this.timeoutMs = timeoutMs;
  }

  /** {@inheritDoc TransitDataSourceV2.loadData} */
  async loadData(prefix: string): Promise<SourceDataV2> {
    validatePrefix(prefix);

    const path = `${prefix}/data.json`;
    const result = await this.fetchBundle(path, false);

    validateBundleEnvelope(result.json, 'data', path);
    return { prefix, data: result.json as DataBundle };
  }

  /** {@inheritDoc TransitDataSourceV2.loadShapes} */
  async loadShapes(prefix: string): Promise<ShapesBundle | null> {
    validatePrefix(prefix);

    const result = await this.fetchBundle(`${prefix}/shapes.json`, true);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'shapes', `${prefix}/shapes.json`);
    return result.json as ShapesBundle;
  }

  /** {@inheritDoc TransitDataSourceV2.loadInsights} */
  async loadInsights(prefix: string): Promise<InsightsBundle | null> {
    validatePrefix(prefix);

    const result = await this.fetchBundle(`${prefix}/insights.json`, true);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'insights', `${prefix}/insights.json`);
    return result.json as InsightsBundle;
  }

  /** {@inheritDoc TransitDataSourceV2.loadGlobalInsights} */
  async loadGlobalInsights(): Promise<GlobalInsightsBundle | null> {
    const path = 'global/insights.json';
    const result = await this.fetchBundle(path, true);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'global-insights', path);
    return result.json as GlobalInsightsBundle;
  }

  /**
   * Fetch, validate content-type, and parse a JSON bundle file.
   *
   * All outcomes are logged at the appropriate level:
   * - Success: info (path, size, network/parse timing)
   * - Timeout: error (always, regardless of optional flag)
   * - Other failures: warn for required, debug for optional
   *
   * @param path - Relative path under base (e.g. "tobus/data.json").
   * @param optional - When true, returns `null` on any non-OK HTTP status,
   *                   non-JSON content-type, network error, timeout, or
   *                   JSON parse error.
   * @returns Parsed result with timing metrics, or `null` for unavailable optional files.
   * @throws On network error, timeout, or HTTP error for required files.
   * @throws On non-JSON content-type for required files (SPA fallback detection).
   * @throws On JSON parse error for required files.
   */
  private async fetchBundle(path: string, optional: true): Promise<FetchBundleResult | null>;
  private async fetchBundle(path: string, optional: false): Promise<FetchBundleResult>;
  private async fetchBundle(path: string, optional: boolean): Promise<FetchBundleResult | null> {
    const url = `${this.basePath}/${path}`;
    const t0 = performance.now();

    // --- Network request with timeout ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        // Timeout is always logged as error regardless of optional flag
        logger.error(`${path}: timeout after ${this.timeoutMs}ms`);
        if (optional) {
          return null;
        }
        throw new Error(`${path}: timeout after ${this.timeoutMs}ms`);
      }
      if (optional) {
        logger.debug(`${path}: network error (optional, skipping)`);
        return null;
      }
      logger.warn(`${path}: network error`, e);
      throw new Error(`${path}: network error`, { cause: e });
    }

    // --- HTTP status check ---
    // clearTimeout is deferred until after response.text() so that the
    // timeout covers the entire transfer, not just the headers.
    if (response.status === 404) {
      clearTimeout(timeoutId);
      if (optional) {
        logger.debug(`${path}: 404 (optional, skipping)`);
        return null;
      }
      logger.warn(`${path}: HTTP 404`);
      throw new Error(`${path}: HTTP 404`);
    }
    if (!response.ok) {
      clearTimeout(timeoutId);
      if (optional) {
        logger.debug(`${path}: HTTP ${response.status} (optional, skipping)`);
        return null;
      }
      logger.warn(`${path}: HTTP ${response.status}`);
      throw new Error(`${path}: HTTP ${response.status}`);
    }

    // --- Content-type validation ---
    // SPA fallback rewrites (e.g. Vercel) return 200 + HTML for missing
    // files instead of 404. Detect this for both required and optional
    // files — for required files, a clear error is better than a
    // cryptic JSON.parse failure on HTML content.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      clearTimeout(timeoutId);
      if (optional) {
        logger.debug(`${path}: non-JSON content-type (optional, skipping)`);
        return null;
      }
      logger.warn(
        `${path}: expected application/json but got "${contentType}" (possible SPA fallback)`,
      );
      throw new Error(
        `${path}: expected application/json but got "${contentType}" (possible SPA fallback)`,
      );
    }

    // --- Response body + parse ---
    // The abort signal remains active during body download. If the
    // timeout fires here, response.text() rejects with AbortError.
    let text: string;
    try {
      text = await response.text();
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        logger.error(`${path}: timeout after ${this.timeoutMs}ms (during body download)`);
        if (optional) {
          return null;
        }
        throw new Error(`${path}: timeout after ${this.timeoutMs}ms (during body download)`);
      }
      if (optional) {
        logger.debug(`${path}: body read error (optional, skipping)`);
        return null;
      }
      logger.warn(`${path}: body read error`, e);
      throw new Error(`${path}: body read error`, { cause: e });
    }
    clearTimeout(timeoutId);
    const tNetwork = performance.now();

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch (e) {
      if (optional) {
        logger.debug(`${path}: JSON parse error (optional, skipping)`);
        return null;
      }
      logger.warn(`${path}: JSON parse error`, e);
      throw new Error(`${path}: JSON parse error`, { cause: e });
    }
    const tParse = performance.now();

    const networkMs = Math.round(tNetwork - t0);
    const parseMs = Math.round(tParse - tNetwork);
    const sizeKB = (text.length / 1024).toFixed(1);
    logger.info(`${path}: ${sizeKB}KB (network=${networkMs}ms, parse=${parseMs}ms)`);

    return { json, sizeApprox: text.length, networkMs, parseMs };
  }
}
