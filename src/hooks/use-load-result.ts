import { useContext } from 'react';
import { SourceLoadStateContext } from '../contexts/source-load-state-context';
import type { LoadResult } from '../repositories/athenai-repository';

/**
 * Returns the startup {@link LoadResult} snapshot.
 *
 * The snapshot is immutable: it reflects which prefixes succeeded or failed
 * during the initial `AthenaiRepositoryV2.create()` call at app boot.
 *
 * Must be called inside a `SourceLoadStateProvider`. Throws otherwise.
 *
 * @returns The startup load result snapshot.
 */
export function useLoadResult(): LoadResult {
  const ctx = useContext(SourceLoadStateContext);
  if (!ctx) {
    throw new Error('useLoadResult must be used within a SourceLoadStateProvider');
  }
  return ctx.startupLoadResult;
}
