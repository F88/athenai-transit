/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeStopMeta } from '../../__tests__/helpers';
import {
  createStopReferenceSnapshot,
  type StopHistoryEntry,
} from '../../domain/transit/stop-history';
import type { StopSelectionRepository } from '../../repositories/stop-selection/stop-selection-repository';
import type { Result } from '../../types/app/repository';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { useStopHistory } from '../use-stop-history';

function makeHistoryEntry(
  stopId: string,
  routeTypes: AppRouteTypeValue[] = [3],
  selectedAt = 1000,
): StopHistoryEntry {
  const meta = makeStopMeta(stopId);
  return {
    snapshot: {
      stopId,
      name: meta.stop.stop_name,
      lat: meta.stop.stop_lat,
      lon: meta.stop.stop_lon,
      routeTypes,
      agencyIds: [],
    },
    selectedAt,
  };
}

function makeMockRepo(initialHistory: StopHistoryEntry[] = []): StopSelectionRepository {
  let history = [...initialHistory];

  return {
    getHistory: vi.fn(
      async (): Promise<Result<StopHistoryEntry[]>> => ({
        success: true,
        data: [...history],
      }),
    ),
    saveHistory: vi.fn(async (entries: StopHistoryEntry[]): Promise<Result<void>> => {
      history = [...entries];
      return { success: true, data: undefined };
    }),
    clearHistory: vi.fn(async (): Promise<Result<void>> => {
      history = [];
      return { success: true, data: undefined };
    }),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useStopHistory', () => {
  describe('initial load', () => {
    it('loads existing history from repository on mount', async () => {
      const repo = makeMockRepo([makeHistoryEntry('A')]);
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toHaveLength(1);
      });

      expect(repo.getHistory).toHaveBeenCalledOnce();
      expect(result.current.history[0].snapshot.stopId).toBe('A');
      expect(result.current.history[0].snapshot.name).toBe('Stop A');
    });

    it('returns empty history when repository is empty', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toEqual([]);
      });
    });

    it('keeps empty history and exposes repo error when initial load fails', async () => {
      const repo: StopSelectionRepository = {
        ...makeMockRepo(),
        getHistory: vi.fn(
          async (): Promise<Result<StopHistoryEntry[]>> => ({
            success: false,
            error: 'load failed',
          }),
        ),
      };
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.lastError).toBe('load failed');
      });

      expect(result.current.history).toEqual([]);
    });

    it('sets fallback error when initial load throws', async () => {
      const repo: StopSelectionRepository = {
        ...makeMockRepo(),
        getHistory: vi.fn(async (): Promise<Result<StopHistoryEntry[]>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.lastError).toBe('Failed to load stop history');
      });

      expect(result.current.history).toEqual([]);
    });
  });

  describe('recordStopSelection', () => {
    it('adds a stop to history and persists it through the repository', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useStopHistory(repo));

      await act(async () => {
        await result.current.recordStopSelection(
          createStopReferenceSnapshot(makeStopMeta('X').stop, [3]),
        );
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].snapshot.stopId).toBe('X');
      expect(result.current.history[0].snapshot.name).toBe('Stop X');
      expect(repo.saveHistory).toHaveBeenCalledOnce();
    });

    it('moves duplicate stop to the front', async () => {
      const repo = makeMockRepo([makeHistoryEntry('A', [3], 100), makeHistoryEntry('B', [2], 50)]);
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toHaveLength(2);
      });

      await act(async () => {
        await result.current.recordStopSelection(
          createStopReferenceSnapshot(makeStopMeta('A').stop, [3]),
        );
      });

      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[0].snapshot.stopId).toBe('A');
      expect(result.current.history[1].snapshot.stopId).toBe('B');
    });

    it('keeps existing state and exposes repo error when persistence fails', async () => {
      const repo: StopSelectionRepository = {
        ...makeMockRepo([makeHistoryEntry('A')]),
        saveHistory: vi.fn(
          async (): Promise<Result<void>> => ({
            success: false,
            error: 'persist failed',
          }),
        ),
      };
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toHaveLength(1);
      });

      const pushResult = await act(async () =>
        result.current.recordStopSelection(
          createStopReferenceSnapshot(makeStopMeta('B').stop, [3]),
        ),
      );

      expect(pushResult.success).toBe(false);
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].snapshot.stopId).toBe('A');
      expect(result.current.lastError).toBe('persist failed');
    });

    it('does not let a stale initial load overwrite a newer local mutation', async () => {
      const staleLoad = createDeferred<Result<StopHistoryEntry[]>>();
      let storedHistory = [makeHistoryEntry('A', [3], 100)];
      const repo: StopSelectionRepository = {
        getHistory: vi
          .fn<() => Promise<Result<StopHistoryEntry[]>>>()
          .mockImplementationOnce(() => staleLoad.promise)
          .mockImplementation(async () => ({ success: true, data: [...storedHistory] })),
        saveHistory: vi.fn(async (entries: StopHistoryEntry[]): Promise<Result<void>> => {
          storedHistory = [...entries];
          return { success: true, data: undefined };
        }),
        clearHistory: vi.fn(
          async (): Promise<Result<void>> => ({ success: true, data: undefined }),
        ),
      };
      const { result } = renderHook(() => useStopHistory(repo));

      await act(async () => {
        await result.current.recordStopSelection(
          createStopReferenceSnapshot(makeStopMeta('B').stop, [2]),
        );
      });

      staleLoad.resolve({ success: true, data: [makeHistoryEntry('A', [3], 100)] });

      await waitFor(() => {
        expect(result.current.history).toHaveLength(2);
      });

      expect(result.current.history[0].snapshot.stopId).toBe('B');
      expect(result.current.history[1].snapshot.stopId).toBe('A');
    });
  });

  describe('clearHistory', () => {
    it('clears history through the repository', async () => {
      const repo = makeMockRepo([makeHistoryEntry('A')]);
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toHaveLength(1);
      });

      const clearResult = await act(async () => result.current.clearHistory());

      expect(clearResult.success).toBe(true);
      expect(result.current.history).toEqual([]);
      expect(repo.clearHistory).toHaveBeenCalledOnce();
    });

    it('sets fallback error when clear throws', async () => {
      const repo: StopSelectionRepository = {
        ...makeMockRepo([makeHistoryEntry('A')]),
        clearHistory: vi.fn(async (): Promise<Result<void>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useStopHistory(repo));

      await waitFor(() => {
        expect(result.current.history).toHaveLength(1);
      });

      const clearResult = await act(async () => result.current.clearHistory());

      expect(clearResult.success).toBe(false);
      expect(result.current.history).toHaveLength(1);
      expect(result.current.lastError).toBe('Failed to clear stop history');
    });
  });
});
