import { useEffect, useRef, useState } from 'react';

import { createLogger } from '@/lib/logger';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { AppRouteTypeValue } from '@/types/app/transit';
import { buildSearchIndexEntry, type SearchIndexEntry } from '@/domain/transit/stop-search-index';

const logger = createLogger('StopSearch');

/**
 * Result of {@link useStopSearchIndex}.
 */
export interface UseStopSearchIndexReturn {
  /** Pre-built search index over all stops returned by `repo.getAllStops()`. */
  searchIndex: readonly SearchIndexEntry[];
  /** stop_id → route_types lookup populated alongside the search index. */
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>;
}

/**
 * Builds and caches a stop search index plus a stop_id → route_types lookup
 * map for the search dialog autocomplete.
 *
 * The index is built lazily when `enabled` first becomes true and is rebuilt
 * only when the repository identity changes. Reopening the dialog against the
 * same repo reuses the cached state.
 *
 * Cancellation: the in-flight load is dropped on unmount or when `repo` /
 * `enabled` change. The "built for repo" sentinel is updated only after both
 * async loads finish so a cancelled run never short-circuits the next attempt
 * with partially-loaded state.
 *
 * @param repo - Transit data repository.
 * @param enabled - Gate that triggers the load (typically the dialog `open` flag).
 * @returns Pre-built search index and route-type lookup map.
 */
export function useStopSearchIndex(
  repo: TransitRepository,
  enabled: boolean,
): UseStopSearchIndexReturn {
  const [searchIndex, setSearchIndex] = useState<readonly SearchIndexEntry[]>([]);
  const [routeTypeMap, setRouteTypeMap] = useState<ReadonlyMap<string, AppRouteTypeValue[]>>(
    () => new Map(),
  );
  const builtForRepoRef = useRef<TransitRepository | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (builtForRepoRef.current === repo) {
      return;
    }
    let cancelled = false;

    repo
      .getAllStops()
      .then((result) => {
        if (cancelled || !result.success) {
          return;
        }
        // Pre-build the search index so the per-keystroke filter only does
        // single-string `includes` calls, not repeated `katakanaToHiragana`
        // normalization in the hot loop.
        const index = result.data.map(buildSearchIndexEntry);
        setSearchIndex(index);

        return Promise.all(
          result.data.map(async (stop) => {
            const rtResult = await repo.getRouteTypesForStop(stop.stop_id);
            const routeTypes = rtResult.success ? rtResult.data : [-1 as const];
            return [stop.stop_id, routeTypes] as const;
          }),
        ).then((entries) => {
          if (!cancelled) {
            setRouteTypeMap(new Map(entries));
            builtForRepoRef.current = repo;
          }
        });
      })
      .catch((error) => {
        logger.error('Failed to load stops for search:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [repo, enabled]);

  return { searchIndex, routeTypeMap };
}
