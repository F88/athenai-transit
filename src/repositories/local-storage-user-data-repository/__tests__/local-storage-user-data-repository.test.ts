import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageUserDataRepository } from '../../local-storage-user-data-repository';
import type { AnchorEntry } from '../../../domain/portal/anchor';
import type { AppRouteTypeValue } from '../../../types/app/transit';

const STORAGE_KEY = 'portals';

function makeAnchorInput(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
): Omit<AnchorEntry, 'createdAt'> {
  return {
    stopId: id,
    stopName: `Stop ${id}`,
    stopLat: 35.0,
    stopLon: 139.0,
    routeTypes,
  };
}

function makeAnchorEntry(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  createdAt = 1000,
): AnchorEntry {
  return { ...makeAnchorInput(id, routeTypes), createdAt };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LocalStorageUserDataRepository', () => {
  describe('getAnchors', () => {
    it('returns empty array when localStorage is empty', async () => {
      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('loads existing anchors from localStorage', async () => {
      const entries = [makeAnchorEntry('A'), makeAnchorEntry('B')];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].stopId).toBe('A');
      }
    });

    it('drops invalid entries', async () => {
      const entries = [
        { stopName: 'No ID', stopLat: 35.0, stopLon: 139.0 },
        makeAnchorEntry('valid'),
        null,
        'string',
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].stopId).toBe('valid');
      }
    });

    it('returns empty array for corrupted JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns empty array when localStorage access throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns empty array when stored JSON is not an array', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stopId: 'A' }));

      const repo = new LocalStorageUserDataRepository();
      const result = await repo.getAnchors();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('addAnchor', () => {
    it('adds an anchor and persists to localStorage', async () => {
      const repo = new LocalStorageUserDataRepository();
      const result = await repo.addAnchor(makeAnchorInput('X'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopId).toBe('X');
        expect(result.data.createdAt).toBeGreaterThan(0);
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].stopId).toBe('X');
    });

    it('returns error for duplicate stopId', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.addAnchor(makeAnchorInput('A'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Duplicate');
      }
    });

    it('prepends new anchor to front', async () => {
      const repo = new LocalStorageUserDataRepository();
      await repo.addAnchor(makeAnchorInput('A'));
      await repo.addAnchor(makeAnchorInput('B'));

      const result = await repo.getAnchors();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].stopId).toBe('B');
        expect(result.data[1].stopId).toBe('A');
      }
    });

    it('preserves portal field', async () => {
      const repo = new LocalStorageUserDataRepository();
      const result = await repo.addAnchor({ ...makeAnchorInput('A'), portal: 'my-group' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portal).toBe('my-group');
      }
    });

    it('returns error when persistence fails', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.addAnchor(makeAnchorInput('A'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to persist');
      }

      const anchors = await repo.getAnchors();
      expect(anchors.success).toBe(true);
      if (anchors.success) {
        expect(anchors.data).toEqual([]);
      }
    });
  });

  describe('removeAnchor', () => {
    it('removes an anchor and persists', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([makeAnchorEntry('A'), makeAnchorEntry('B')]),
      );
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.removeAnchor('A');

      expect(result.success).toBe(true);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].stopId).toBe('B');
    });

    it('returns error when stopId not found', async () => {
      const repo = new LocalStorageUserDataRepository();
      const result = await repo.removeAnchor('Z');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('returns error when persistence fails', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.removeAnchor('A');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to persist');
      }

      const anchors = await repo.getAnchors();
      expect(anchors.success).toBe(true);
      if (anchors.success) {
        expect(anchors.data).toHaveLength(1);
        expect(anchors.data[0].stopId).toBe('A');
      }
    });
  });

  describe('updateAnchor', () => {
    it('updates an anchor and persists', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.updateAnchor({ ...makeAnchorInput('A'), stopName: 'Updated' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopName).toBe('Updated');
        expect(result.data.createdAt).toBe(1000);
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored[0].stopName).toBe('Updated');
    });

    it('returns error when stopId not found', async () => {
      const repo = new LocalStorageUserDataRepository();
      const result = await repo.updateAnchor(makeAnchorInput('Z'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('preserves portal when update omits it', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ ...makeAnchorEntry('A'), portal: 'my-group' }]),
      );
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.updateAnchor({ ...makeAnchorInput('A'), stopName: 'New' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopName).toBe('New');
        expect(result.data.portal).toBe('my-group');
      }
    });

    it('updates portal when provided', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ ...makeAnchorEntry('A'), portal: 'old' }]),
      );
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.updateAnchor({ ...makeAnchorInput('A'), portal: 'new' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portal).toBe('new');
      }
    });

    it('returns success with existing entry when unchanged (idempotent)', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.updateAnchor(makeAnchorInput('A'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopId).toBe('A');
        expect(result.data.stopName).toBe('Stop A');
      }
    });

    it('returns error when persistence fails', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.updateAnchor({ ...makeAnchorInput('A'), stopName: 'Updated' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to persist');
      }

      const anchors = await repo.getAnchors();
      expect(anchors.success).toBe(true);
      if (anchors.success) {
        expect(anchors.data).toHaveLength(1);
        expect(anchors.data[0].stopName).toBe('Stop A');
      }
    });
  });

  describe('batchUpdateAnchors', () => {
    it('updates multiple anchors with single persistence write', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([makeAnchorEntry('A'), makeAnchorEntry('B'), makeAnchorEntry('C')]),
      );
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.batchUpdateAnchors([
        { ...makeAnchorInput('A'), stopName: 'Updated A' },
        { ...makeAnchorInput('C'), stopName: 'Updated C' },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(3);
        expect(result.data.find((a: AnchorEntry) => a.stopId === 'A')?.stopName).toBe('Updated A');
        expect(result.data.find((a: AnchorEntry) => a.stopId === 'B')?.stopName).toBe('Stop B');
        expect(result.data.find((a: AnchorEntry) => a.stopId === 'C')?.stopName).toBe('Updated C');
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AnchorEntry[];
      expect(stored.find((a) => a.stopId === 'A')?.stopName).toBe('Updated A');
    });

    it('skips entries not found and updates the rest', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.batchUpdateAnchors([
        { ...makeAnchorInput('A'), stopName: 'Updated' },
        { ...makeAnchorInput('Z'), stopName: 'Ghost' },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].stopName).toBe('Updated');
      }
    });

    it('returns success without persisting when all entries are unchanged', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();
      const originalJson = localStorage.getItem(STORAGE_KEY);

      const result = await repo.batchUpdateAnchors([makeAnchorInput('A')]);

      expect(result.success).toBe(true);
      // localStorage should not have been rewritten
      expect(localStorage.getItem(STORAGE_KEY)).toBe(originalJson);
    });

    it('returns success for empty updates array', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.batchUpdateAnchors([]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });

    it('returns error when persistence fails', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAnchorEntry('A')]));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.batchUpdateAnchors([
        { ...makeAnchorInput('A'), stopName: 'Updated' },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to persist');
      }
    });

    it('preserves portal fields during batch update', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { ...makeAnchorEntry('A'), portal: 'group-1' },
          { ...makeAnchorEntry('B'), portal: 'group-2' },
        ]),
      );
      const repo = new LocalStorageUserDataRepository();

      const result = await repo.batchUpdateAnchors([
        { ...makeAnchorInput('A'), stopName: 'Updated A' },
        { ...makeAnchorInput('B'), stopName: 'Updated B' },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.find((a: AnchorEntry) => a.stopId === 'A')?.portal).toBe('group-1');
        expect(result.data.find((a: AnchorEntry) => a.stopId === 'B')?.portal).toBe('group-2');
      }
    });
  });
});
