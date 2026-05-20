/**
 * @module FetchDataSourceV2
 *
 * Loads v2 bundle JSON data via HTTP fetch.
 *
 * Bundle file layout (relative to {@link BASE_PATH}):
 * - `{prefix}/data.json`              — required at startup
 * - `{prefix}/shapes.json`            — lazy-loaded
 * - `{prefix}/insights.json`          — lazy-loaded
 * - `global/insights.json`            — lazy-loaded, cross-source
 * - `global/data-source-catalog.json` — derived per-source metadata, optional
 *
 * Each bundle is validated for `bundle_version` and `kind` after parsing.
 * Required bundles throw on failure; optional bundles return `null`.
 *
 * Content-type is always verified to guard against SPA fallback rewrites
 * (e.g. Vercel returning 200 + HTML for missing static files).
 */

import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';
import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '@contracts/data/transit-v2-json';

import { createLogger } from '../lib/logger';
import { sanitizeDirName } from '../utils/sanitize-dir-name';
import type { SourceDataV2, TransitDataSourceV2 } from './transit-data-source-v2';

const logger = createLogger('FetchDataSourceV2');

/**
 * Base path for transit data files.
 * Configurable via `VITE_TRANSIT_DATA_PATH` environment variable.
 * Defaults to `/data-v2` when not set.
 * The value must be `/<simple-dir-name>` (e.g. `/data-v2`, `/next-dev`).
 */
const BASE_PATH = validateBasePath(import.meta.env.VITE_TRANSIT_DATA_PATH ?? '/data-v2');

/** @internal Exported for testing. */
export function validateBasePath(value: string): string {
  const dir = value.startsWith('/') ? value.slice(1) : value;
  sanitizeDirName(dir, 'VITE_TRANSIT_DATA_PATH');
  return value.startsWith('/') ? value : `/${value}`;
}

/** Expected bundle_version for all v2 bundles. */
const EXPECTED_BUNDLE_VERSION = 3;

/**
 * Default per-request timeout in milliseconds.
 *
 * With 52 potential fetch calls (17 sources × 3 bundle types + 1 global),
 * browser-default timeouts (~300s) would cause unacceptable hangs on
 * slow networks. 30s is generous for a single JSON file — even the
 * largest bundle (minkuru data.json, 18MB) transfers in <1s on 4G.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Per-call timeout for the data-source catalog fetch.
 *
 * Catalog is derived metadata: its absence degrades catalog-related UI
 * only and does not affect transit query. To avoid blocking app boot on
 * a slow or stuck catalog request (e.g. partial outage where only the
 * catalog URL is unreachable), we use a much shorter timeout than the
 * default. 5s is comfortably above normal RTT-bound response times for
 * the ~36KB catalog file.
 */
const CATALOG_TIMEOUT_MS = 5_000;

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
): asserts json is { bundle_version: 3; kind: K } {
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
 * For optional bundles, {@link FetchDataSourceV2.loadOptionalBundle}
 * returns `null` when the data is unavailable (404, HTTP error, timeout,
 * network error, non-JSON content-type, or JSON parse error).
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

/** Per-call options for bundle fetch helpers. */
interface FetchBundleOptions {
  /**
   * Override the instance default timeout for this call (milliseconds).
   * When omitted, the instance's {@link FetchDataSourceV2.timeoutMs} is used.
   */
  timeoutMs?: number;
}

/**
 * Network transfer metrics for a fetched bundle, read from the Resource
 * Timing API after the response body is fully downloaded.
 *
 * Sizes are in bytes. `transferSize` / `encodedBodySize` / `decodedBodySize`
 * are all `0` when the browser refuses to expose them (a cross-origin
 * response without `Timing-Allow-Origin`); the v2 data files are served
 * same-origin, so this normally does not happen.
 */
export interface ResourceTransferMetrics {
  /**
   * Bytes transferred over the network, including response headers.
   * `0` when the response was served from the HTTP cache.
   */
  transferSize: number;
  /** Compressed body size — the bytes actually downloaded. */
  encodedBodySize: number;
  /** Uncompressed body size. Matches the file size on disk. */
  decodedBodySize: number;
  /** `true` when served from the HTTP cache (`transferSize === 0`). */
  fromCache: boolean;
}

/**
 * Select the Resource Timing entry produced by a fetch started at or
 * after `sinceTime`.
 *
 * `performance.getEntriesByName(url)` returns an entry for every past
 * load of the same URL — the app fetches some bundles (e.g. `insights.json`)
 * more than once. The entry for the current fetch is the earliest one
 * whose `startTime` is at or after the moment that fetch began.
 *
 * @param entries - Resource Timing entries for a single URL.
 * @param sinceTime - `performance.now()` value captured before the fetch.
 * @returns The matching entry, or `undefined` when none qualifies.
 * @internal Exported for testing.
 */
export function selectResourceTimingEntry(
  entries: readonly PerformanceResourceTiming[],
  sinceTime: number,
): PerformanceResourceTiming | undefined {
  let selected: PerformanceResourceTiming | undefined;
  for (const entry of entries) {
    if (entry.startTime < sinceTime) {
      continue;
    }
    if (selected === undefined || entry.startTime < selected.startTime) {
      selected = entry;
    }
  }
  return selected;
}

function buildResourceTransferMetrics(entry: PerformanceResourceTiming): ResourceTransferMetrics {
  return {
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
    fromCache: entry.transferSize === 0,
  };
}

function collectMatchingResourceEntries(
  entries: readonly PerformanceEntry[],
  resolvedUrl: string,
): PerformanceResourceTiming[] {
  const matched: PerformanceResourceTiming[] = [];
  for (const entry of entries) {
    if (entry.entryType !== 'resource' || entry.name !== resolvedUrl) {
      continue;
    }
    matched.push(entry as PerformanceResourceTiming);
  }
  return matched;
}

interface ResourceTransferCapture {
  readMetrics(): ResourceTransferMetrics | null;
}

interface FetchBundleTextResult {
  text: string;
  sizeApprox: number;
  networkMs: number;
  transferMetrics: ResourceTransferMetrics | null;
}

interface ParseBundleJsonResult {
  json: unknown;
  parseMs: number;
}

/**
 * Start observing Resource Timing entries for a fetch.
 *
 * The observer is started before the fetch so repeated requests to the same
 * URL can be disambiguated using `sinceTime` without relying on a later
 * name-based scan of the whole buffer.
 *
 * @param url - The URL passed to `fetch` (origin-relative).
 * @param sinceTime - `performance.now()` captured before the fetch.
 * @returns Capture handle. `readMetrics()` returns transfer metrics, or
 *          `null` when Resource Timing data is unavailable.
 */
function startResourceTransferCapture(url: string, sinceTime: number): ResourceTransferCapture {
  if (typeof performance === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return { readMetrics: () => null };
  }
  if (typeof globalThis.location?.href !== 'string') {
    return { readMetrics: () => null };
  }

  const resolvedUrl = new URL(url, globalThis.location.href).href;
  const observedEntries: PerformanceResourceTiming[] = [];
  const observer = new PerformanceObserver((list) => {
    observedEntries.push(...collectMatchingResourceEntries(list.getEntries(), resolvedUrl));
  });

  try {
    observer.observe({ type: 'resource', buffered: true });
  } catch {
    observer.disconnect();
    return { readMetrics: () => null };
  }

  return {
    readMetrics() {
      const pendingEntries = collectMatchingResourceEntries(observer.takeRecords(), resolvedUrl);
      observer.disconnect();
      const entry = selectResourceTimingEntry([...observedEntries, ...pendingEntries], sinceTime);
      return entry ? buildResourceTransferMetrics(entry) : null;
    },
  };
}

/**
 * Format the size segment of a fetch debug-log line.
 *
 * @param metrics - Transfer metrics, or `null` when Resource Timing data
 *                  was unavailable.
 * @param decodedTextLength - Length of the decoded response text (UTF-16
 *                  code units), used as a fallback when `metrics` is `null`.
 * @returns A human-readable size description for logging.
 * @internal Exported for testing.
 */
export function formatTransferSummary(
  metrics: ResourceTransferMetrics | null,
  decodedTextLength: number,
): string {
  if (metrics === null) {
    return `estimated ${(decodedTextLength / 1024).toFixed(
      1,
    )}KB decoded (transfer size unavailable)`;
  }
  const decodedKB = (metrics.decodedBodySize / 1024).toFixed(1);
  if (metrics.fromCache) {
    return `no network transfer, ${decodedKB}KB decoded`;
  }
  const wireKB = (metrics.encodedBodySize / 1024).toFixed(1);
  return `${wireKB}KB over the wire, ${decodedKB}KB decoded`;
}

function logFetchMetrics(path: string, fetched: FetchBundleTextResult): void {
  logger.debug(
    `fetch metrics: ${path}: ${formatTransferSummary(fetched.transferMetrics, fetched.sizeApprox)} (fetch=${fetched.networkMs}ms)`,
  );
}

function logParseMetrics(path: string, parseMs: number): void {
  logger.debug(`parse metrics: ${path}: parse=${parseMs}ms`);
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
    const result = await this.loadRequiredBundle(path);

    validateBundleEnvelope(result.json, 'data', path);
    return { prefix, data: result.json as DataBundle };
  }

  /** {@inheritDoc TransitDataSourceV2.loadShapes} */
  async loadShapes(prefix: string): Promise<ShapesBundle | null> {
    validatePrefix(prefix);

    const result = await this.loadOptionalBundle(`${prefix}/shapes.json`);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'shapes', `${prefix}/shapes.json`);
    return result.json as ShapesBundle;
  }

  /** {@inheritDoc TransitDataSourceV2.loadInsights} */
  async loadInsights(prefix: string): Promise<InsightsBundle | null> {
    validatePrefix(prefix);

    const result = await this.loadOptionalBundle(`${prefix}/insights.json`);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'insights', `${prefix}/insights.json`);
    return result.json as InsightsBundle;
  }

  /** {@inheritDoc TransitDataSourceV2.loadGlobalInsights} */
  async loadGlobalInsights(): Promise<GlobalInsightsBundle | null> {
    const path = 'global/insights.json';
    const result = await this.loadOptionalBundle(path);
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'global-insights', path);
    return result.json as GlobalInsightsBundle;
  }

  /** {@inheritDoc TransitDataSourceV2.loadDataSourceCatalog} */
  async loadDataSourceCatalog(): Promise<DataSourceCatalogBundle | null> {
    const path = 'global/data-source-catalog.json';
    const result = await this.loadOptionalBundle(path, { timeoutMs: CATALOG_TIMEOUT_MS });
    if (!result) {
      return null;
    }

    validateBundleEnvelope(result.json, 'data-source-catalog', path);
    return result.json as DataSourceCatalogBundle;
  }

  /**
   * Load a required bundle.
   *
   * @param path - Relative path under base (e.g. "tobus/data.json").
   * @param options - Per-call options. `timeoutMs` overrides the instance default.
   * @returns Parsed result with timing metrics.
   * @throws On network error, timeout, HTTP error, non-JSON content-type
   *         (possible SPA fallback), or JSON parse error.
   */
  private async loadRequiredBundle(
    path: string,
    options: FetchBundleOptions = {},
  ): Promise<FetchBundleResult> {
    const result = await this.doLoadBundle(path, false, options);
    if (result === null) {
      // Required load never returns null from doLoadBundle — either succeeds or
      // throws. Guard kept as a defensive invariant assertion.
      throw new Error(`${path}: unexpected null from required load`);
    }
    return result;
  }

  /**
   * Load an optional bundle.
   *
   * @param path - Relative path under base (e.g. "tobus/shapes.json").
   * @param options - Per-call options. `timeoutMs` overrides the instance default.
   * @returns Parsed result with timing metrics, or `null` when unavailable
   *          (404, HTTP error, timeout, network error, non-JSON content-type,
   *          or JSON parse error). Bundle envelope validation is the caller's
   *          responsibility and still throws on mismatch.
   */
  private async loadOptionalBundle(
    path: string,
    options: FetchBundleOptions = {},
  ): Promise<FetchBundleResult | null> {
    return this.doLoadBundle(path, true, options);
  }

  private async fetchBundleText(
    path: string,
    optional: boolean,
    options: FetchBundleOptions,
  ): Promise<FetchBundleTextResult | null> {
    const url = `${this.basePath}/${path}`;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const t0 = performance.now();
    const debugLoggingEnabled = logger.isEnabled('debug');
    const transferCapture = debugLoggingEnabled ? startResourceTransferCapture(url, t0) : null;

    // --- Network request with timeout ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        logger.error(`${path}: timeout after ${timeoutMs}ms`);
        if (optional) {
          return null;
        }
        throw new Error(`${path}: timeout after ${timeoutMs}ms`);
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

    let text: string;
    try {
      text = await response.text();
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        logger.error(`${path}: timeout after ${timeoutMs}ms (during body download)`);
        if (optional) {
          return null;
        }
        throw new Error(`${path}: timeout after ${timeoutMs}ms (during body download)`);
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

    return {
      text,
      sizeApprox: text.length,
      networkMs: Math.round(tNetwork - t0),
      transferMetrics: transferCapture?.readMetrics() ?? null,
    };
  }

  private parseBundleJson(
    path: string,
    text: string,
    optional: boolean,
  ): ParseBundleJsonResult | null {
    const tParseStart = performance.now();

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

    return {
      json,
      parseMs: Math.round(performance.now() - tParseStart),
    };
  }

  /**
   * Load, validate content-type, and parse a JSON bundle file.
   *
   * All outcomes are logged at the appropriate level:
   * - Success: debug (path, transfer/decoded size, network/parse timing)
   * - Timeout: error (always, regardless of optional flag)
   * - Other failures: warn for required, debug for optional
   */
  private async doLoadBundle(
    path: string,
    optional: boolean,
    options: FetchBundleOptions,
  ): Promise<FetchBundleResult | null> {
    const debugLoggingEnabled = logger.isEnabled('debug');
    const fetched = await this.fetchBundleText(path, optional, options);
    if (fetched === null) {
      return null;
    }
    if (debugLoggingEnabled) {
      logFetchMetrics(path, fetched);
    }

    const parsed = this.parseBundleJson(path, fetched.text, optional);
    if (parsed === null) {
      return null;
    }
    if (debugLoggingEnabled) {
      logParseMetrics(path, parsed.parseMs);
    }

    return {
      json: parsed.json,
      sizeApprox: fetched.sizeApprox,
      networkMs: fetched.networkMs,
      parseMs: parsed.parseMs,
    };
  }
}
