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
 * - `?stop=keio_S0123` — initial stop selection (overrides lat/lng)
 * - `?tileIdx=0` — initial tile source index (0-based, overrides localStorage)
 * - `?diag=v2-load` — run diagnostics (see DEVELOPMENT.md)
 */

import { DEFAULT_MAX_ZOOM } from '../config/map-constants';

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
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return ''; // malformed percent-encoding — returns empty so cleanup treats it as invalid
  }
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
 *
 * @param tileSourceCount - Number of available tile sources (for `?tileIdx=` validation).
 */
export function cleanupInvalidQueryParams(tileSourceCount: number): void {
  const params = getParams();
  const keysToRemove: string[] = [];

  const repo = params.get('repo');
  if (repo !== null && !VALID_REPO_VALUES.has(repo)) {
    keysToRemove.push('repo');
  }

  // Use raw query extraction here so timezone offsets like `+09:00`
  // are preserved instead of being decoded as spaces.
  const timeRaw = getRawTimeValue();
  if (timeRaw !== null && parseQueryTime(timeRaw) === null) {
    keysToRemove.push('time');
  }

  const lat = params.get('lat');
  if (lat !== null && parseQueryLat(lat) === null) {
    keysToRemove.push('lat');
  }

  const lng = params.get('lng');
  if (lng !== null && parseQueryLng(lng) === null) {
    keysToRemove.push('lng');
  }

  const zm = params.get('zm');
  if (zm !== null && parseQueryZoom(zm) === null) {
    keysToRemove.push('zm');
  }

  const stop = params.get('stop');
  if (stop !== null && parseQueryStopId(stop) === null) {
    keysToRemove.push('stop');
  }

  const tileIdx = params.get('tileIdx');
  if (tileIdx !== null && parseQueryTileIdx(tileIdx, tileSourceCount) === undefined) {
    keysToRemove.push('tileIdx');
  }

  if (keysToRemove.length === 0) {
    return;
  }

  // Rebuild from the raw query string so valid `time=` values keep their
  // original `+HH:MM` timezone offsets while invalid keys are removed.
  const keysSet = new Set(keysToRemove);
  const rawSearch = window.location.search;
  const pairs = rawSearch
    .slice(1)
    .split('&')
    .filter(Boolean)
    .filter((pair) => {
      const key = pair.split('=')[0];
      try {
        return !keysSet.has(decodeURIComponent(key));
      } catch {
        return true;
      }
    });
  const newSearch = pairs.length > 0 ? `?${pairs.join('&')}` : '';
  const newUrl = `${window.location.pathname}${newSearch}${window.location.hash}`;
  history.replaceState(history.state, '', newUrl);
  resetParamsCache();
}

/**
 * Parse a stop ID from a query param string.
 *
 * A valid stop ID is a non-empty, non-whitespace string.
 * No further validation is possible without the repository.
 *
 * @param value - Raw string value from URLSearchParams.get().
 * @returns Trimmed stop ID, or null if empty/whitespace-only.
 */
export function parseQueryStopId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

/**
 * Returns the `?stop=` param value, or null if not present.
 *
 * When present, the app selects this stop on initial load
 * and pans the map to its location. This takes priority over
 * `?lat=` / `?lng=` for determining the initial map center.
 *
 * @returns The stop ID, or null if absent or empty.
 */
export function getStopParam(): string | null {
  return parseQueryStopId(getParams().get('stop'));
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
 * Parse a date/time string in ISO 8601 / RFC 3339 format.
 *
 * Validates format with a regex before passing to `new Date()` to
 * avoid browser-dependent parsing of non-standard strings.
 *
 * Accepts:
 * - Full RFC 3339: `2026-03-25T20:55:00+09:00`
 * - UTC: `2026-03-25T20:55:00Z`
 * - Without timezone (local time): `2026-03-25T20:55`
 * - Without seconds: `2026-03-25T20:55`
 * - Date only: `2026-03-25` (parsed as UTC midnight)
 *
 * @param value - Raw string value.
 * @returns Parsed Date, or null if absent or invalid format.
 */
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/;

export function parseQueryTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (!ISO_DATE_TIME_RE.test(value)) {
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
  try {
    return parseQueryTime(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
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
 * Valid range: 1 to {@link DEFAULT_MAX_ZOOM}. Rejects non-numeric, Infinity, NaN, and whitespace.
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
  if (n < 1 || n > DEFAULT_MAX_ZOOM) {
    return null;
  }
  return n;
}

/**
 * Parse a tile source index from a query param string.
 * Valid range: 0 to `tileSourceCount - 1` (integer only).
 * Rejects non-numeric, non-integer, Infinity, NaN, and whitespace.
 *
 * @param value - Raw string value from URLSearchParams.get().
 * @param tileSourceCount - Number of available tile sources.
 * @returns Parsed tile index, or undefined if invalid/absent.
 *          Returns `undefined` (not `null`) to distinguish "no param" from
 *          "explicitly set to null" in {@link UserSettings.tileIndex}.
 */
export function parseQueryTileIdx(
  value: string | null | undefined,
  tileSourceCount: number,
): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n) || !Number.isInteger(n)) {
    return undefined;
  }
  if (n < 0 || n >= tileSourceCount) {
    return undefined;
  }
  return n;
}

/**
 * Returns the `?tileIdx=` param value, or undefined if not present or invalid.
 *
 * When present, the app uses this tile source on initial load,
 * overriding the localStorage setting. The localStorage value is
 * not updated — the override is temporary until the user changes
 * the tile via UI.
 *
 * @param tileSourceCount - Number of available tile sources.
 * @returns Parsed tile index, or undefined if absent or invalid.
 */
export function getTileIdxParam(tileSourceCount: number): number | undefined {
  return parseQueryTileIdx(getParams().get('tileIdx'), tileSourceCount);
}
