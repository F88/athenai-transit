/**
 * Centralized access and safe parsers for URL query parameters.
 *
 * Numeric parsers validate input strictly — non-numeric, out-of-range,
 * Infinity, NaN, and whitespace-only values are rejected (return null).
 * This prevents injection attacks since only valid numeric values
 * are accepted and passed to downstream consumers.
 *
 * Supported query params:
 * - `?repo=v2|mock` — select repository implementation (default: v2)
 * - `?sources=minkuru,yurimo` — filter data sources by prefix
 * - `?lat=35.68&lng=139.77` — initial map center
 * - `?zm=14` — initial map zoom level
 * - `?time=2026-03-25T20:55:00+09:00` — initial date/time (RFC 3339)
 * - `?diag=v2-load` — run diagnostics (see DEVELOPMENT.md)
 */

import { MAX_ZOOM } from '../config/map-defaults';

/**
 * Lazily cached URLSearchParams instance.
 * Use {@link resetParamsCache} in tests to clear this cache.
 */
let cachedParams: URLSearchParams | null = null;

/**
 * Reset the internal URLSearchParams cache.
 * Exported only for testing — production code should not call this directly.
 * @internal
 */
export function resetParamsCache(): void {
  cachedParams = null;
}

function getParams(): URLSearchParams {
  if (!cachedParams) {
    cachedParams = new URLSearchParams(window.location.search);
  }
  return cachedParams;
}

/** Valid values for the `?repo=` query parameter. */
export type RepoParam = 'v2' | 'mock';

/** Set of recognized `?repo=` values. */
const VALID_REPO_VALUES = new Set<string>(['v2', 'mock']);

/**
 * Returns the `?repo=` param value, defaulting to 'v2'.
 *
 * Controls which TransitRepository implementation is used:
 * - `v2` (default): AthenaiRepositoryV2 (v2 bundle data)
 * - `mock`: MockRepository (fictional in-memory data)
 *
 * @returns The repository selection ('v2' or 'mock').
 */
export function getRepoParam(): RepoParam {
  const value = getParams().get('repo');
  if (value === 'mock') {
    return value;
  }
  return 'v2';
}

/**
 * Extract the raw value of `?time=` from the query string without URLSearchParams,
 * which decodes `+` as space per application/x-www-form-urlencoded spec,
 * breaking timezone offsets like `+09:00`.
 *
 * @returns The raw (URI-decoded) time value, or null if absent.
 */
function getRawTimeValue(): string | null {
  const match = window.location.search.match(/[?&]time=([^&]*)/);
  if (!match) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

/**
 * Remove invalid query parameters from the URL.
 *
 * Validates each supported parameter using its corresponding parser.
 * Parameters that are absent are left alone; parameters that are present
 * but fail validation are removed. Uses `history.replaceState` so the
 * browser history is not polluted.
 *
 * This should be called once at app startup (e.g., in main.tsx) to clean up
 * legacy or invalid values (such as `?repo=v1` after v1 removal, or
 * malformed `?time=`, `?lat=`, `?lng=`, `?zm=` values).
 *
 * Not validated (free-form): `?sources=`, `?diag=`.
 */
export function cleanupInvalidQueryParams(): void {
  const params = getParams();
  const keysToRemove: string[] = [];

  // ?repo= — must be a recognized value
  const repo = params.get('repo');
  if (repo !== null && !VALID_REPO_VALUES.has(repo)) {
    keysToRemove.push('repo');
  }

  // ?time= — must parse as a valid Date.
  // Uses raw query string extraction to preserve `+` in timezone offsets.
  const timeRaw = getRawTimeValue();
  if (timeRaw !== null && parseQueryTime(timeRaw) === null) {
    keysToRemove.push('time');
  }

  // ?lat= — must be a valid latitude (-90..90)
  const lat = params.get('lat');
  if (lat !== null && parseQueryLat(lat) === null) {
    keysToRemove.push('lat');
  }

  // ?lng= — must be a valid longitude (-180..180)
  const lng = params.get('lng');
  if (lng !== null && parseQueryLng(lng) === null) {
    keysToRemove.push('lng');
  }

  // ?zm= — must be a valid zoom level (1..MAX_ZOOM)
  const zm = params.get('zm');
  if (zm !== null && parseQueryZoom(zm) === null) {
    keysToRemove.push('zm');
  }

  if (keysToRemove.length === 0) {
    return;
  }

  // Remove keys from the raw query string to preserve special characters
  // like `+` in timezone offsets (URLSearchParams encodes `+` as space).
  const keysSet = new Set(keysToRemove);
  const rawSearch = window.location.search;
  const pairs = rawSearch
    .slice(1) // remove leading '?'
    .split('&')
    .filter((pair) => {
      const key = pair.split('=')[0];
      return !keysSet.has(decodeURIComponent(key));
    });
  const newSearch = pairs.length > 0 ? `?${pairs.join('&')}` : '';
  const newUrl = `${window.location.pathname}${newSearch}${window.location.hash}`;
  history.replaceState(history.state, '', newUrl);
  resetParamsCache();
}

/**
 * Returns the `?diag=` param value, or null if not present.
 * Used to trigger diagnostic/benchmark tools.
 *
 * @returns The diag parameter value (e.g. "v2-load"), or null.
 */
export function getDiagParam(): string | null {
  return getParams().get('diag');
}

/**
 * Parse a date/time string in RFC 3339 format.
 *
 * Accepts:
 * - Full RFC 3339: `2026-03-25T20:55:00+09:00`
 * - UTC: `2026-03-25T20:55:00Z`
 * - Without timezone (local time): `2026-03-25T20:55`
 * - Without seconds: `2026-03-25T20:55`
 *
 * @param value - Raw string value.
 * @returns Parsed Date, or null if invalid.
 */
export function parseQueryTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Returns the `?time=` param value as a Date, or null if not present or invalid.
 *
 * Uses raw query string parsing instead of URLSearchParams.get()
 * because URLSearchParams decodes `+` as space per
 * application/x-www-form-urlencoded spec, breaking timezone
 * offsets like `+09:00`.
 *
 * @returns Parsed Date, or null if absent or invalid.
 */
export function getTimeParam(): Date | null {
  const match = window.location.search.match(/[?&]time=([^&]*)/);
  if (!match) {
    return null;
  }
  return parseQueryTime(decodeURIComponent(match[1]));
}

/**
 * Returns the `?sources=` param value, or null if not present.
 * The raw string is returned for the caller to split/validate.
 *
 * @returns The sources parameter value, or null.
 */
export function getSourcesParam(): string | null {
  return getParams().get('sources');
}

/**
 * Parse latitude from a query param string.
 * Valid range: -90 to 90. Rejects non-numeric, Infinity, NaN, and whitespace.
 *
 * @param value - Raw string value from URLSearchParams.get().
 * @returns Parsed latitude, or null if invalid.
 */
export function parseQueryLat(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return null;
  }
  if (n < -90 || n > 90) {
    return null;
  }
  return n;
}

/**
 * Parse longitude from a query param string.
 * Valid range: -180 to 180. Rejects non-numeric, Infinity, NaN, and whitespace.
 *
 * @param value - Raw string value from URLSearchParams.get().
 * @returns Parsed longitude, or null if invalid.
 */
export function parseQueryLng(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return null;
  }
  if (n < -180 || n > 180) {
    return null;
  }
  return n;
}

/**
 * Parse zoom level from a query param string.
 * Valid range: 1 to {@link MAX_ZOOM}. Rejects non-numeric, Infinity, NaN, and whitespace.
 *
 * @param value - Raw string value from URLSearchParams.get().
 * @returns Parsed zoom level, or null if invalid.
 */
export function parseQueryZoom(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return null;
  }
  if (n < 1 || n > MAX_ZOOM) {
    return null;
  }
  return n;
}
