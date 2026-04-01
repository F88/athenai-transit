/**
 * Warning detection for ODPT resource checks.
 *
 * Compares local download metadata against remote resource listings
 * to detect actionable conditions like expired data, new resources, etc.
 */

import type { DownloadMetaSuccess } from '../download/download-meta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal remote resource info needed for warning detection.
 *
 * Only three fields are used for decision logic:
 * - `url` — resource identity (auth params excluded for comparison)
 * - `feed_start_date` / `feed_end_date` — feed period evaluation
 *
 * Other API fields (`start_at`, `is_feed_available_period`, `uploaded_at`, etc.)
 * are NOT used for decisions — they are for display/sorting only.
 *
 * @see https://developer.odpt.org/api_addendum
 */
export interface RemoteResource {
  /** エンドポイントURL. Resource identity (auth params excluded for comparison). */
  url: string;
  /** feed_info.txt の feed_start_date. Format: YYYY-MM-DD, or null if absent. */
  feed_start_date: string | null;
  /** feed_info.txt の feed_end_date. Format: YYYY-MM-DD, or null if absent. */
  feed_end_date: string | null;
}

/**
 * Feed availability status for a remote resource.
 *
 * - `in-period`: feed is currently within its valid period
 * - `before-period`: feed period has not started yet (start date is in the future)
 * - `after-period`: feed period has ended
 * - `unknown-period`: feed dates are not available (e.g. no feed_info.txt)
 */
export type FeedStatus = 'in-period' | 'before-period' | 'after-period' | 'unknown-period';

/**
 * Determine the feed availability status of a remote resource.
 *
 * Determined solely from `feed_start_date` and `feed_end_date`.
 * `is_feed_available_period` from the API is NOT used here — it is
 * a reference value that may not account for upcoming data.
 *
 * @param resource - Remote resource to evaluate.
 * @param now - Current date for comparison.
 * @returns Feed availability status.
 */
export function getFeedStatus(resource: RemoteResource, now: Date = new Date()): FeedStatus {
  const { feed_start_date, feed_end_date } = resource;

  if (!feed_start_date && !feed_end_date) {
    return 'unknown-period';
  }

  const nowStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  // Period has ended
  if (feed_end_date && feed_end_date < nowStr) {
    return 'after-period';
  }

  // Period has not started yet
  if (feed_start_date && feed_start_date > nowStr) {
    return 'before-period';
  }

  // Within period (or no boundary to contradict)
  return 'in-period';
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
  | { type: 'NOT_YET_ACTIVE'; message: string }
  | { type: 'REMOVED'; message: string }
  | { type: 'NO_VALID_DATA'; message: string }
  | { type: 'EXPIRING_SOON'; message: string; daysLeft: number }
  | { type: 'NEW_RESOURCE'; message: string; urls: string[] }
  | { type: 'NEWER_AVAILABLE'; message: string; urls: string[] }
  | { type: 'OTHER_AVAILABLE'; message: string; urls: string[] }
  | { type: 'NO_DOWNLOAD_REPORT'; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the URL base path without query string.
 *
 * Used to strip query parameters (including auth tokens) for safe
 * logging — prevents credential leakage in CI output and Slack.
 *
 * @param url - Full URL with optional query string.
 * @returns URL without the query string portion.
 */
export function extractUrlBase(url: string): string {
  const idx = url.indexOf('?');
  return idx >= 0 ? url.substring(0, idx) : url;
}

/**
 * Strip authentication parameters from a URL, keeping all other
 * query parameters intact. Used for resource identity comparison
 * — two URLs that differ only by auth token are the same resource.
 *
 * @param url - Full URL that may contain `acl:consumerKey` param.
 * @returns URL without auth parameters.
 */
export function stripAuthParams(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('acl:consumerKey');
    return u.toString();
  } catch {
    return url;
  }
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
export const EXPIRING_SOON_DAYS = 10;

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

  // Find LOCAL resource in remote list, ignoring auth tokens.
  const localUrl = meta.url;
  const localUrlStripped = stripAuthParams(localUrl);
  const localInRemote = resources.find((r) => stripAuthParams(r.url) === localUrlStripped);

  // REMOVED: LOCAL not found in remote
  if (!localInRemote) {
    warnings.push({ type: 'REMOVED', message: 'Local resource no longer exists in remote' });
  }

  // EXPIRED or NOT_YET_ACTIVE: LOCAL feed period is not current.
  if (localInRemote) {
    const localStatus = getFeedStatus(localInRemote, now);
    if (localStatus === 'before-period') {
      warnings.push({
        type: 'NOT_YET_ACTIVE',
        message: `Local data not yet active (valid: ${localInRemote.feed_start_date ?? '?'} - ${localInRemote.feed_end_date ?? '?'})`,
      });
    } else if (localStatus === 'after-period' || localStatus === 'unknown-period') {
      warnings.push({
        type: 'EXPIRED',
        message: localInRemote.feed_end_date
          ? `Local data expired (feed_end: ${localInRemote.feed_end_date})`
          : 'Local data expired (no feed_end_date)',
      });
    }
  }

  // NO_VALID_DATA: no resources with feed period that includes today
  const validCount = resources.filter((r) => getFeedStatus(r, now) === 'in-period').length;
  if (validCount === 0) {
    warnings.push({ type: 'NO_VALID_DATA', message: 'No currently valid resources available' });
  }

  // EXPIRING_SOON: LOCAL feed_end_date is within threshold.
  // Only relevant when the feed is currently active.
  const localIsActive = localInRemote ? getFeedStatus(localInRemote, now) === 'in-period' : false;
  if (localIsActive && meta.feedInfo?.endDate) {
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

  // NEW_RESOURCE: resources not seen in previous check.
  // On first run (no snapshot), all resources are treated as new.
  const previousUrls = new Set(previousSnapshot?.resourceUrls ?? []);
  const newUrls = resources.map((r) => r.url).filter((url) => !previousUrls.has(url));
  if (newUrls.length > 0) {
    warnings.push({
      type: 'NEW_RESOURCE',
      message: `${newUrls.length} new resource(s) since last check`,
      urls: newUrls,
    });
  }

  // NEWER_AVAILABLE / OTHER_AVAILABLE: remote resources with a different URL
  // than local whose feed period has not ended (in-period or before-period).
  // Decision uses only: url (identity) + feed_start_date/feed_end_date (period).
  // Unlike NEW_RESOURCE (snapshot-based, fires once), these fire every time
  // until the local data is updated, so unapplied resources stay visible.
  //
  // Split by feed_start_date comparison against local:
  //   NEWER_AVAILABLE: feed_start_date > local → genuinely newer data
  //   OTHER_AVAILABLE: feed_start_date <= local or unknown → old or same period
  const localFeedStart = localInRemote?.feed_start_date ?? meta.feedInfo?.startDate ?? null;
  const unappliedResources = resources.filter((r) => {
    if (stripAuthParams(r.url) === localUrlStripped) {
      return false;
    }
    const status = getFeedStatus(r, now);
    return status === 'in-period' || status === 'before-period';
  });
  const newerResources = unappliedResources.filter(
    (r) => localFeedStart && r.feed_start_date && r.feed_start_date > localFeedStart,
  );
  const otherResources = unappliedResources.filter(
    (r) => !localFeedStart || !r.feed_start_date || r.feed_start_date <= localFeedStart,
  );
  if (newerResources.length > 0) {
    const details = newerResources
      .map((r) => `valid: ${r.feed_start_date ?? '?'} - ${r.feed_end_date ?? '?'}`)
      .join(', ');
    warnings.push({
      type: 'NEWER_AVAILABLE',
      message: `${newerResources.length} newer resource(s) available (${details})`,
      urls: newerResources.map((r) => r.url),
    });
  }
  if (otherResources.length > 0) {
    const details = otherResources
      .map((r) => `valid: ${r.feed_start_date ?? '?'} - ${r.feed_end_date ?? '?'}`)
      .join(', ');
    warnings.push({
      type: 'OTHER_AVAILABLE',
      message: `${otherResources.length} other resource(s) available (${details})`,
      urls: otherResources.map((r) => r.url),
    });
  }

  return warnings;
}
