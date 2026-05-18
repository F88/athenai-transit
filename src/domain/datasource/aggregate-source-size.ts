import type { AggregatedSourceSize } from '../../types/app/data-source-group-info';
import type { DataSourceInfo } from '../../types/app/data-source-info';

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
