/**
 * Report output utilities for ODPT resource checks.
 *
 * URL sanitization has two layers:
 * 1. **Primary**: Resource constructor strips auth params via
 *    {@link stripAuthParams} — all Resource.url values are pre-sanitized.
 *    Warning messages and snapshots use Resource.url, so they are safe.
 * 2. **Defense-in-depth**: This module's {@link sanitizeUrl} provides a
 *    second pass for report output (formatRemoteResourceLine, etc.),
 *    guarding against accidental use of raw URLs.
 *
 * Both layers share the same sensitive parameter list (SENSITIVE_PARAMS),
 * defined once in odpt-resource-warnings.ts.
 */

import type { RemoteResource } from './odpt-resources';
import type { LocalResource } from './odpt-resources';
import { SENSITIVE_PARAMS } from '../../../src/lib/pipeline/odpt-resource-warnings';

// ---------------------------------------------------------------------------
// URL sanitization
// ---------------------------------------------------------------------------

/**
 * Remove all sensitive query parameters from a URL.
 *
 * Defense-in-depth layer for report output. Resource.url is already
 * pre-stripped by stripAuthParams, but this guards against accidental
 * use of raw URLs in formatting functions.
 *
 * @param url - URL to sanitize (may or may not contain sensitive params).
 * @returns URL with all sensitive parameters removed,
 *          or '[malformed-url-redacted]' if unparseable.
 */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const param of SENSITIVE_PARAMS) {
      u.searchParams.delete(param);
    }
    return u.toString();
  } catch {
    // Malformed URL — redact entirely to avoid leaking credentials
    return '[malformed-url-redacted]';
  }
}

/**
 * Extract the `date` query parameter from a URL for display.
 * Input is sanitized first. Purely for human-readable output.
 */
function extractDateParam(url: string): string {
  const safe = sanitizeUrl(url);
  const match = safe.match(/[?&]date=(\d{8})/);
  return match ? match[1] : '';
}

/** Format a single remote resource as a log line. All URLs sanitized. */
export function formatRemoteResourceLine(r: RemoteResource, index: number): string {
  const date = extractDateParam(r.url);
  const avail = r.getPeriodStatus();
  const localMarker = r.isAdopted() ? ' <-- LOCAL' : '';
  const isNew = r.isNew();
  const newMarker = isNew === true || isNew === null ? ' [NEW]' : '';
  // r.url is already stripped by Resource constructor, but sanitizeUrl
  // provides defense-in-depth. Only date param is shown, not full URL.
  return `    #${index + 1}  date=${date}  start_at=${r.startAt}  feed=${r.from ?? '?'} - ${r.to ?? '?'}  ${avail}  uploaded=${r.uploadedAt}${localMarker}${newMarker}`;
}

/** Format the local resource info line. URL sanitized. */
export function formatLocalLine(local: LocalResource): string {
  const date = extractDateParam(local.url);
  return `  Local:      date=${date} downloaded=${local.downloadedAt}`;
}

/** Format the local feed info line. No URL involved. */
export function formatLocalFeedLine(local: LocalResource): string {
  return `  Local feed: ${local.from ?? '?'} - ${local.to ?? '?'}${local.feedVersion ? ` ver=${local.feedVersion}` : ''}`;
}

/**
 * Print the remote resource list for a dataset.
 *
 * @param remotes - RemoteResource instances (sorted by startAt desc).
 */
export function printRemoteResources(remotes: RemoteResource[]): void {
  const sorted = [...remotes].sort((a, b) => b.startAt.localeCompare(a.startAt));
  const validCount = sorted.filter((r) => {
    const s = r.getPeriodStatus();
    return s === 'in' || s === 'in-no-end' || s === 'in-no-start';
  }).length;

  console.log(
    `  Remote:     ${sorted.length} resources, ${validCount} currently valid (sorted by start_at desc)`,
  );

  for (let i = 0; i < sorted.length; i++) {
    console.log(formatRemoteResourceLine(sorted[i], i));
  }
}
