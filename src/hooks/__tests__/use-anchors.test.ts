import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAnchors } from '../use-anchors';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { Result } from '../../types/app/repository';
import type { RouteType } from '../../types/app/transit';

const STORAGE_KEY = 'portals';

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

beforeEach(() => {
  localStorage.clear();
});

describe('useAnchors', () => {
  describe('initial load', () => {
    it('returns empty anchors when localStorage is empty', () => {
      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toEqual([]);
    });

    it('loads existing anchors from localStorage', () => {
      const entry: AnchorEntry = {
        stopId: 'A',
        stopName: 'Stop A',
        stopLat: 35.0,
        stopLon: 139.0,
        routeTypes: [3],
        createdAt: 1000,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('A');
      expect(result.current.anchors[0].routeTypes).toEqual([3]);
    });
  });

  describe('addStop', () => {
    it('adds a stop and returns success with created entry', async () => {
      const { result } = renderHook(() => useAnchors());
      let res: Result<AnchorEntry> = { success: false, error: '' };

      await act(async () => {
        res = await result.current.addStop(makeAnchorInput('X'));
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.stopId).toBe('X');
        expect(res.data.stopName).toBe('Stop X');
        expect(res.data.createdAt).toBeGreaterThan(0);
      }

      expect(result.current.anchors).toHaveLength(1);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].stopId).toBe('X');
    });

    it('returns error for duplicate stop', async () => {
      const { result } = renderHook(() => useAnchors());

      await act(async () => {
        await result.current.addStop(makeAnchorInput('A'));
      });

      let res: Result<AnchorEntry> = { success: true, data: {} as AnchorEntry };
      await act(async () => {
        res = await result.current.addStop(makeAnchorInput('A'));
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Duplicate');
      }
      expect(result.current.anchors).toHaveLength(1);
    });

    it('prepends new stop to front', async () => {
      const { result } = renderHook(() => useAnchors());

      await act(async () => {
        await result.current.addStop(makeAnchorInput('A'));
      });
      await act(async () => {
        await result.current.addStop(makeAnchorInput('B'));
      });

      expect(result.current.anchors[0].stopId).toBe('B');
      expect(result.current.anchors[1].stopId).toBe('A');
    });
  });

  describe('removeStop', () => {
    it('removes a stop and returns success', async () => {
      const entries: AnchorEntry[] = [
        { ...makeAnchorInput('A'), createdAt: 1000 },
        { ...makeAnchorInput('B'), createdAt: 2000 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      let res: Result<void> = { success: false, error: '' };

      await act(async () => {
        res = await result.current.removeStop('A');
      });

      expect(res.success).toBe(true);
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('B');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].stopId).toBe('B');
    });

    it('returns error when stopId not found', async () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      let res: Result<void> = { success: true, data: undefined };

      await act(async () => {
        res = await result.current.removeStop('Z');
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('not found');
      }
      expect(result.current.anchors).toHaveLength(1);
    });
  });

  describe('updateStop', () => {
    it('updates an anchor and returns success with updated entry', async () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      let res: Result<AnchorEntry> = { success: false, error: '' };

      await act(async () => {
        res = await result.current.updateStop({ ...makeAnchorInput('A'), stopName: 'Updated' });
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.stopName).toBe('Updated');
        expect(res.data.createdAt).toBe(1000);
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored[0].stopName).toBe('Updated');
    });

    it('returns error when nothing changed', async () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      let res: Result<AnchorEntry> = { success: true, data: {} as AnchorEntry };

      await act(async () => {
        res = await result.current.updateStop(makeAnchorInput('A'));
      });

      expect(res.success).toBe(false);
    });

    it('returns error when stopId not found', async () => {
      const { result } = renderHook(() => useAnchors());
      let res: Result<AnchorEntry> = { success: true, data: {} as AnchorEntry };

      await act(async () => {
        res = await result.current.updateStop(makeAnchorInput('Z'));
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('not found');
      }
    });

    it('preserves portal when update omits it', async () => {
      const entries: AnchorEntry[] = [
        { ...makeAnchorInput('A'), createdAt: 1000, portal: 'my-group' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());

      await act(async () => {
        await result.current.updateStop({ ...makeAnchorInput('A'), stopName: 'New Name' });
      });

      expect(result.current.anchors[0].stopName).toBe('New Name');
      expect(result.current.anchors[0].portal).toBe('my-group');
    });

    it('updates portal when provided', async () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000, portal: 'old' }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());

      await act(async () => {
        await result.current.updateStop({ ...makeAnchorInput('A'), portal: 'new' });
      });

      expect(result.current.anchors[0].portal).toBe('new');
    });
  });

  describe('isStopAnchor', () => {
    it('returns true for an anchored stop', () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.isStopAnchor('A')).toBe(true);
    });

    it('returns false for a non-anchored stop', () => {
      const { result } = renderHook(() => useAnchors());
      expect(result.current.isStopAnchor('Z')).toBe(false);
    });

    it('reflects changes after addStop', async () => {
      const { result } = renderHook(() => useAnchors());

      expect(result.current.isStopAnchor('X')).toBe(false);

      await act(async () => {
        await result.current.addStop(makeAnchorInput('X'));
      });

      expect(result.current.isStopAnchor('X')).toBe(true);
    });

    it('reflects changes after removeStop', async () => {
      const entries: AnchorEntry[] = [{ ...makeAnchorInput('A'), createdAt: 1000 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.isStopAnchor('A')).toBe(true);

      await act(async () => {
        await result.current.removeStop('A');
      });

      expect(result.current.isStopAnchor('A')).toBe(false);
    });
  });

  describe('validation', () => {
    it('drops entries with missing stopId', () => {
      const entries = [
        { stopName: 'No ID', stopLat: 35.0, stopLon: 139.0, routeTypes: [3], createdAt: 1000 },
        {
          stopId: 'valid',
          stopName: 'Valid',
          stopLat: 35.0,
          stopLon: 139.0,
          routeTypes: [3],
          createdAt: 2000,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('valid');
    });

    it('drops entries with missing stopLat/stopLon', () => {
      const entries = [
        { stopId: 'nocoord', stopName: 'No Coord', routeTypes: [3], createdAt: 1000 },
        {
          stopId: 'valid',
          stopName: 'Valid',
          stopLat: 35.0,
          stopLon: 139.0,
          routeTypes: [3],
          createdAt: 2000,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('valid');
    });

    it('drops non-object entries', () => {
      const entries = [
        'string',
        null,
        42,
        {
          stopId: 'ok',
          stopName: 'OK',
          stopLat: 35.0,
          stopLon: 139.0,
          routeTypes: [3],
          createdAt: 1000,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].stopId).toBe('ok');
    });

    it('returns empty array for corrupted JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const { result } = renderHook(() => useAnchors());
      expect(result.current.anchors).toEqual([]);
    });
  });
});
