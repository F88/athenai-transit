import { useMemo, useReducer, type ReactNode } from 'react';
import type { LoadResult } from '../repositories/athenai-repository';
import {
  buildInitialSourceLoadState,
  sourceLoadStateReducer,
} from '../domain/datasource/source-load-state';
import { SourceLoadStateContext } from './source-load-state-context';

/**
 * Provider for per-prefix source load state.
 *
 * Holds the load status map in `useReducer` (Phase 1: no actions dispatched;
 * Phase N will dispatch unload/load actions). The derived `loadedSources`
 * set is memoized here rather than in consumer hooks so hooks can stay
 * trivial and avoid `useMemo` after a null guard.
 *
 * @param initialLoadResult - Startup load result snapshot.
 * @param children - Subtree that can access the context.
 */
export function SourceLoadStateProvider({
  initialLoadResult,
  children,
}: {
  initialLoadResult: LoadResult;
  children: ReactNode;
}) {
  // Phase 1: dispatch is intentionally not exposed. Phase N will publish
  // it on the context value when the action type is no longer `never`.
  const [loadStatusByPrefix] = useReducer(
    sourceLoadStateReducer,
    initialLoadResult,
    buildInitialSourceLoadState,
  );

  const loadedSources = useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const [prefix, entry] of loadStatusByPrefix) {
      if (entry.status === 'loaded') {
        set.add(prefix);
      }
    }
    return set;
  }, [loadStatusByPrefix]);

  const value = useMemo(
    () => ({
      startupLoadResult: initialLoadResult,
      loadStatusByPrefix,
      loadedSources,
    }),
    [initialLoadResult, loadStatusByPrefix, loadedSources],
  );

  return (
    <SourceLoadStateContext.Provider value={value}>{children}</SourceLoadStateContext.Provider>
  );
}
