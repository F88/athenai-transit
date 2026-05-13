import { useContext } from 'react';
import { SourceLoadStateContext } from '../contexts/source-load-state-context';

/**
 * Returns `true` when the URL `?sources=` query parameter was present at
 * boot in any form (including the empty `?sources=`), meaning the URL is
 * overriding the user-settings layer for source selection. Even the
 * empty form is treated as forced because the load layer
 * (`resolveFetchDataSources`) interprets it as "force-load zero
 * sources" — the dialog matches that.
 *
 * UI controls that mutate user preferences (toggle Switches, reset
 * buttons, etc.) must be non-interactive in this mode — letting users
 * change settings while the URL forces a different source set would be
 * logically inconsistent and confusing.
 *
 * Must be called inside a `SourceLoadStateProvider`. Throws otherwise.
 *
 * @returns `true` when source selection is forced by the URL, `false`
 *   when normal user-settings resolution is in effect.
 */
export function useIsForcedSourcesMode(): boolean {
  const ctx = useContext(SourceLoadStateContext);
  if (!ctx) {
    throw new Error('useIsForcedSourcesMode must be used within a SourceLoadStateProvider');
  }
  return ctx.isForcedSourcesMode;
}
