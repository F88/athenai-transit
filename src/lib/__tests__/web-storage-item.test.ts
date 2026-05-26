import { describe, expect, it, vi } from 'vitest';
import { WebStorageItem } from '../web-storage-item';

type StorageMock = Storage & {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function createStorageMock(overrides?: {
  getItem?: () => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}): StorageMock {
  const getItem = vi.fn(overrides?.getItem ?? (() => null));
  const setItem = vi.fn(overrides?.setItem ?? (() => {}));
  const removeItem = vi.fn(overrides?.removeItem ?? (() => {}));

  return {
    get length() {
      return 0;
    },
    clear: vi.fn(),
    key: vi.fn(() => null),
    getItem,
    setItem,
    removeItem,
  };
}

describe('WebStorageItem', () => {
  describe('read', () => {
    it('with storage unavailable returns a failure result', () => {
      const item = new WebStorageItem('stop-history', null as unknown as Storage | undefined);

      expect(item.read()).toEqual({ success: false, error: 'Web Storage API is not available' });
    });

    it('with no stored value returns a success result with null', () => {
      const storage = createStorageMock({ getItem: () => null });
      const item = new WebStorageItem('stop-history', storage);

      expect(item.read()).toEqual({ success: true, data: null });
      expect(storage.getItem).toHaveBeenCalledWith('stop-history');
    });

    it('with stored value returns a success result with that value', () => {
      const storage = createStorageMock({ getItem: () => '{"version":2}' });
      const item = new WebStorageItem('stop-history', storage);

      expect(item.read()).toEqual({ success: true, data: '{"version":2}' });
      expect(storage.getItem).toHaveBeenCalledWith('stop-history');
    });

    it('when storage throws converts the error into a failure result', () => {
      const storage = createStorageMock({
        getItem: () => {
          throw new Error('read failed');
        },
      });
      const item = new WebStorageItem('stop-history', storage);

      expect(item.read()).toEqual({
        success: false,
        error: "Failed to read 'stop-history' from storage",
      });
    });
  });

  describe('write', () => {
    it('with storage unavailable returns a failure result', () => {
      const item = new WebStorageItem('stop-history', null as unknown as Storage | undefined);

      expect(item.write('{"version":2}')).toEqual({
        success: false,
        error: 'Web Storage API is not available',
      });
    });

    it('with writable storage stores the value and returns success', () => {
      const storage = createStorageMock();
      const item = new WebStorageItem('stop-history', storage);

      expect(item.write('{"version":2}')).toEqual({ success: true, data: undefined });
      expect(storage.setItem).toHaveBeenCalledWith('stop-history', '{"version":2}');
    });

    it('when storage throws converts the error into a failure result', () => {
      const storage = createStorageMock({
        setItem: () => {
          throw new Error('write failed');
        },
      });
      const item = new WebStorageItem('stop-history', storage);

      expect(item.write('{"version":2}')).toEqual({
        success: false,
        error: "Failed to write 'stop-history' to storage",
      });
    });
  });

  describe('remove', () => {
    it('with storage unavailable returns a failure result', () => {
      const item = new WebStorageItem('stop-history', null as unknown as Storage | undefined);

      expect(item.remove()).toEqual({
        success: false,
        error: 'Web Storage API is not available',
      });
    });

    it('with removable storage removes the key and returns success', () => {
      const storage = createStorageMock();
      const item = new WebStorageItem('stop-history', storage);

      expect(item.remove()).toEqual({ success: true, data: undefined });
      expect(storage.removeItem).toHaveBeenCalledWith('stop-history');
    });

    it('when storage throws converts the error into a failure result', () => {
      const storage = createStorageMock({
        removeItem: () => {
          throw new Error('remove failed');
        },
      });
      const item = new WebStorageItem('stop-history', storage);

      expect(item.remove()).toEqual({
        success: false,
        error: "Failed to remove 'stop-history' from storage",
      });
    });
  });
});
