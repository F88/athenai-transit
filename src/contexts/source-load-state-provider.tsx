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
 * @param sourcesParam - Raw value of the URL `?sources=` query parameter at
 *   boot, or `null` when absent. Used to derive {@link
 *   SourceLoadStateContextValue.isForcedSourcesMode}.
 * @param children - Subtree that can access the context.
 */
export function SourceLoadStateProvider({
  initialLoadResult,
  sourcesParam,
  children,
}: {
  initialLoadResult: LoadResult;
  sourcesParam: string | null;
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

  // Any presence of the `?sources=` parameter means the URL is overriding
  // source selection — including the empty value `?sources=`, which
  // `resolveFetchDataSources` treats as "force-load no sources" (returns
  // `[]`). The dialog must match the load layer's interpretation, so an
  // empty value is forced-mode true. (Earlier we excluded empty here to
  // match `data-source-manager.ts`'s `if (!sourcesParam) return null`,
  // but that DSM check was itself out of step with the load layer; the
  // user-observable behavior is driven by the load layer, so the UI
  // aligns to it.)
  const isForcedSourcesMode = sourcesParam !== null;

  const value = useMemo(
    () => ({
      startupLoadResult: initialLoadResult,
      loadStatusByPrefix,
      loadedSources,
      isForcedSourcesMode,
    }),
    [initialLoadResult, loadStatusByPrefix, loadedSources, isForcedSourcesMode],
  );

  return (
    <SourceLoadStateContext.Provider value={value}>{children}</SourceLoadStateContext.Provider>
  );
}
