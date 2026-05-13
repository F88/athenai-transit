import type { LoadResult } from '../../repositories/athenai-repository';

/**
 * Per-prefix load status.
 *
 * Absence of a key in {@link SourceLoadState} means "never attempted"
 * (i.e., the prefix is not configured to load).
 *
 * Phase N (explicit unload) will add `| { status: 'unloaded' }`.
 */
export type SourceLoadStatusEntry = { status: 'loaded' } | { status: 'failed'; error: Error };

/** Per-prefix current load state, keyed by source prefix. */
export type SourceLoadState = ReadonlyMap<string, SourceLoadStatusEntry>;

/**
 * Action type for {@link sourceLoadStateReducer}.
 *
 * Phase 1: no actions defined, so the type is `never` and any attempt to
 * dispatch fails at the type system level. Phase N will replace this with
 * a union such as `{ type: 'markUnloaded'; prefix: string }`.
 */
export type SourceLoadStateAction = never;

/**
 * Build the initial state map from a startup {@link LoadResult}.
 *
 * @param loadResult - The result of source loading from
 *   `AthenaiRepositoryV2.create()`.
 * @returns A per-prefix status map typed as {@link ReadonlyMap}. The
 *   read-only contract is enforced by the type system only; the underlying
 *   value is a regular `Map` and is not runtime-frozen. Callers should not
 *   mutate it.
 */
export function buildInitialSourceLoadState(loadResult: LoadResult): SourceLoadState {
  const m = new Map<string, SourceLoadStatusEntry>();
  for (const prefix of loadResult.loaded) {
    m.set(prefix, { status: 'loaded' });
  }
  for (const { prefix, error } of loadResult.failed) {
    m.set(prefix, { status: 'failed', error });
  }
  return m;
}

/**
 * Reducer for source load state.
 *
 * Phase 1: no actions defined; returns state unchanged. The function
 * exists so the provider can wire `useReducer` once, and Phase N can
 * add `switch` cases without rewriting the provider.
 *
 * @param state - Current source load state.
 * @param _action - Action payload (currently `never`).
 * @returns The next state.
 */
export function sourceLoadStateReducer(
  state: SourceLoadState,
  _action: SourceLoadStateAction,
): SourceLoadState {
  return state;
}
