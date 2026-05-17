import { useEffect, useMemo, useState } from 'react';
import {
  aggregateBoardingStopsCount,
  aggregateMaxTripsPerDay,
} from '../domain/datasource/aggregate-source-counts';
import { aggregateLanguages } from '../domain/datasource/aggregate-source-languages';
import {
  aggregateSourceSize,
  type AggregatedSourceSize,
} from '../domain/datasource/aggregate-source-size';
import { composeDataSourceInfo, type DataSourceInfo } from '../domain/datasource/data-source-info';
import { createLogger } from '../lib/logger';
import type { SourceGroup } from '../types/app/source-group';
import type { SourceMeta } from '../types/app/transit-composed';
import { useTransitRepository } from './use-transit-repository';

const logger = createLogger('useDataSourceGroupInfo');

/**
 * Per-group aggregated data-source info composed from app config, the
 * pipeline catalog, and the loaded SourceMeta. The Data Source
 * Settings dialog consumes this directly — each {@link SourceGroup}
 * row gets one entry.
 */
export interface DataSourceGroupInfo {
  /** {@link SourceGroup.id} the entry belongs to. */
  groupId: string;
  /**
   * Per-prefix raw facts for this group, in `group.prefixes` order.
   * Useful for drill-down displays (e.g. per-prefix detail panels);
   * the dialog row itself only uses the aggregated fields below.
   */
  infos: readonly DataSourceInfo[];
  /**
   * Sum of {@link DataSourceInfo.totalSizeBytes} across the group's
   * prefixes. `null` when no prefix in the group has catalog data.
   */
  size: AggregatedSourceSize | null;
  /**
   * Union of {@link DataSourceInfo.translationLanguages} across the
   * group's prefixes.
   *
   * `null` when no prefix in the group has catalog data (so the
   * translation status is unknown). An empty Set when at least one
   * prefix has catalog data but no prefix declares any translations —
   * a distinct state that should render as "0 translations" rather
   * than be hidden.
   */
  languages: ReadonlySet<string> | null;
  /**
   * Sum of {@link DataSourceInfo.boardingStopsCount} across the
   * group's prefixes. `null` when no prefix has catalog data.
   */
  boardingStopsCount: number | null;
  /**
   * Sum of {@link DataSourceInfo.maxTripsPerDay} across the group's
   * prefixes — treats the union of per-source peak service days as
   * the group peak. `null` when no prefix has catalog data.
   */
  maxTripsPerDay: number | null;
}

/**
 * React hook that, for each supplied {@link SourceGroup}, returns a
 * {@link DataSourceGroupInfo} composed from three inputs:
 *
 *   1. **app config** — the `groups` argument
 *   2. **catalog** — `repo.getDataSourceCatalog()` (sync)
 *   3. **loaded data** — `repo.getAllSourceMeta()` (async; cached in state)
 *
 * The returned Map is keyed by `group.id`. The dialog uses the
 * pre-aggregated fields directly; it never touches raw catalog or
 * SourceMeta and does not run aggregators inline.
 *
 * The first render before the SourceMeta fetch resolves yields entries
 * whose catalog-only fields (`size`, `languages`, etc.) reflect the
 * catalog state and whose SourceMeta-derived fields (currently only
 * {@link DataSourceInfo.feedVersion}) read as `null`. After the fetch
 * resolves, the hook re-emits the Map with SourceMeta-derived fields
 * populated.
 *
 * @param groups - The {@link SourceGroup}s to compose info for.
 * @returns `groupId → DataSourceGroupInfo` map.
 */
export function useDataSourceGroupInfo(
  groups: readonly SourceGroup[],
): ReadonlyMap<string, DataSourceGroupInfo> {
  const repo = useTransitRepository();

  const catalog = useMemo(() => repo.getDataSourceCatalog(), [repo]);

  const [sourceMetaByPrefix, setSourceMetaByPrefix] = useState<ReadonlyMap<string, SourceMeta>>(
    () => new Map(),
  );
  useEffect(() => {
    let cancelled = false;
    void repo
      .getAllSourceMeta()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success) {
          setSourceMetaByPrefix(new Map(result.data.map((m) => [m.id, m])));
        } else {
          logger.warn('failed to load source meta:', result.error);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        logger.error('failed to load source meta:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  return useMemo(() => {
    const result = new Map<string, DataSourceGroupInfo>();
    for (const group of groups) {
      const infos: DataSourceInfo[] = group.prefixes.map((prefix) =>
        composeDataSourceInfo(
          prefix,
          sourceMetaByPrefix.get(prefix),
          catalog?.sources.data[prefix],
        ),
      );
      result.set(group.id, {
        groupId: group.id,
        infos,
        size: aggregateSourceSize(infos),
        languages: aggregateLanguages(infos),
        boardingStopsCount: aggregateBoardingStopsCount(infos),
        maxTripsPerDay: aggregateMaxTripsPerDay(infos),
      });
    }
    return result;
  }, [groups, catalog, sourceMetaByPrefix]);
}
