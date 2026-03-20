/**
 * Warning detection for ODPT resource checks.
 *
 * Compares local download metadata against remote resource listings
 * to detect actionable conditions like expired data, new resources, etc.
 */

import type { DownloadMetaSuccess } from './download/download-meta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal remote resource info needed for warning detection. */
export interface RemoteResource {
  url: string;
  is_feed_available_period: boolean;
  feed_end_date: string;
}

/** Previous check snapshot for diff detection. */
export interface ResourceSnapshot {
  resourceUrls: string[];
}

/** Local source info for warning detection. */
export interface LocalInfo {
  downloadMeta: DownloadMetaSuccess | null;
}

export type Warning =
  | { type: 'EXPIRED'; message: string }
  | { type: 'REMOVED'; message: string }
  | { type: 'NO_VALID_DATA'; message: string }
  | { type: 'EXPIRING_SOON'; message: string; daysLeft: number }
  | { type: 'NEW_RESOURCE'; message: string; urls: string[] }
  | { type: 'NO_DOWNLOAD_REPORT'; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the `date` query parameter (YYYYMMDD) from a download URL.
 *
 * @param url - Download URL that may contain a `?date=YYYYMMDD` or `&date=YYYYMMDD` parameter.
 * @returns The 8-digit date string, or null if no date parameter is present.
 */
export function extractDateParam(url: string): string | null {
  const match = url.match(/[?&]date=(\d{8})/);
  return match ? match[1] : null;
}

/**
 * Extract the URL base path without query string.
 *
 * Used to match remote and local resources by their path,
 * ignoring date or authentication query parameters.
 *
 * @param url - Full URL with optional query string.
 * @returns URL without the query string portion.
 */
export function extractUrlBase(url: string): string {
  const idx = url.indexOf('?');
  return idx >= 0 ? url.substring(0, idx) : url;
}

/**
 * Calculate the number of days until a YYYYMMDD date string expires.
 *
 * @param endDateStr - End date in YYYYMMDD format.
 * @param now - Current date for comparison (defaults to new Date()).
 * @returns Number of days remaining (negative if already expired).
 */
export function getDaysUntilExpiry(endDateStr: string, now: Date = new Date()): number {
  const endDate = new Date(
    Date.UTC(
      Number(endDateStr.substring(0, 4)),
      Number(endDateStr.substring(4, 6)) - 1,
      Number(endDateStr.substring(6, 8)),
    ),
  );
  return Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Days before feed_end_date to trigger EXPIRING_SOON. */
export const EXPIRING_SOON_DAYS = 14;

/**
 * Detect warnings by comparing local state against remote resources.
 *
 * @param resources - Remote resources from Members Portal API.
 * @param local - Local source info with download metadata.
 * @param previousSnapshot - Previous check snapshot for diff detection, or null.
 * @param now - Current date for expiry calculation (defaults to new Date()).
 * @returns Array of detected warnings.
 */
export function detectWarnings(
  resources: RemoteResource[],
  local: LocalInfo,
  previousSnapshot: ResourceSnapshot | null,
  now: Date = new Date(),
): Warning[] {
  const warnings: Warning[] = [];
  const meta = local.downloadMeta;

  if (!meta) {
    warnings.push({
      type: 'NO_DOWNLOAD_REPORT',
      message: 'No download report — run download first',
    });
    return warnings;
  }

  // Find LOCAL resource in remote list
  const localUrl = meta.url;
  const localInRemote = resources.find(
    (r) =>
      extractUrlBase(r.url) === extractUrlBase(localUrl) &&
      extractDateParam(r.url) === extractDateParam(localUrl),
  );

  // REMOVED: LOCAL not found in remote
  if (!localInRemote) {
    warnings.push({ type: 'REMOVED', message: 'Local resource no longer exists in remote' });
  }

  // EXPIRED: LOCAL is no longer valid
  if (localInRemote && !localInRemote.is_feed_available_period) {
    warnings.push({
      type: 'EXPIRED',
      message: `Local data expired (feed_end: ${localInRemote.feed_end_date})`,
    });
  }

  // NO_VALID_DATA: no valid resources at all
  const validCount = resources.filter((r) => r.is_feed_available_period).length;
  if (validCount === 0) {
    warnings.push({ type: 'NO_VALID_DATA', message: 'No currently valid resources available' });
  }

  // EXPIRING_SOON: LOCAL feed_end_date is within threshold
  if (meta.feedInfo?.endDate) {
    const endStr = meta.feedInfo.endDate;
    const daysLeft = getDaysUntilExpiry(endStr, now);
    if (daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS) {
      warnings.push({
        type: 'EXPIRING_SOON',
        message: `Local data expires in ${daysLeft} days (${endStr})`,
        daysLeft,
      });
    }
  }

  // NEW_RESOURCE: resources added since last check
  if (previousSnapshot) {
    const previousUrls = new Set(previousSnapshot.resourceUrls);
    const newUrls = resources.map((r) => r.url).filter((url) => !previousUrls.has(url));
    if (newUrls.length > 0) {
      warnings.push({
        type: 'NEW_RESOURCE',
        message: `${newUrls.length} new resource(s) since last check`,
        urls: newUrls,
      });
    }
  }

  return warnings;
}
