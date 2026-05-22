import { describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { Result } from '@/types/app/repository';
import type { AppRouteTypeValue } from '@/types/app/transit';

import type { AnchorEntry } from '@/domain/portal/anchor';
import { useAnchors } from '@/hooks/use-anchors';
import type { AnchorRepository } from '@/repositories/anchor/anchor-repository';

function makeAnchorInput(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
): Omit<AnchorEntry, 'createdAt'> {
  return {
    snapshot: {
      stopId: id,
      name: `Stop ${id}`,
      lat: 35.0,
      lon: 139.0,
      routeTypes,
      agencyNames: [],
    },
  };
}

function makeAnchorEntry(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  createdAt = 1000,
): AnchorEntry {
  return { ...makeAnchorInput(id, routeTypes), createdAt };
}

function makeMockRepo(initialAnchors: AnchorEntry[] = []) {
  let anchors = [...initialAnchors];
  return {
    getAnchors: vi.fn(
      (): Promise<Result<AnchorEntry[]>> =>
        Promise.resolve({
          success: true,
          data: anchors,
        }),
    ),
    addAnchor: vi.fn((entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      if (anchors.some((a) => a.snapshot.stopId === entry.snapshot.stopId)) {
        return Promise.resolve({
          success: false,
          error: `Duplicate stop: ${entry.snapshot.stopId}`,
        });
      }
      const newEntry: AnchorEntry = { ...entry, createdAt: Date.now() };
      anchors = [newEntry, ...anchors];
      return Promise.resolve({ success: true, data: newEntry });
    }),
    removeAnchor: vi.fn((stopId: string): Promise<Result<void>> => {
      if (!anchors.some((a) => a.snapshot.stopId === stopId)) {
        return Promise.resolve({ success: false, error: `Stop not found: ${stopId}` });
      }
      anchors = anchors.filter((a) => a.snapshot.stopId !== stopId);
      return Promise.resolve({ success: true, data: undefined });
    }),
    updateAnchor: vi.fn((entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      const index = anchors.findIndex((a) => a.snapshot.stopId === entry.snapshot.stopId);
      if (index === -1) {
        return Promise.resolve({
          success: false,
          error: `Stop not found: ${entry.snapshot.stopId}`,
        });
      }
      const updated: AnchorEntry = {
        ...entry,
        createdAt: anchors[index].createdAt,
        portal: entry.portal ?? anchors[index].portal,
      };
      anchors = anchors.map((a) => (a.snapshot.stopId === entry.snapshot.stopId ? updated : a));
      return Promise.resolve({ success: true, data: updated });
    }),
    batchUpdateAnchors: vi.fn(
      (entries: Omit<AnchorEntry, 'createdAt'>[]): Promise<Result<AnchorEntry[]>> => {
        for (const entry of entries) {
          const index = anchors.findIndex((a) => a.snapshot.stopId === entry.snapshot.stopId);
          if (index !== -1) {
            const updated: AnchorEntry = {
              ...entry,
              createdAt: anchors[index].createdAt,
              portal: entry.portal ?? anchors[index].portal,
            };
            anchors = anchors.map((a) =>
              a.snapshot.stopId === entry.snapshot.stopId ? updated : a,
            );
          }
        }
        return Promise.resolve({ success: true, data: [...anchors] });
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

      expect(vi.mocked(repo).getAnchors).toHaveBeenCalledOnce();
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].snapshot.stopId).toBe('A');
    });

    it('returns empty anchors when repository is empty', async () => {
      const repo = makeMockRepo();
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(result.current.anchors).toEqual([]);
    });

    it('keeps empty anchors when initial repository load fails', async () => {
      const getAnchors = vi.fn(
        (): Promise<Result<AnchorEntry[]>> =>
          Promise.resolve({
            success: false,
            error: 'load failed',
          }),
      );
      const repo: AnchorRepository = {
        ...makeMockRepo(),
        getAnchors,
      };
      const { result } = renderHook(() => useAnchors(repo));

      await act(async () => {});

      expect(getAnchors).toHaveBeenCalledOnce();
      expect(result.current.anchors).toEqual([]);
      expect(result.current.lastError).toBe('load failed');
    });

    it('sets fallback error when initial repository load throws', async () => {
      const repo: AnchorRepository = {
        ...makeMockRepo(),
        getAnchors: vi.fn((): Promise<Result<AnchorEntry[]>> => Promise.reject(new Error('boom'))),
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
      expect(result.current.anchors[0].snapshot.stopId).toBe('X');
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
      const repo: AnchorRepository = {
        ...makeMockRepo(),
        addAnchor: vi.fn((): Promise<Result<AnchorEntry>> => Promise.reject(new Error('boom'))),
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

      expect(result.current.anchors[0].snapshot.stopId).toBe('B');
      expect(result.current.anchors[1].snapshot.stopId).toBe('A');
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
      expect(result.current.anchors[0].snapshot.stopId).toBe('B');
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
      const repo: AnchorRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        removeAnchor: vi.fn((): Promise<Result<void>> => Promise.reject(new Error('boom'))),
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
        result.current.updateStop({
          ...makeAnchorInput('A'),
          snapshot: { ...makeAnchorInput('A').snapshot, name: 'Updated' },
        }),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors[0].snapshot.name).toBe('Updated');
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
        result.current.updateStop({
          ...makeAnchorInput('A'),
          snapshot: { ...makeAnchorInput('A').snapshot, name: 'New Name' },
        }),
      );

      expect(result.current.anchors[0].snapshot.name).toBe('New Name');
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
        result.current.updateStop({
          ...makeAnchorInput('A'),
          snapshot: { ...makeAnchorInput('A').snapshot, name: 'Updated A' },
        }),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].snapshot.stopId).toBe('A');
      expect(result.current.anchors[0].snapshot.name).toBe('Updated A');
      expect(result.current.anchors[1].snapshot.stopId).toBe('B');
      expect(result.current.anchors[1].snapshot.name).toBe('Stop B');
    });

    it('normalizes thrown error to failure Result', async () => {
      const repo: AnchorRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        updateAnchor: vi.fn((): Promise<Result<AnchorEntry>> => Promise.reject(new Error('boom'))),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () => result.current.updateStop(makeAnchorInput('A')));

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Failed to update anchor');
      }
      expect(result.current.lastError).toBe('Failed to update anchor');
      expect(result.current.anchors[0].snapshot.name).toBe('Stop A');
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
          {
            ...makeAnchorInput('A'),
            snapshot: { ...makeAnchorInput('A').snapshot, name: 'Updated A' },
          },
          {
            ...makeAnchorInput('B'),
            snapshot: { ...makeAnchorInput('B').snapshot, name: 'Updated B' },
          },
        ]),
      );

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(2);
      expect(result.current.anchors[0].snapshot.name).toBe('Updated A');
      expect(result.current.anchors[1].snapshot.name).toBe('Updated B');
    });

    it('calls repo.batchUpdateAnchors once', async () => {
      const repo = makeMockRepo([makeAnchorEntry('A'), makeAnchorEntry('B')]);
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      await act(async () =>
        result.current.batchUpdateStops([
          { ...makeAnchorInput('A'), snapshot: { ...makeAnchorInput('A').snapshot, name: 'X' } },
          { ...makeAnchorInput('B'), snapshot: { ...makeAnchorInput('B').snapshot, name: 'Y' } },
        ]),
      );

      expect(vi.mocked(repo).batchUpdateAnchors).toHaveBeenCalledOnce();
    });

    it('sets lastError when repo returns failure', async () => {
      const repo: AnchorRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        batchUpdateAnchors: vi.fn(
          (): Promise<Result<AnchorEntry[]>> =>
            Promise.resolve({
              success: false,
              error: 'Failed to persist',
            }),
        ),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.batchUpdateStops([
          { ...makeAnchorInput('A'), snapshot: { ...makeAnchorInput('A').snapshot, name: 'X' } },
        ]),
      );

      expect(res.success).toBe(false);
      expect(result.current.lastError).toBe('Failed to persist');
      // State should not have changed
      expect(result.current.anchors[0].snapshot.name).toBe('Stop A');
    });

    it('sets fallback error when repo throws', async () => {
      const repo: AnchorRepository = {
        ...makeMockRepo([makeAnchorEntry('A')]),
        batchUpdateAnchors: vi.fn(() => Promise.reject(new Error('Network error'))),
      };
      const { result } = renderHook(() => useAnchors(repo));
      await act(async () => {});

      const res = await act(async () =>
        result.current.batchUpdateStops([
          { ...makeAnchorInput('A'), snapshot: { ...makeAnchorInput('A').snapshot, name: 'X' } },
        ]),
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
