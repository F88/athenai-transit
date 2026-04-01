/**
 * Warning detection for ODPT resource checks.
 *
 * Uses Resource/LocalResource/RemoteResource classes for state evaluation.
 * Warning types are derived from 3 axes:
 * - Period status (8 states from Resource.getPeriodStatus)
 * - Adopted status (LocalResource.isAdopted / RemoteResource.isAdopted)
 * - Snapshot status (RemoteResource.isNew)
 */

import type { DownloadMetaSuccess } from '../download/download-meta';
import {
  LocalResource,
  RemoteResource,
} from '../../../scripts/pipeline/lib/odpt-resources';
import type { PeriodStatus } from '../../../scripts/pipeline/lib/odpt-resources';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  | { type: 'NEW_IN_PERIOD'; message: string }
  | { type: 'KNOWN_IN_PERIOD'; message: string }
  | { type: 'NEW_BEFORE_PERIOD'; message: string }
  | { type: 'KNOWN_BEFORE_PERIOD'; message: string }
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

/** Whether a PeriodStatus represents "in period" (any variant). */
function isInPeriod(status: PeriodStatus): boolean {
  return status === 'in' || status === 'in-no-end' || status === 'in-no-start';
}

/** Whether a PeriodStatus represents "before period" (any variant). */
function isBeforePeriod(status: PeriodStatus): boolean {
  return status === 'before' || status === 'before-no-end';
}

/**
 * Detect warnings using Resource classes.
 *
 * @param local - LocalResource (adopted), or null if no download metadata.
 * @param remotes - RemoteResource instances from Members Portal API.
 * @param now - Current date for period evaluation.
 * @returns Array of detected warnings.
 */
export function detectWarnings(
  local: LocalResource | null,
  remotes: RemoteResource[],
  now: Date = new Date(),
): Warning[] {
  const warnings: Warning[] = [];

  // --- LocalResource checks ---

  if (!local) {
    warnings.push({
      type: 'NO_DOWNLOAD_REPORT',
      message: 'No download report — run download first',
    });
    return warnings;
  }

  if (!local.isAdopted()) {
    warnings.push({ type: 'REMOVED', message: 'Local resource no longer exists in remote' });
  }

  const localStatus = local.getPeriodStatus(now);
  if (isBeforePeriod(localStatus)) {
    warnings.push({
      type: 'NOT_YET_ACTIVE',
      message: `Local data not yet active (valid: ${local.from ?? '?'} - ${local.to ?? '?'})`,
    });
  } else if (!isInPeriod(localStatus) && localStatus !== 'unknown') {
    warnings.push({
      type: 'EXPIRED',
      message: local.to
        ? `Local data expired (feed_end: ${local.to})`
        : 'Local data expired (no feed_end_date)',
    });
  } else if (localStatus === 'unknown') {
    warnings.push({
      type: 'EXPIRED',
      message: 'Local data expired (no feed_end_date)',
    });
  }

  if (local.isExpiringSoon(now, EXPIRING_SOON_DAYS)) {
    const daysLeft = getDaysUntilExpiry(local.to!.replace(/-/g, ''), now);
    warnings.push({
      type: 'EXPIRING_SOON',
      message: `Local data expires in ${daysLeft} days (${local.to})`,
      daysLeft,
    });
  }

  // --- Aggregate check ---

  const inPeriodCount = remotes.filter((r) => isInPeriod(r.getPeriodStatus(now))).length;
  if (inPeriodCount === 0) {
    warnings.push({ type: 'NO_VALID_DATA', message: 'No currently valid resources available' });
  }

  // --- RemoteResource checks (non-adopted only) ---

  for (const remote of remotes) {
    if (remote.isAdopted()) {
      continue;
    }

    const status = remote.getPeriodStatus(now);
    const isNewResource = remote.isNew() ?? true; // no-snapshot → treat as new

    if (isInPeriod(status)) {
      warnings.push({
        type: isNewResource ? 'NEW_IN_PERIOD' : 'KNOWN_IN_PERIOD',
        message: `${remote.url} (valid: ${remote.from ?? '?'} - ${remote.to ?? '?'})`,
      });
    } else if (isBeforePeriod(status)) {
      warnings.push({
        type: isNewResource ? 'NEW_BEFORE_PERIOD' : 'KNOWN_BEFORE_PERIOD',
        message: `${remote.url} (valid: ${remote.from ?? '?'} - ${remote.to ?? '?'})`,
      });
    }
    // after-period / unknown → no warning
  }

  return warnings;
}
