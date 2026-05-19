import { useEffect, useMemo, useState } from 'react';
import {
  aggregateBoardingStopsCount,
  aggregateMaxTripsPerDay,
  aggregateOperatingDates,
  aggregateRouteTypeCounts,
  aggregateRouteShapesCount,
} from '../domain/datasource/aggregate-source-counts';
import { aggregateSourceSize } from '../domain/datasource/aggregate-source-size';
import { aggregateTranslationLanguages } from '../domain/datasource/aggregate-translation-languages';
import { composeDataSourceInfo } from '../domain/datasource/data-source-info';
import { createLogger } from '../lib/logger';
import type { DataSourceGroupInfo } from '../types/app/data-source-group-info';
import type { DataSourceInfo } from '../types/app/data-source-info';
import type { SourceGroup } from '../types/app/source-group';
import type { SourceMeta } from '../types/app/transit-composed';
import { useTransitRepository } from './use-transit-repository';

const logger = createLogger('useDataSourceGroupInfo');

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
        translationLanguages: aggregateTranslationLanguages(infos),
        boardingStopsCount: aggregateBoardingStopsCount(infos),
        maxTripsPerDay: aggregateMaxTripsPerDay(infos),
        operatingDates: aggregateOperatingDates(infos),
        routeTypeCounts: aggregateRouteTypeCounts(infos),
        routeShapesCount: aggregateRouteShapesCount(infos),
      });
    }
    return result;
  }, [groups, catalog, sourceMetaByPrefix]);
}
