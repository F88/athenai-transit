import { useMemo } from 'react';

import type { TransitRepository } from '@/repositories/transit-repository';
import type { Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

/**
 * Resolve {@link StopWithMeta} for the post-filter set of search result
 * stops, returning a `stop_id → StopWithMeta` lookup map.
 *
 * The search dialog renders at most `MAX_RESULTS` rows (currently 20) and
 * needs each row's agencies / routes / insights stats / insights geo to
 * surface the same metadata the bottom sheet shows. {@link
 * TransitRepository.getStopMetaByIds} is a synchronous indexed lookup
 * (`O(stopIds.size)`) so resolving the full filtered set per keystroke is
 * effectively free at the post-filter scale.
 *
 * Pass {@link filterStopsByQuery}'s output directly. The hook recomputes
 * only when the `stops` reference changes (filtered output is memoized in
 * the caller) or when `repo` swaps.
 *
 * @param repo - Transit data repository.
 * @param stops - Filtered (post-MAX_RESULTS) result list.
 * @returns Map keyed by `stop_id`. Stops not present in the repository are
 *   silently omitted.
 */
export function useStopSearchMeta(
  repo: TransitRepository,
  stops: readonly Stop[],
): ReadonlyMap<string, StopWithMeta> {
  return useMemo(() => {
    if (stops.length === 0) {
      return new Map();
    }
    const stopIds = new Set(stops.map((s) => s.stop_id));
    const metas = repo.getStopMetaByIds(stopIds);
    return new Map(metas.map((m) => [m.stop.stop_id, m]));
  }, [repo, stops]);
}
