import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllCaches,
  recoverFromCacheCorruption,
  unregisterAllServiceWorkers,
} from '../cache-recovery';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearAllCaches', () => {
  it('returns unsupported when the Cache Storage API is unavailable', async () => {
    // jsdom does not implement Cache Storage, so `caches` is absent here.
    expect(await clearAllCaches()).toEqual({ kind: 'unsupported' });
  });

  it('deletes every cache and reports ok', async () => {
    const deleteFn = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['gtfs-data-v2', 'map-tiles', 'workbox-precache-v1']),
      delete: deleteFn,
    });

    const result = await clearAllCaches();

    expect(deleteFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ kind: 'ok', cleared: 3 });
  });

  it('reports ok with zero cleared when there are no caches', async () => {
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    expect(await clearAllCaches()).toEqual({ kind: 'ok', cleared: 0 });
  });

  it('attempts every cache and reports partial when some deletions fail', async () => {
    const failure = new Error('delete failed');
    const deleteFn = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['a', 'b', 'c']),
      delete: deleteFn,
    });

    const result = await clearAllCaches();

    expect(deleteFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ kind: 'partial', cleared: 2, failed: 1, errors: [failure] });
  });

  it('reports partial when a cache deletion resolves false', async () => {
    const deleteFn = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: deleteFn,
    });

    const result = await clearAllCaches();

    expect(deleteFn).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe('partial');
    if (result.kind === 'partial') {
      expect(result.cleared).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect((result.errors[0] as Error).message).toBe('Operation resolved false');
    }
  });

  it('reports failed when cache enumeration itself throws', async () => {
    const failure = new Error('keys failed');
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(failure),
      delete: vi.fn(),
    });

    expect(await clearAllCaches()).toEqual({ kind: 'failed', error: failure });
  });
});

describe('unregisterAllServiceWorkers', () => {
  it('returns unsupported when the Service Worker API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect(await unregisterAllServiceWorkers()).toEqual({ kind: 'unsupported' });
  });

  it('unregisters every registration and reports ok', async () => {
    const unregisterA = vi.fn().mockResolvedValue(true);
    const unregisterB = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]),
      },
    });

    const result = await unregisterAllServiceWorkers();

    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'ok', cleared: 2 });
  });

  it('attempts every registration and reports partial when some fail', async () => {
    const failure = new Error('unregister failed');
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([
            { unregister: vi.fn().mockResolvedValue(true) },
            { unregister: vi.fn().mockRejectedValue(failure) },
          ]),
      },
    });

    expect(await unregisterAllServiceWorkers()).toEqual({
      kind: 'partial',
      cleared: 1,
      failed: 1,
      errors: [failure],
    });
  });

  it('reports partial when a service worker unregister resolves false', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([
            { unregister: vi.fn().mockResolvedValue(true) },
            { unregister: vi.fn().mockResolvedValue(false) },
          ]),
      },
    });

    const result = await unregisterAllServiceWorkers();

    expect(result.kind).toBe('partial');
    if (result.kind === 'partial') {
      expect(result.cleared).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect((result.errors[0] as Error).message).toBe('Operation resolved false');
    }
  });

  it('reports failed when getRegistrations itself throws', async () => {
    const failure = new Error('getRegistrations failed');
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockRejectedValue(failure),
      },
    });

    expect(await unregisterAllServiceWorkers()).toEqual({ kind: 'failed', error: failure });
  });
});

describe('recoverFromCacheCorruption', () => {
  it('reloads the page after clearing caches and service workers', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['gtfs-data-v2']),
      delete: vi.fn().mockResolvedValue(true),
    });
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]) },
    });

    await recoverFromCacheCorruption();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when cache clearing fails and service workers are unsupported', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('keys failed')),
      delete: vi.fn(),
    });
    vi.stubGlobal('navigator', {});

    await recoverFromCacheCorruption();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
