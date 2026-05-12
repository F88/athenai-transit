import { useContext } from 'react';
import { SourceLoadStateContext } from '../contexts/source-load-state-context';

/**
 * Returns the set of currently loaded source prefixes.
 *
 * Derived once in the provider via `useMemo`, so this hook is a trivial
 * pass-through. Reference stability across renders is provided by the
 * provider; consumers can use the returned set directly in dependency
 * arrays.
 *
 * Must be called inside a `SourceLoadStateProvider`. Throws otherwise.
 *
 * @returns Read-only set of prefixes whose status is `'loaded'`.
 */
export function useLoadedSources(): ReadonlySet<string> {
  const ctx = useContext(SourceLoadStateContext);
  if (!ctx) {
    throw new Error('useLoadedSources must be used within a SourceLoadStateProvider');
  }
  return ctx.loadedSources;
}
