/**
 * Centralized access and safe parsers for URL query parameters.
 *
 * Numeric parsers validate input strictly — non-numeric, out-of-range,
 * Infinity, NaN, and whitespace-only values are rejected (return null).
 * This prevents injection attacks since only valid numeric values
 * are accepted and passed to downstream consumers.
 *
 * Supported query params:
 * - `?repo=v1|v2|mock` — select repository implementation (default: v2)
 * - `?sources=minkuru,yurimo` — filter data sources by prefix
 * - `?lat=35.68&lng=139.77` — initial map center
 * - `?zm=14` — initial map zoom level
 * - `?time=2026-03-25T20:55:00+09:00` — initial date/time (RFC 3339)
 * - `?diag=v2-load` — run diagnostics (see DEVELOPMENT.md)
 */

import { MAX_ZOOM } from '../config/map-defaults';

/** Lazily cached URLSearchParams instance. */
let cachedParams: URLSearchParams | null = null;

function getParams(): URLSearchParams {
  if (!cachedParams) {
    cachedParams = new URLSearchParams(window.location.search);
  }
  return cachedParams;
}

/** Valid values for the `?repo=` query parameter. */
export type RepoParam = 'v2' | 'mock';

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
