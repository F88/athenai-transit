/**
 * Tests for data-source-selection-storage.ts.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredEnabledGroupIds,
  loadEnabledGroupIdsFromStorage,
  saveEnabledGroupIdsToStorage,
} from '../data-source-selection-storage';

const STORAGE_KEY = 'enabled-sources';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadEnabledGroupIdsFromStorage', () => {
  it('returns null when the localStorage key is missing', () => {
    expect(loadEnabledGroupIdsFromStorage()).toBeNull();
  });

  it('returns the parsed Set for a valid stored array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'toei-train']));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).not.toBeNull();
    expect([...result!]).toEqual(['toei-bus', 'toei-train']);
  });

  it('returns null and clears storage when a non-empty array has no resolvable IDs', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['gone-1', 123, null]));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns an empty Set for an explicit empty array (β semantic)', () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).not.toBeNull();
    expect(result!.size).toBe(0);
    // Storage must NOT be removed — empty Set is a user-explicit value.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('filters stale IDs (not in config) and writes back the cleaned value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'unknown-stale', 'toei-train']));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).not.toBeNull();
    expect([...result!].sort()).toEqual(['toei-bus', 'toei-train']);
    // Storage write-back: cleaned value persisted so subsequent reads
    // see the clean state.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['toei-bus', 'toei-train']);
  });

  it('dedupes repeated valid IDs and writes back the canonicalized value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'toei-bus', 'toei-train']));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).not.toBeNull();
    expect([...result!]).toEqual(['toei-bus', 'toei-train']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['toei-bus', 'toei-train']);
  });

  it('filters non-string elements and writes back when some valid IDs remain', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 123, null, 'toei-train']));
    const result = loadEnabledGroupIdsFromStorage();
    expect([...result!].sort()).toEqual(['toei-bus', 'toei-train']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['toei-bus', 'toei-train']);
  });

  it('returns null and clears storage for an array whose elements are all non-string ([123])', () => {
    // `[123]` is an array (so it dodges the non-array branch) but contains
    // no resolvable group IDs. Without explicit handling this would
    // collapse to an empty Set and be mistaken for user-explicit empty
    // on the next load.
    localStorage.setItem(STORAGE_KEY, JSON.stringify([123]));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage for [null, 123, true] (mixed unrecoverable)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([null, 123, true]));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage for an array mixing stale IDs and non-strings (none resolve)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['gone-stale', 42, null]));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage when every stored ID is stale', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['gone-1', 'gone-2']));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    // The misleading stored value is removed so the next load falls
    // back to defaults via caller-side handling.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json');
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage for non-array JSON (object)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    const result = loadEnabledGroupIdsFromStorage();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still returns the cleaned Set when cleanup write-back throws during load', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'toei-bus', 'toei-train']));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const result = loadEnabledGroupIdsFromStorage();

    expect(result).not.toBeNull();
    expect([...result!]).toEqual(['toei-bus', 'toei-train']);
  });

  it('still returns null when cleanup remove throws during load', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadEnabledGroupIdsFromStorage()).toBeNull();
  });

  it('returns null silently when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadEnabledGroupIdsFromStorage()).toBeNull();
  });
});

describe('saveEnabledGroupIdsToStorage', () => {
  it('persists a non-empty Set as JSON array', () => {
    saveEnabledGroupIdsToStorage(new Set(['toei-bus', 'toei-train']));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['toei-bus', 'toei-train']);
  });

  it("persists an empty Set as '[]' (NOT removeItem)", () => {
    saveEnabledGroupIdsToStorage(new Set());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('silently ignores when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveEnabledGroupIdsToStorage(new Set(['x']))).not.toThrow();
  });
});

describe('clearStoredEnabledGroupIds', () => {
  it('removes the localStorage key', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus']));
    clearStoredEnabledGroupIds();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('is a no-op when the key does not exist', () => {
    expect(() => clearStoredEnabledGroupIds()).not.toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('silently ignores when localStorage.removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearStoredEnabledGroupIds()).not.toThrow();
  });
});
