/**
 * Resource model for ODPT resource checks.
 *
 * Base class provides period status evaluation from start_date / end_date.
 * LocalResource and RemoteResource add context-specific attributes.
 */

import type { ResourceSnapshot } from '../../../src/lib/pipeline/odpt-resource-warnings';
import { stripAuthParams } from '../../../src/lib/pipeline/odpt-resource-warnings';

// ---------------------------------------------------------------------------
// Period status
// ---------------------------------------------------------------------------

/**
 * Period status derived from start_date (from) / end_date (to) vs today.
 *
 * 8 states from the combination of:
 *   from: present / null
 *   to:   present / null
 *   today vs dates: before / in / after
 *
 * from あり + to あり:
 *   1. today < from         → 'before'
 *   2. from <= today <= to  → 'in'
 *   3. today > to           → 'after'
 *
 * from あり + to null:
 *   4. today < from         → 'before-no-end'
 *   5. today >= from        → 'in-no-end'
 *
 * from null + to あり:
 *   6. today <= to          → 'in-no-start'
 *   7. today > to           → 'after-no-start'
 *
 * both null:
 *   8. 'unknown'
 */
export type PeriodStatus =
  | 'before'
  | 'in'
  | 'after'
  | 'before-no-end'
  | 'in-no-end'
  | 'in-no-start'
  | 'after-no-start'
  | 'unknown';

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

/**
 * Base resource with optional validity period.
 * Both local (adopted) and remote resources share the same period logic.
 */
export class Resource {
  readonly url: string;
  /** Period start date (YYYY-MM-DD), or null if unknown. */
  readonly from: string | null;
  /** Period end date (YYYY-MM-DD), or null if unknown. */
  readonly to: string | null;

  constructor(url: string, from: string | null, to: string | null) {
    this.url = stripAuthParams(url);
    this.from = from;
    this.to = to;
  }

  /** Whether feed_end is within threshold days from now. Only meaningful when in-period. */
  isExpiringSoon(now: Date, thresholdDays: number): boolean {
    if (!this.to) {
      return false;
    }
    const status = this.getPeriodStatus(now);
    if (status !== 'in') {
      return false;
    }
    const endDate = new Date(
      Date.UTC(
        Number(this.to.substring(0, 4)),
        Number(this.to.substring(5, 7)) - 1,
        Number(this.to.substring(8, 10)),
      ),
    );
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= thresholdDays;
  }

  /** Determine period status from this resource's from/to vs now. */
  getPeriodStatus(now: Date = new Date()): PeriodStatus {
    const nowStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    if (this.from && this.to) {
      if (nowStr < this.from) {
        return 'before';
      }
      if (nowStr > this.to) {
        return 'after';
      }
      return 'in';
    }
    if (this.from && !this.to) {
      if (nowStr < this.from) {
        return 'before-no-end';
      }
      return 'in-no-end';
    }
    if (!this.from && this.to) {
      if (nowStr > this.to) {
        return 'after-no-start';
      }
      return 'in-no-start';
    }
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Local resource (adopted)
// ---------------------------------------------------------------------------

/**
 * The currently adopted (downloaded) resource.
 * Created from downloadMeta.
 *
 * Status methods (inherited from Resource):
 * - getPeriodStatus(now) → 8 period states
 * - isExpiringSoon(now, thresholdDays) → whether feed_end is within threshold
 *
 * Note: adopted-missing (URL not in remote list) is determined by the caller
 * by checking if any RemoteResource.isAdopted() returns true.
 */
export class LocalResource extends Resource {
  readonly downloadedAt: string;
  readonly feedVersion?: string;

  private readonly remoteUrls: string[];

  constructor(
    params: {
      url: string;
      from: string | null;
      to: string | null;
      downloadedAt: string;
      feedVersion?: string;
    },
    remoteUrls: string[],
  ) {
    super(params.url, params.from, params.to);
    this.downloadedAt = params.downloadedAt;
    this.feedVersion = params.feedVersion;
    this.remoteUrls = remoteUrls;
  }

  /**
   * Whether this local resource's URL exists in the remote list.
   *
   * Designed for future use with multiple LocalResources, each with
   * different validity periods (from/to). When multiple LocalResources
   * are defined, isAdopted() determines which one should be used on
   * a given day — only the one whose URL matches a remote resource
   * is currently active (adopted).
   */
  isAdopted(): boolean {
    return this.remoteUrls.some((url) => stripAuthParams(url) === this.url);
  }
}

// ---------------------------------------------------------------------------
// Remote resource
// ---------------------------------------------------------------------------

/**
 * A resource from the ODPT Members Portal API response.
 *
 * Status methods:
 * - isNew(snapshot) → new / known / no-snapshot
 * - isAdopted(adoptedUrl) → whether this is the currently adopted resource
 * - getPeriodStatus(now) → 8 period states (inherited from Resource)
 */
export class RemoteResource extends Resource {
  /** 適用開始日 (ダイヤ改正日). For display/sorting only. */
  readonly startAt: string;
  /** アップロード日時. For display only. */
  readonly uploadedAt: string;

  private readonly snapshot: ResourceSnapshot | null;
  private readonly adoptedUrl: string | null;

  constructor(
    params: {
      url: string;
      from: string | null;
      to: string | null;
      startAt: string;
      uploadedAt: string;
    },
    snapshot: ResourceSnapshot | null,
    adoptedUrl: string | null,
  ) {
    super(params.url, params.from, params.to);
    this.startAt = params.startAt;
    this.uploadedAt = params.uploadedAt;
    this.snapshot = snapshot;
    this.adoptedUrl = adoptedUrl;
  }

  /** Whether this URL was not in the previous check snapshot. null = no snapshot. */
  isNew(): boolean | null {
    if (!this.snapshot) {
      return null;
    }
    return !this.snapshot.resourceUrls.some((url) => stripAuthParams(url) === this.url);
  }

  /** Whether this resource's URL matches the adopted (local) resource. */
  isAdopted(): boolean {
    if (!this.adoptedUrl) {
      return false;
    }
    return this.url === stripAuthParams(this.adoptedUrl);
  }
}
