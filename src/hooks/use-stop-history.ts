import { useCallback, useEffect, useRef, useState } from 'react';

import { addToHistory, type StopHistoryEntry } from '../domain/transit/stop-history';
import { createLogger } from '../lib/logger';
import type { StopSelectionRepository } from '../repositories/stop-selection/stop-selection-repository';
import type { Result } from '../types/app/repository';
import type { StopReferenceSnapshot } from '../types/app/stop-reference-snapshot';

const logger = createLogger('StopHistory');

/**
 * Public state and actions exposed by {@link useStopHistory}.
 */
export interface UseStopHistoryReturn {
  /** Persisted stop-selection history, most recent first. */
  history: StopHistoryEntry[];
  /** Latest repository or persistence error. Null when no error is present. */
  lastError: string | null;
  /** Clear the current error state after it has been surfaced to the UI. */
  clearError: () => void;
  /** Record a stop selection in history using a durable stop snapshot payload. */
  recordStopSelection: (selection: StopReferenceSnapshot) => Promise<Result<void>>;
  /** Remove all persisted history entries. */
  clearHistory: () => Promise<Result<void>>;
}

export function useStopHistory(repo: StopSelectionRepository): UseStopHistoryReturn {
  const [history, setHistory] = useState<StopHistoryEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const historyRef = useRef<StopHistoryEntry[]>([]);
  const isLoadedRef = useRef(false);
  const stateVersionRef = useRef(0);

  const commitHistory = useCallback((entries: StopHistoryEntry[]) => {
    stateVersionRef.current += 1;
    isLoadedRef.current = true;
    historyRef.current = entries;
    setHistory(entries);
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const readHistoryFromRepo = useCallback(async (): Promise<Result<StopHistoryEntry[]>> => {
    try {
      return await repo.getHistory();
    } catch (error: unknown) {
      logger.error('Failed to load stop history', error);
      return { success: false, error: 'Failed to load stop history' };
    }
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    const requestVersion = stateVersionRef.current;

    void readHistoryFromRepo().then((result) => {
      if (cancelled || stateVersionRef.current !== requestVersion) {
        return;
      }

      if (result.success) {
        commitHistory(result.data);
        setLastError(null);
        return;
      }

      setLastError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [commitHistory, readHistoryFromRepo]);

  const recordStopSelection = useCallback(
    async (selection: StopReferenceSnapshot): Promise<Result<void>> => {
      const baseHistoryResult = isLoadedRef.current
        ? { success: true as const, data: historyRef.current }
        : await readHistoryFromRepo();
      if (!baseHistoryResult.success) {
        setLastError(baseHistoryResult.error);
        return { success: false, error: baseHistoryResult.error };
      }

      if (!isLoadedRef.current) {
        commitHistory(baseHistoryResult.data);
        setLastError(null);
      }

      const next = addToHistory(baseHistoryResult.data, selection, Date.now());

      try {
        const result = await repo.saveHistory(next);
        if (result.success) {
          commitHistory(next);
          setLastError(null);
          return result;
        }

        setLastError(result.error);
        return result;
      } catch (error: unknown) {
        logger.error('Failed to persist stop history', error);
        const fallbackError = 'Failed to persist stop history';
        setLastError(fallbackError);
        return { success: false, error: fallbackError };
      }
    },
    [commitHistory, readHistoryFromRepo, repo],
  );

  const clearHistory = useCallback(async (): Promise<Result<void>> => {
    try {
      const result = await repo.clearHistory();
      if (result.success) {
        commitHistory([]);
        setLastError(null);
        return result;
      }

      setLastError(result.error);
      return result;
    } catch (error: unknown) {
      logger.error('Failed to clear stop history', error);
      const fallbackError = 'Failed to clear stop history';
      setLastError(fallbackError);
      return { success: false, error: fallbackError };
    }
  }, [commitHistory, repo]);

  return {
    history,
    lastError,
    clearError,
    recordStopSelection,
    clearHistory,
  };
}
