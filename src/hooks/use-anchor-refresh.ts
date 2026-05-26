import { useEffect, useRef } from 'react';

import { buildAnchorRefreshUpdates, type AnchorEntry } from '../domain/portal/anchor';
import type { LangChain } from '../domain/transit/i18n/resolve-lang-chain';
import type { TransitRepository } from '../repositories/transit-repository';
import type { Result } from '../types/app/repository';

/**
 * Arguments for {@link useAnchorRefresh}.
 */
export interface UseAnchorRefreshParams {
  /** Live anchor list owned by `useAnchors`. */
  anchors: AnchorEntry[];
  /** Active transit repository, used to read the latest `StopWithMeta` per anchored stop_id. */
  repo: TransitRepository;
  /** Atomic batch update on the anchor repository (single state + single persistence write). */
  batchUpdateAnchors: (updates: Omit<AnchorEntry, 'createdAt'>[]) => Promise<Result<AnchorEntry[]>>;
  /** Resolved language fallback chain, used to pick the canonical display name on refresh. */
  langChain: LangChain;
}

/**
 * Refresh anchor entries with the latest GTFS metadata once per app
 * session.
 *
 * Mechanically the effect fires when `anchors` becomes non-empty, not
 * at component mount: `useAnchors` initializes its state to `[]` and
 * loads from the repository asynchronously, so for a returning user
 * the refresh happens the moment that load resolves; for a first-time
 * user (no persisted anchors) the refresh happens when they add their
 * first anchor in the current session (with the just-added snapshot,
 * the comparison is a no-op, so this remains a correctness-safe
 * trigger).
 *
 * The internal `done` ref guarantees the comparison + batch update
 * runs at most once per `useAnchorRefresh` lifetime, so subsequent
 * anchor mutations (add / remove / update during the session) do not
 * re-trigger refresh.
 *
 * Side effects:
 *
 *   - Calls {@link buildAnchorRefreshUpdates} to compute diffs
 *     between persisted snapshots and live `StopWithMeta`.
 *   - Calls `batchUpdateAnchors(updates)` only when at least one
 *     anchor's name / coordinates / route types changed.
 *
 * @param params - See {@link UseAnchorRefreshParams}.
 */
export function useAnchorRefresh({
  anchors,
  repo,
  batchUpdateAnchors,
  langChain,
}: UseAnchorRefreshParams): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || anchors.length === 0) {
      return;
    }
    const stopIds = new Set(anchors.map((a) => a.snapshot.stopId));
    const metas = repo.getStopMetaByIds(stopIds);
    // Mark as done regardless of result. repo is fully loaded before
    // injection (all GTFS data is in memory), so metas is only empty
    // when all anchor stopIds have been removed from the dataset.
    // We must not retry on every dependency change.
    done.current = true;
    const updates = buildAnchorRefreshUpdates(anchors, metas, langChain);
    if (updates.length > 0) {
      void batchUpdateAnchors(updates);
    }
  }, [anchors, repo, batchUpdateAnchors, langChain]);
}
