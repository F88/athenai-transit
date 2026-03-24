/**
 * Centralized access and safe parsers for URL query parameters.
 *
 * Numeric parsers validate input strictly — non-numeric, out-of-range,
 * Infinity, NaN, and whitespace-only values are rejected (return null).
 * This prevents injection attacks since only valid numeric values
 * are accepted and passed to downstream consumers.
 *
 * Supported query params:
 * - `?mock-data` — use MockRepository
 * - `?sources=minkuru,yurimo` — filter data sources by prefix
 * - `?lat=35.68&lng=139.77` — initial map center
 * - `?zm=14` — initial map zoom level
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

/**
 * Returns true if `?mock-data` is present in the URL.
 *
 * @returns Whether the mock-data query parameter is set.
 */
export function hasMockDataParam(): boolean {
  return getParams().has('mock-data');
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
