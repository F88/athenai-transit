import type { DataSourceInfo } from './data-source-info';

/**
 * Aggregated disk size for a set of {@link DataSourceInfo} entries
 * (e.g. all prefixes belonging to a {@link SourceGroup}).
 *
 * Sums the `totalSizeBytes` of each input that has a non-null catalog
 * total. Intended as a coarse decision-making signal for "how heavy is
 * enabling this group" — not for accurate budgeting.
 */
export interface AggregatedSourceSize {
  /** Total bytes summed across all inputs with a known catalog total. */
  totalBytes: number;
}

/**
 * Aggregate {@link DataSourceInfo.totalSizeBytes} across the supplied
 * entries.
 *
 * Returns `null` when **none** of the inputs has a known catalog total
 * (i.e. every `totalSizeBytes` is `null`). Callers should treat this
 * as "no displayable size information" and hide the field.
 *
 * Entries with `totalSizeBytes === null` are silently skipped so a
 * partial catalog still yields a meaningful sum for the entries it
 * covers.
 */
export function aggregateSourceSize(infos: readonly DataSourceInfo[]): AggregatedSourceSize | null {
  let totalBytes = 0;
  let found = false;
  for (const info of infos) {
    if (info.totalSizeBytes === null) {
      continue;
    }
    found = true;
    totalBytes += info.totalSizeBytes;
  }
  if (!found) {
    return null;
  }
  return { totalBytes };
}

/**
 * Format a byte count as a short human-readable string (e.g. `"3.4 MB"`).
 *
 * Uses 1024-based units. Intended for dense UI captions where exact byte
 * accuracy is not required.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
