import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStopMeta } from '../../../__tests__/helpers';
import {
  STOP_HISTORY_STORAGE_VERSION,
  type StopHistoryEntry,
} from '../../../domain/transit/stop-history';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import { LocalStorageStopSelectionRepository } from '../local-storage-stop-selection-repository';

const STORAGE_KEY = 'stop-history';

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
      agencyNames: [],
    },
    selectedAt,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LocalStorageStopSelectionRepository', () => {
  describe('getHistory', () => {
    it('returns empty history when storage is empty', async () => {
      const repo = new LocalStorageStopSelectionRepository();

      await expect(repo.getHistory()).resolves.toEqual({ success: true, data: [] });
    });

    it('loads current-shape history from storage', async () => {
      const entry = makeHistoryEntry('A', [3], 1234);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STOP_HISTORY_STORAGE_VERSION, entries: [entry] }),
      );
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.getHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([entry]);
      }
    });

    it('migrates flat stored entries into snapshot entries and re-saves them', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 2,
          entries: [
            {
              stopId: 'legacy-flat',
              fallbackName: 'Legacy Flat',
              routeTypes: [0, 3],
              selectedAt: 555,
            },
          ],
        }),
      );
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.getHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([
          {
            snapshot: {
              stopId: 'legacy-flat',
              name: 'Legacy Flat',
              lat: null,
              lon: null,
              routeTypes: [0, 3],
              agencyNames: [],
            },
            selectedAt: 555,
          },
        ]);
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
        version: number;
        entries: StopHistoryEntry[];
      };
      expect(stored.version).toBe(STOP_HISTORY_STORAGE_VERSION);
      expect(stored.entries[0].snapshot.name).toBe('Legacy Flat');
      expect(stored.entries[0].snapshot.routeTypes).toEqual([0, 3]);
    });

    it('migrates legacy stopWithMeta entries and preserves coordinates', async () => {
      const legacyMeta = makeStopMeta('legacy-meta');
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            stopWithMeta: legacyMeta,
            routeType: 2,
            selectedAt: 789,
          },
        ]),
      );
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.getHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([
          {
            snapshot: {
              stopId: 'legacy-meta',
              name: legacyMeta.stop.stop_name,
              lat: legacyMeta.stop.stop_lat,
              lon: legacyMeta.stop.stop_lon,
              routeTypes: [2],
              agencyNames: [],
            },
            selectedAt: 789,
          },
        ]);
      }
    });

    it('drops invalid entries and re-saves only valid ones', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STOP_HISTORY_STORAGE_VERSION,
          entries: [
            {
              stopId: 'valid',
              snapshot: {
                stopId: 'valid',
                name: 'Valid',
                lat: 35,
                lon: 139,
                routeTypes: [3],
                agencyNames: [],
              },
              selectedAt: 1,
            },
            { stopId: 'broken', snapshot: { name: 'Broken', lat: 35, lon: 139 }, selectedAt: 2 },
          ],
        }),
      );
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.getHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([
          {
            snapshot: {
              stopId: 'valid',
              name: 'Valid',
              lat: 35,
              lon: 139,
              routeTypes: [3],
              agencyNames: [],
            },
            selectedAt: 1,
          },
        ]);
      }
    });

    it('returns migrated entries even when the self-healing re-save fails', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 2,
          entries: [
            {
              stopId: 'legacy-flat',
              fallbackName: 'Legacy Flat',
              routeTypes: [0, 3],
              selectedAt: 555,
            },
          ],
        }),
      );
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.getHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([
          {
            snapshot: {
              stopId: 'legacy-flat',
              name: 'Legacy Flat',
              lat: null,
              lon: null,
              routeTypes: [0, 3],
              agencyNames: [],
            },
            selectedAt: 555,
          },
        ]);
      }
    });

    it('returns error when storage read throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const repo = new LocalStorageStopSelectionRepository();

      await expect(repo.getHistory()).resolves.toEqual({
        success: false,
        error: 'Failed to load stop history from storage',
      });
    });
  });

  describe('saveHistory', () => {
    it('persists the provided history snapshot', async () => {
      const repo = new LocalStorageStopSelectionRepository();
      const entries = [makeHistoryEntry('A', [3], 1000), makeHistoryEntry('B', [2], 900)];

      const result = await repo.saveHistory(entries);

      expect(result).toEqual({ success: true, data: undefined });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
        version: number;
        entries: StopHistoryEntry[];
      };
      expect(stored.version).toBe(STOP_HISTORY_STORAGE_VERSION);
      expect(stored.entries).toEqual(entries);
    });

    it('returns error when persistence fails', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.saveHistory([makeHistoryEntry('A')]);

      expect(result).toEqual({
        success: false,
        error: 'Failed to persist stop history to storage',
      });
    });
  });

  describe('clearHistory', () => {
    it('removes persisted history', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STOP_HISTORY_STORAGE_VERSION, entries: [makeHistoryEntry('A')] }),
      );
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.clearHistory();

      expect(result).toEqual({ success: true, data: undefined });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns error when removal fails', async () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const repo = new LocalStorageStopSelectionRepository();

      const result = await repo.clearHistory();

      expect(result).toEqual({
        success: false,
        error: 'Failed to clear stop history from storage',
      });
    });
  });

  describe('when localStorage getter itself throws', () => {
    // Reproduces Chrome's "block all cookies and site data" scenario, where
    // accessing `globalThis.localStorage` raises SecurityError before any
    // method can be called on it. Issue #237.
    let originalDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException(
            "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
            'SecurityError',
          );
        },
      });
    });

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      }
    });

    it('does not throw on construction', () => {
      expect(() => new LocalStorageStopSelectionRepository()).not.toThrow();
    });

    it('getHistory returns graceful failure', async () => {
      const repo = new LocalStorageStopSelectionRepository();

      await expect(repo.getHistory()).resolves.toEqual({
        success: false,
        error: 'Failed to load stop history from storage',
      });
    });

    it('saveHistory returns graceful failure', async () => {
      const repo = new LocalStorageStopSelectionRepository();

      await expect(repo.saveHistory([makeHistoryEntry('A')])).resolves.toEqual({
        success: false,
        error: 'Failed to persist stop history to storage',
      });
    });

    it('clearHistory returns graceful failure', async () => {
      const repo = new LocalStorageStopSelectionRepository();

      await expect(repo.clearHistory()).resolves.toEqual({
        success: false,
        error: 'Failed to clear stop history from storage',
      });
    });
  });
});
