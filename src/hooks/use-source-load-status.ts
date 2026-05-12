import { useContext } from 'react';
import { SourceLoadStateContext } from '../contexts/source-load-state-context';
import type { SourceLoadState } from '../domain/datasource/source-load-state';

/**
 * Returns the current per-prefix load status map.
 *
 * Absence of a key means "never attempted". Phase N (explicit unload)
 * will extend the status union with `'unloaded'`.
 *
 * Must be called inside a `SourceLoadStateProvider`. Throws otherwise.
 *
 * @returns Read-only map keyed by source prefix.
 */
export function useSourceLoadStatus(): SourceLoadState {
  const ctx = useContext(SourceLoadStateContext);
  if (!ctx) {
    throw new Error('useSourceLoadStatus must be used within a SourceLoadStateProvider');
  }
  return ctx.loadStatusByPrefix;
}
