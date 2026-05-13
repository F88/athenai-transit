import { createContext } from 'react';
import type { LoadResult } from '../repositories/athenai-repository';
import type { SourceLoadState } from '../domain/datasource/source-load-state';

/**
 * Value carried by {@link SourceLoadStateContext}.
 *
 * - `startupLoadResult` is the immutable snapshot from app startup.
 * - `loadStatusByPrefix` is the mutable per-prefix state owned by the provider;
 *   Phase N (explicit unload) will mutate this via dispatched actions.
 * - `loadedSources` is a derived `Set` computed in the provider via `useMemo`,
 *   placed on the value so consumer hooks can return a stable reference
 *   without calling `useMemo` after a null guard (which the
 *   `react-hooks` lint rule flags as a conditional hook).
 * - `isForcedSourcesMode` is `true` when the URL `?sources=` query parameter
 *   was present at boot **with a non-empty value**. In this mode the URL
 *   overrides the user-settings layer entirely, so UI controls that mutate
 *   user preferences should be non-interactive until the URL override is
 *   cleared. The check intentionally treats `?sources=` (empty value) the
 *   same as the parameter being absent, matching the load-layer contract
 *   in `data-source-manager.ts`.
 */
export type SourceLoadStateContextValue = {
  startupLoadResult: LoadResult;
  loadStatusByPrefix: SourceLoadState;
  loadedSources: ReadonlySet<string>;
  isForcedSourcesMode: boolean;
};

export const SourceLoadStateContext = createContext<SourceLoadStateContextValue | null>(null);
