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
 */
export type SourceLoadStateContextValue = {
  startupLoadResult: LoadResult;
  loadStatusByPrefix: SourceLoadState;
  loadedSources: ReadonlySet<string>;
};

export const SourceLoadStateContext = createContext<SourceLoadStateContextValue | null>(null);
