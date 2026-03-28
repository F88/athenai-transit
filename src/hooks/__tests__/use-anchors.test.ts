/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAnchors } from '../use-anchors';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { UserDataRepository } from '../../repositories/user-data-repository';
import type { Result } from '../../types/app/repository';
import type { RouteType } from '../../types/app/transit';

function makeAnchorInput(
  id: string,
  routeTypes: RouteType[] = [3],
): Omit<AnchorEntry, 'createdAt'> {
  return {
    stopId: id,
    stopName: `Stop ${id}`,
    stopLat: 35.0,
    stopLon: 139.0,
    routeTypes,
  };
}

function makeAnchorEntry(id: string, routeTypes: RouteType[] = [3], createdAt = 1000): AnchorEntry {
  return { ...makeAnchorInput(id, routeTypes), createdAt };
}

function makeMockRepo(initialAnchors: AnchorEntry[] = []): UserDataRepository {
  let anchors = [...initialAnchors];
  return {
    getAnchors: vi.fn(
      async (): Promise<Result<AnchorEntry[]>> => ({
        success: true,
        data: anchors,
      }),
    ),
    addAnchor: vi.fn(
      async (entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
        if (anchors.some((a) => a.stopId === entry.stopId)) {
          return { success: false, error: `Duplicate stop: ${entry.stopId}` };
        }
        const newEntry: AnchorEntry = { ...entry, createdAt: Date.now() };
        anchors = [newEntry, ...anchors];
        return { success: true, data: newEntry };
      },
    ),
    removeAnchor: vi.fn(async (stopId: string): Promise<Result<void>> => {
      if (!anchors.some((a) => a.stopId === stopId)) {
        return { success: false, error: `Stop not found: ${stopId}` };
      }
      anchors = anchors.filter((a) => a.stopId !== stopId);
      return { success: true, data: undefined };
    }),
    updateAnchor: vi.fn(
      async (entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
        const index = anchors.findIndex((a) => a.stopId === entry.stopId);
        if (index === -1) {
          return { success: false, error: `Stop not found: ${entry.stopId}` };
        }
        const updated: AnchorEntry = {
          ...entry,
          createdAt: anchors[index].createdAt,
          portal: entry.portal ?? anchors[index].portal,
        };
        anchors = anchors.map((a) => (a.stopId === entry.stopId ? updated : a));
        return { success: true, data: updated };
      },
    ),
    batchUpdateAnchors: vi.fn(
      async (entries: Omit<AnchorEntry, 'createdAt'>[]): Promise<Result<AnchorEntry[]>> => {
        for (const entry of entries) {
          const index = anchors.findIndex((a) => a.stopId === entry.stopId);
          if (index !== -1) {
            const updated: AnchorEntry = {
              ...entry,
              createdAt: anchors[index].createdAt,
              portal: entry.portal ?? anchors[index].portal,
            };
            anchors = anchors.map((a) => (a.stopId === entry.stopId ? updated : a));
          }
        }
        return { success: true, data: [...anchors] };
      },
    ),
  };
}

describe('useAnchors', () => {
  describe('initial load', () => {
    it('loads anchors from repository on mount', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(repo.getAnchors).toHaveBeenCalledOnce();
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].stopId).toBe('A');
    });

    it('returns empty anchors when repository is empty', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(result.current.anchors).toEqual([]);
    });

    it('keeps empty anchors when initial repository load fails', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo(),
        getAnchors: vi.fn(
          async (): Promise<Result<AnchorEntry[]>> => ({
            success: false,
            error: 'load failed',
          }),
        ),
      };
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(repo.getAnchors).toHaveBeenCalledOnce();
      expect(result.current.anchors).toEqual([]);
      expect(result.current.lastError).toBe('load failed');
    });

    it('sets fallback error when initial repository load throws', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo(),
        getAnchors: vi.fn(async (): Promise<Result<AnchorEntry[]>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(result.current.anchors).toEqual([]);
      expect(result.current.lastError).toBe('Failed to load anchors');
    });
  });

  describe('addStop', () => {
    it('adds a stop and returns success with created entry', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.addStop(makeAnchorInput('X')));

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('X');
    });

    it('returns error for duplicate stop', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.addStop(makeAnchorInput('A')));

      expect(res.success).toBe(false);
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.lastError).toContain('Duplicate stop');
    });

    it('normalizes thrown error to failure Result', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo(),
        addAnchor: vi.fn(async (): Promise<Result<AnchorEntry>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.addStop(makeAnchorInput('X')));

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Failed to add anchor');
      }
      expect(result.current.lastError).toBe('Failed to add anchor');
      expect(result.current.anchors).toEqual([]);
    });

    it('clears previous error on success', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () => result.current.addStop(makeAnchorInput('A')));
      expect(result.current.lastError).toContain('Duplicate stop');

      await act(async () => result.current.addStop(makeAnchorInput('B')));
      expect(result.current.lastError).toBeNull();
    });

    it('prepends new stop to front', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () => result.current.addStop(makeAnchorInput('A')));
      await act(async () => result.current.addStop(makeAnchorInput('B')));

      expect(result.current.anchors[0].stopId).toBe('B');
      expect(result.current.anchors[1].stopId).toBe('A');
    });
  });

  describe('removeStop', () => {
    it('removes a stop and returns success', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.removeStop('A'));

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('B');
    });

    it('returns error when stopId not found', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.removeStop('Z'));

      expect(res.success).toBe(false);
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.lastError).toContain('Stop not found');
    });

    it('normalizes thrown error to failure Result', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        removeAnchor: vi.fn(async (): Promise<Result<void>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.removeStop('A'));

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Failed to remove anchor');
      }
      expect(result.current.lastError).toBe('Failed to remove anchor');
      expect(result.current.anchors).toHaveLength(1);
    });
  });

  describe('updateStop', () => {
    it('updates an anchor and returns success with updated entry', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.updateStop({ ...makeAnchorInput('A'), stopName: 'Updated' }),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors[0].stopName).toBe('Updated');
    });

    it('returns error when stopId not found', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.updateStop(makeAnchorInput('Z')));

      expect(res.success).toBe(false);
      expect(result.current.lastError).toContain('Stop not found');
    });

    it('preserves portal when update omits it', async () => {
      const repo = makeMockRepo([{ ...makeAnchorEntry('A'), portal: 'my-group' }]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () =>
        result.current.updateStop({ ...makeAnchorInput('A'), stopName: 'New Name' }),
      );

      expect(result.current.anchors[0].stopName).toBe('New Name');
      expect(result.current.anchors[0].portal).toBe('my-group');
    });

    it('updates portal when provided', async () => {
      const repo = makeMockRepo([{ ...makeAnchorEntry('A'), portal: 'old' }]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () => result.current.updateStop({ ...makeAnchorInput('A'), portal: 'new' }));

      expect(result.current.anchors[0].portal).toBe('new');
    });

    it('updates only the target anchor and preserves others', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.updateStop({ ...makeAnchorInput('A'), stopName: 'Updated A' }),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].stopId).toBe('A');
      expect(result.current.anchors[0].stopName).toBe('Updated A');
      expect(result.current.anchors[1].stopId).toBe('B');
      expect(result.current.anchors[1].stopName).toBe('Stop B');
    });

    it('normalizes thrown error to failure Result', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        updateAnchor: vi.fn(async (): Promise<Result<AnchorEntry>> => {
          throw new Error('boom');
        }),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.updateStop(makeAnchorInput('A')));

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Failed to update anchor');
      }
      expect(result.current.lastError).toBe('Failed to update anchor');
      expect(result.current.anchors[0].stopName).toBe('Stop A');
    });
  });

  describe('error state', () => {
    it('clears error via clearError', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () => result.current.addStop(makeAnchorInput('A')));
      expect(result.current.lastError).toContain('Duplicate stop');

      act(() => result.current.clearError());
      expect(result.current.lastError).toBeNull();
    });
  });

  describe('batchUpdateStops', () => {
    it('updates multiple anchors and replaces state with repo result', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.batchUpdateStops([
          { ...makeAnchorInput('A'), stopName: 'Updated A' },
          { ...makeAnchorInput('B'), stopName: 'Updated B' },
        ]),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].stopName).toBe('Updated A');
      expect(result.current.anchors[1].stopName).toBe('Updated B');
    });

    it('calls repo.batchUpdateAnchors once', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () =>
        result.current.batchUpdateStops([
          { ...makeAnchorInput('A'), stopName: 'X' },
          { ...makeAnchorInput('B'), stopName: 'Y' },
        ]),
      );

      expect(repo.batchUpdateAnchors).toHaveBeenCalledOnce();
    });

    it('sets lastError when repo returns failure', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        batchUpdateAnchors: vi.fn(
          async (): Promise<Result<AnchorEntry[]>> => ({
            success: false,
            error: 'Failed to persist',
          }),
        ),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.batchUpdateStops([{ ...makeAnchorInput('A'), stopName: 'X' }]),
      );

      expect(res.success).toBe(false);
      expect(result.current.lastError).toBe('Failed to persist');
      // State should not have changed
      expect(result.current.anchors[0].stopName).toBe('Stop A');
    });

    it('sets fallback error when repo throws', async () => {
      const repo: UserDataRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        batchUpdateAnchors: vi.fn(async () => {
          throw new Error('Network error');
        }),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.batchUpdateStops([{ ...makeAnchorInput('A'), stopName: 'X' }]),
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Failed to batch update');
      }
      expect(result.current.lastError).toBe('Failed to batch update anchors');
    });
  });

  describe('isStopAnchor', () => {
    it('returns true for an anchored stop', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      expect(result.current.isStopAnchor('A')).toBe(true);
    });

    it('returns false for a non-anchored stop', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      expect(result.current.isStopAnchor('Z')).toBe(false);
    });

    it('reflects changes after addStop', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      expect(result.current.isStopAnchor('X')).toBe(false);

      await act(async () => result.current.addStop(makeAnchorInput('X')));

      expect(result.current.isStopAnchor('X')).toBe(true);
    });

    it('reflects changes after removeStop', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      expect(result.current.isStopAnchor('A')).toBe(true);

      await act(async () => result.current.removeStop('A'));

      expect(result.current.isStopAnchor('A')).toBe(false);
    });
  });
});
