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

import type {
  BundleLoadEvent,
  BundleLoadFailureReason,
  BundleLoadKind,
  BundleLoadMetrics,
  BundleLoadReporter,
} from './load-events';
import {
  parseBundleJson as parseBundleJsonText,
  type ParseBundleJsonResult,
} from './lib/parse-bundle-json';
import { validateBundleEnvelope as assertBundleEnvelope } from './lib/validate-bundle-envelope';
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

type LogLevel = 'debug' | 'warn' | 'error';

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
   * `0` when the browser reports that no network transfer was required.
   */
  transferSize: number;
  /** Compressed body size — the bytes actually downloaded. */
  encodedBodySize: number;
  /** Uncompressed body size. Matches the file size on disk. */
  decodedBodySize: number;
  /** `true` when no network transfer was reported (`transferSize === 0`). */
  noNetworkTransfer: boolean;
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
    noNetworkTransfer: entry.transferSize === 0,
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

interface TimedFetchResult {
  response: Response;
  timeoutId: ReturnType<typeof setTimeout>;
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
  if (metrics.noNetworkTransfer) {
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
  private loadEventReporter: BundleLoadReporter | undefined;

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

  setLoadEventReporter(reporter: BundleLoadReporter | undefined): void {
    this.loadEventReporter = reporter;
  }

  /** {@inheritDoc TransitDataSourceV2.loadData} */
  async loadData(prefix: string): Promise<SourceDataV2> {
    validatePrefix(prefix);

    const path = `${prefix}/data.json`;
    const data = await this.loadRequiredTypedBundle<DataBundle>(path, 'data');
    return { prefix, data };
  }

  /** {@inheritDoc TransitDataSourceV2.loadShapes} */
  async loadShapes(prefix: string): Promise<ShapesBundle | null> {
    validatePrefix(prefix);
    return this.loadOptionalTypedBundle<ShapesBundle>(`${prefix}/shapes.json`, 'shapes');
  }

  /** {@inheritDoc TransitDataSourceV2.loadInsights} */
  async loadInsights(prefix: string): Promise<InsightsBundle | null> {
    validatePrefix(prefix);
    return this.loadOptionalTypedBundle<InsightsBundle>(`${prefix}/insights.json`, 'insights');
  }

  /** {@inheritDoc TransitDataSourceV2.loadGlobalInsights} */
  async loadGlobalInsights(): Promise<GlobalInsightsBundle | null> {
    return this.loadOptionalTypedBundle<GlobalInsightsBundle>(
      'global/insights.json',
      'global-insights',
    );
  }

  /** {@inheritDoc TransitDataSourceV2.loadDataSourceCatalog} */
  async loadDataSourceCatalog(): Promise<DataSourceCatalogBundle | null> {
    return this.loadOptionalTypedBundle<DataSourceCatalogBundle>(
      'global/data-source-catalog.json',
      'data-source-catalog',
      { timeoutMs: CATALOG_TIMEOUT_MS },
    );
  }

  private async loadRequiredTypedBundle<T>(
    path: string,
    expectedKind: string,
    options: FetchBundleOptions = {},
  ): Promise<T> {
    const result = await this.loadRequiredBundle(path, options);
    assertBundleEnvelope(result.json, expectedKind, path);
    return result.json as T;
  }

  private async loadOptionalTypedBundle<T>(
    path: string,
    expectedKind: string,
    options: FetchBundleOptions = {},
  ): Promise<T | null> {
    const result = await this.loadOptionalBundle(path, options);
    if (!result) {
      return null;
    }

    assertBundleEnvelope(result.json, expectedKind, path);
    return result.json as T;
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

    const fetched = await this.fetchResponseWithTimeout(path, url, timeoutMs, optional);
    if (fetched === null) {
      return null;
    }

    const { response, timeoutId } = fetched;
    const validatedResponse = this.validateJsonResponse(path, response, timeoutId, optional);
    if (validatedResponse === null) {
      return null;
    }

    const text = await this.readBundleText(path, validatedResponse, timeoutId, timeoutMs, optional);
    if (text === null) {
      return null;
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

  private async fetchResponseWithTimeout(
    path: string,
    url: string,
    timeoutMs: number,
    optional: boolean,
  ): Promise<TimedFetchResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      return { response, timeoutId };
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        return this.handleBundleFailure(path, optional, 'timeout', `timeout after ${timeoutMs}ms`, {
          requiredLevel: 'error',
          optionalLevel: 'error',
        });
      }
      return this.handleBundleFailure(path, optional, 'network-error', 'network error', {
        requiredLevel: 'warn',
        optionalLevel: 'debug',
        cause: e,
      });
    }
  }

  private validateJsonResponse(
    path: string,
    response: Response,
    timeoutId: ReturnType<typeof setTimeout>,
    optional: boolean,
  ): Response | null {
    // clearTimeout is deferred until after response.text() so that the
    // timeout covers the entire transfer, not just the headers.
    if (response.status === 404) {
      clearTimeout(timeoutId);
      return this.handleBundleFailure(path, optional, 'http-error', 'HTTP 404', {
        requiredLevel: 'warn',
        optionalLevel: 'debug',
      });
    }
    if (!response.ok) {
      clearTimeout(timeoutId);
      return this.handleBundleFailure(path, optional, 'http-error', `HTTP ${response.status}`, {
        requiredLevel: 'warn',
        optionalLevel: 'debug',
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      clearTimeout(timeoutId);
      return this.handleBundleFailure(
        path,
        optional,
        'non-json',
        `expected application/json but got "${contentType}" (possible SPA fallback)`,
        {
          requiredLevel: 'warn',
          optionalLevel: 'debug',
        },
      );
    }

    return response;
  }

  private async readBundleText(
    path: string,
    response: Response,
    timeoutId: ReturnType<typeof setTimeout>,
    timeoutMs: number,
    optional: boolean,
  ): Promise<string | null> {
    try {
      return await response.text();
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      if (isTimeout) {
        return this.handleBundleFailure(
          path,
          optional,
          'timeout',
          `timeout after ${timeoutMs}ms (during body download)`,
          {
            requiredLevel: 'error',
            optionalLevel: 'error',
          },
        );
      }
      return this.handleBundleFailure(path, optional, 'body-read-error', 'body read error', {
        requiredLevel: 'warn',
        optionalLevel: 'debug',
        cause: e,
      });
    }
  }

  private parseBundleJsonWithPolicy(
    path: string,
    text: string,
    optional: boolean,
  ): ParseBundleJsonResult | null {
    try {
      return parseBundleJsonText(text);
    } catch (e) {
      return this.handleBundleFailure(path, optional, 'json-parse-error', 'JSON parse error', {
        requiredLevel: 'warn',
        optionalLevel: 'warn',
        cause: e,
      });
    }
  }

  private handleBundleFailure(
    path: string,
    optional: boolean,
    reason: BundleLoadFailureReason,
    message: string,
    options: {
      requiredLevel: LogLevel;
      optionalLevel: LogLevel;
      cause?: unknown;
    },
  ): null {
    if (optional) {
      this.emitBundleLoadEvent({
        ...describeBundleLoadTarget(path, optional),
        type: 'skipped',
        reason,
        message,
      });
      this.logBundleFailure(options.optionalLevel, `${path}: ${message} (optional, skipping)`, {
        cause: options.cause,
      });
      return null;
    }

    this.emitBundleLoadEvent({
      ...describeBundleLoadTarget(path, optional),
      type: 'failed',
      reason,
      message,
    });
    this.logBundleFailure(options.requiredLevel, `${path}: ${message}`, { cause: options.cause });
    if (options.cause === undefined) {
      throw new Error(`${path}: ${message}`);
    }
    throw new Error(`${path}: ${message}`, { cause: options.cause });
  }

  private logBundleFailure(
    level: LogLevel,
    message: string,
    options: { cause?: unknown } = {},
  ): void {
    if (options.cause === undefined) {
      logger[level](message);
      return;
    }
    logger[level](message, options.cause);
  }

  private emitBundleLoadEvent(event: BundleLoadEvent): void {
    this.loadEventReporter?.(event);
  }

  /**
   * Load, validate content-type, and parse a JSON bundle file.
   *
   * All outcomes are logged at the appropriate level:
   * - Success: debug (path, transfer/decoded size, network/parse timing)
   * - Timeout: error (always, regardless of optional flag)
   * - Other failures: warn for required, debug for optional except parse
   *   errors, which are warned even for optional bundles
   */
  private async doLoadBundle(
    path: string,
    optional: boolean,
    options: FetchBundleOptions,
  ): Promise<FetchBundleResult | null> {
    const target = describeBundleLoadTarget(path, optional);
    this.emitBundleLoadEvent({ ...target, type: 'started' });
    const debugLoggingEnabled = logger.isEnabled('debug');
    const fetched = await this.fetchBundleText(path, optional, options);
    if (fetched === null) {
      return null;
    }
    if (debugLoggingEnabled) {
      logFetchMetrics(path, fetched);
    }

    const parsed = this.parseBundleJsonWithPolicy(path, fetched.text, optional);
    if (parsed === null) {
      return null;
    }
    if (debugLoggingEnabled) {
      logParseMetrics(path, parsed.parseMs);
    }

    const metrics: BundleLoadMetrics = {
      transferBytes: fetched.transferMetrics?.encodedBodySize,
      decodedBytes: fetched.transferMetrics?.decodedBodySize,
      estimatedDecodedBytes: fetched.sizeApprox,
      networkMs: fetched.networkMs,
      parseMs: parsed.parseMs,
    };
    this.emitBundleLoadEvent({
      ...target,
      type: 'succeeded',
      metrics,
    });

    return {
      json: parsed.json,
      sizeApprox: fetched.sizeApprox,
      networkMs: fetched.networkMs,
      parseMs: parsed.parseMs,
    };
  }
}

function describeBundleLoadTarget(
  path: string,
  optional: boolean,
): {
  path: string;
  prefix: string | null;
  kind: BundleLoadKind;
  optional: boolean;
} {
  if (path === 'global/insights.json') {
    return { path, prefix: null, kind: 'global-insights', optional };
  }
  if (path === 'global/data-source-catalog.json') {
    return { path, prefix: null, kind: 'data-source-catalog', optional };
  }

  const slashIndex = path.indexOf('/');
  if (slashIndex === -1) {
    return { path, prefix: null, kind: 'unknown', optional };
  }
  const prefix = path.slice(0, slashIndex);
  const fileName = path.slice(slashIndex + 1);
  const kind = fileNameToBundleKind(fileName);
  return { path, prefix, kind, optional };
}

function fileNameToBundleKind(fileName: string): BundleLoadKind {
  switch (fileName) {
    case 'data.json':
      return 'data';
    case 'shapes.json':
      return 'shapes';
    case 'insights.json':
      return 'insights';
    default:
      return 'unknown';
  }
}
