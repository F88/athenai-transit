import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import type { Result } from '@/types/app/repository';

import type { AnchorRepository } from '@/repositories/anchor/anchor-repository';

import { isAnchor, MAX_ANCHOR_SIZE, type AnchorEntry } from '@/domain/portal/anchor';

const logger = createLogger('Anchors');

/**
 * Return type for the useAnchors hook.
 *
 * This hook exposes anchor state and persistence-facing mutations.
 * UI-specific orchestration such as toast messages, display-name
 * resolution, and toggle branching belongs in `useAnchorToggle`, not
 * here.
 */
export interface UseAnchorsReturn {
  /** Anchor entries, most recently added first. */
  anchors: AnchorEntry[];
  /** Latest repository error message. Null when no error. */
  lastError: string | null;
  /** Clear the latest repository error message. */
  clearError: () => void;
  /** Add an anchor. Returns the created entry on success, or error if duplicate. */
  addAnchor: (entry: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Remove an anchor by stopId. Returns void on success, or error if not found. */
  removeAnchor: (stopId: string) => Promise<Result<void>>;
  /** Update an existing anchor's mutable fields. Returns the entry (updated or existing) on success, or error if not found. Idempotent. */
  updateAnchor: (update: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Update multiple anchors in a single operation. Single state update + single persistence write. */
  batchUpdateAnchors: (updates: Omit<AnchorEntry, 'createdAt'>[]) => Promise<Result<AnchorEntry[]>>;
  /** Check if the anchor list contains the stop. */
  hasAnchor: (stopId: string) => boolean;
}

/**
 * Manages anchor (bookmarked stop) state backed by an {@link AnchorRepository}.
 *
 * The hook owns the React state and delegates persistence to the repository.
 * All mutation methods are async and return {@link Result} — the repository
 * determines the actual storage mechanism (localStorage, Web API, etc.).
 *
 * Responsibility boundary:
 *
 * - `useAnchors` owns anchor state, repository synchronization, and
 *   persistence-shaped CRUD methods.
 * - `useAnchorToggle` sits one layer above this hook and handles
 *   App-specific toggle orchestration such as deciding add vs remove,
 *   resolving live metadata for labels, building snapshots for new
 *   anchors, and emitting toast notifications.
 *
 * Reach for this hook when the caller needs the anchor collection or
 * repository-backed mutations directly. Reach for `useAnchorToggle`
 * when the caller needs the user-facing "toggle this stop's anchor
 * state" behavior.
 *
 * @param repo - The repository to use for persistence.
 * @returns Anchor state and mutation functions.
 */
export function useAnchors(repo: AnchorRepository): UseAnchorsReturn {
  const [anchors, setAnchors] = useState<AnchorEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Load anchors from repository on mount.
  // Cancellation flag prevents stale responses from overwriting state
  // when repo changes or the component unmounts during an async load.
  useEffect(() => {
    let cancelled = false;
    void repo
      .getAnchors()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success) {
          setAnchors(result.data);
          setLastError(null);
          return;
        }
        setLastError(result.error);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        logger.error('Failed to load anchors', error);
        setLastError('Failed to load anchors');
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const addAnchor = useCallback(
    async (entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      try {
        const result = await repo.addAnchor(entry);
        if (result.success) {
          setAnchors((prev) => [result.data, ...prev].slice(0, MAX_ANCHOR_SIZE));
          setLastError(null);
          return result;
        }
        setLastError(result.error);
        return result;
      } catch (error: unknown) {
        logger.error('Failed to add anchor', error);
        const fallbackError = 'Failed to add anchor';
        setLastError(fallbackError);
        return { success: false, error: fallbackError };
      }
    },
    [repo],
  );

  const removeAnchor = useCallback(
    async (stopId: string): Promise<Result<void>> => {
      try {
        const result = await repo.removeAnchor(stopId);
        if (result.success) {
          setAnchors((prev) => prev.filter((a) => a.snapshot.stopId !== stopId));
          setLastError(null);
          return result;
        }
        setLastError(result.error);
        return result;
      } catch (error: unknown) {
        logger.error('Failed to remove anchor', error);
        const fallbackError = 'Failed to remove anchor';
        setLastError(fallbackError);
        return { success: false, error: fallbackError };
      }
    },
    [repo],
  );

  const updateAnchor = useCallback(
    async (update: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      try {
        const result = await repo.updateAnchor(update);
        if (result.success) {
          setAnchors((prev) =>
            prev.map((a) => (a.snapshot.stopId === update.snapshot.stopId ? result.data : a)),
          );
          setLastError(null);
          return result;
        }
        setLastError(result.error);
        return result;
      } catch (error: unknown) {
        logger.error('Failed to update anchor', error);
        const fallbackError = 'Failed to update anchor';
        setLastError(fallbackError);
        return { success: false, error: fallbackError };
      }
    },
    [repo],
  );

  const batchUpdateAnchors = useCallback(
    async (updates: Omit<AnchorEntry, 'createdAt'>[]): Promise<Result<AnchorEntry[]>> => {
      try {
        const result = await repo.batchUpdateAnchors(updates);
        if (result.success) {
          setAnchors(result.data);
          setLastError(null);
          return result;
        }
        setLastError(result.error);
        return result;
      } catch (error: unknown) {
        logger.error('Failed to batch update anchors', error);
        const fallbackError = 'Failed to batch update anchors';
        setLastError(fallbackError);
        return { success: false, error: fallbackError };
      }
    },
    [repo],
  );

  const hasAnchor = useCallback((stopId: string) => isAnchor(anchors, stopId), [anchors]);

  return {
    anchors,
    lastError,
    clearError,
    addAnchor,
    removeAnchor,
    updateAnchor,
    batchUpdateAnchors,
    hasAnchor,
  };
}
