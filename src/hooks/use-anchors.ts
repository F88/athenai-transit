import { useCallback, useEffect, useState } from 'react';
import { isAnchor, type AnchorEntry } from '../domain/portal/anchor';
import type { Result } from '../types/app/repository';
import type { UserDataRepository } from '../repositories/user-data-repository';
import { createLogger } from '../utils/logger';

const logger = createLogger('Anchors');

/**
 * Return type for the useAnchors hook.
 */
export interface UseAnchorsReturn {
  /** Anchor entries, most recently added first. */
  anchors: AnchorEntry[];
  /** Latest repository error message. Null when no error. */
  lastError: string | null;
  /** Clear the latest repository error message. */
  clearError: () => void;
  /** Add a stop to anchors. Returns the created entry on success, or error if duplicate. */
  addStop: (entry: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Remove a stop from anchors. Returns void on success, or error if not found. */
  removeStop: (stopId: string) => Promise<Result<void>>;
  /** Update an existing anchor's mutable fields. Returns the entry (updated or existing) on success, or error if not found. Idempotent. */
  updateStop: (update: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Check if a stop is currently in the anchor list. */
  isStopAnchor: (stopId: string) => boolean;
}

/**
 * Manages anchor (bookmarked stop) state backed by a {@link UserDataRepository}.
 *
 * The hook owns the React state and delegates persistence to the repository.
 * All mutation methods are async and return {@link Result} — the repository
 * determines the actual storage mechanism (localStorage, Web API, etc.).
 *
 * @param repo - The repository to use for persistence.
 * @returns Anchor state and mutation functions.
 */
export function useAnchors(repo: UserDataRepository): UseAnchorsReturn {
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

  const addStop = useCallback(
    async (entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      try {
        const result = await repo.addAnchor(entry);
        if (result.success) {
          setAnchors((prev) => [result.data, ...prev]);
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

  const removeStop = useCallback(
    async (stopId: string): Promise<Result<void>> => {
      try {
        const result = await repo.removeAnchor(stopId);
        if (result.success) {
          setAnchors((prev) => prev.filter((a) => a.stopId !== stopId));
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

  const updateStop = useCallback(
    async (update: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      try {
        const result = await repo.updateAnchor(update);
        if (result.success) {
          setAnchors((prev) => prev.map((a) => (a.stopId === update.stopId ? result.data : a)));
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

  const isStopAnchor = useCallback((stopId: string) => isAnchor(anchors, stopId), [anchors]);

  return { anchors, lastError, clearError, addStop, removeStop, updateStop, isStopAnchor };
}
