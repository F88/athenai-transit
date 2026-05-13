/**
 * Tests for use-user-data-source-settings.ts.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserDataSourceSettings } from '../use-user-data-source-settings';
import * as storage from '../../domain/datasource/data-source-selection-storage';
import settings from '../../config/data-source-settings';
import { getDefaultEnabledIds } from '../../domain/datasource/data-source-selection';

const STORAGE_KEY = 'enabled-sources';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUserDataSourceSettings', () => {
  it('falls back to config defaults when storage returns null', () => {
    const { result } = renderHook(() => useUserDataSourceSettings());
    const defaults = getDefaultEnabledIds(settings);
    expect([...result.current.enabledGroupIds].sort()).toEqual([...defaults].sort());
  });

  it('uses the stored Set when storage returns a value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'toei-train']));
    const { result } = renderHook(() => useUserDataSourceSettings());
    expect([...result.current.enabledGroupIds].sort()).toEqual(['toei-bus', 'toei-train']);
  });

  it('honours an explicit empty Set (β semantic) on initial load', () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    const { result } = renderHook(() => useUserDataSourceSettings());
    expect(result.current.enabledGroupIds.size).toBe(0);
  });

  it('setGroupEnabled(id, true) adds the id to the Set', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus']));
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupEnabled('toei-train', true);
    });
    expect([...result.current.enabledGroupIds].sort()).toEqual(['toei-bus', 'toei-train']);
  });

  it('setGroupEnabled(id, false) removes the id from the Set', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'toei-train']));
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupEnabled('toei-bus', false);
    });
    expect([...result.current.enabledGroupIds]).toEqual(['toei-train']);
  });

  it('setGroupEnabled delegates persistence to the storage utility', () => {
    const saveSpy = vi.spyOn(storage, 'saveEnabledGroupIdsToStorage');
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupEnabled('toei-bus', false);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const arg = saveSpy.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(Set);
    // The persisted Set must NOT contain the id that was just turned off.
    expect((arg as Set<string>).has('toei-bus')).toBe(false);
  });

  it('toggling everything off persists an empty Set (not removeItem)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus']));
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupEnabled('toei-bus', false);
    });
    expect(result.current.enabledGroupIds.size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('setGroupsEnabled([...], true) adds every passed id in a single update', () => {
    const saveSpy = vi.spyOn(storage, 'saveEnabledGroupIdsToStorage');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupsEnabled(['toei-bus', 'toei-train', 'toko'], true);
    });
    expect([...result.current.enabledGroupIds].sort()).toEqual(['toei-bus', 'toei-train', 'toko']);
    // Atomic: one save for the whole batch, not one per id.
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('setGroupsEnabled([...], false) removes every passed id in a single update', () => {
    const saveSpy = vi.spyOn(storage, 'saveEnabledGroupIdsToStorage');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(['toei-bus', 'toei-train', 'toko', 'yurikamome']),
    );
    const { result } = renderHook(() => useUserDataSourceSettings());
    act(() => {
      result.current.setGroupsEnabled(['toei-bus', 'toko'], false);
    });
    expect([...result.current.enabledGroupIds].sort()).toEqual(['toei-train', 'yurikamome']);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('setGroupsEnabled with an empty list is a no-op but still writes (single save)', () => {
    const saveSpy = vi.spyOn(storage, 'saveEnabledGroupIdsToStorage');
    const { result } = renderHook(() => useUserDataSourceSettings());
    const before = result.current.enabledGroupIds;
    act(() => {
      result.current.setGroupsEnabled([], true);
    });
    // Set contents unchanged.
    expect([...result.current.enabledGroupIds].sort()).toEqual([...before].sort());
    // Persistence still triggered once (single write per call); the Set
    // it persists is just identical to the prior one.
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('resetToDefaults clears storage and restores defaults', () => {
    const clearSpy = vi.spyOn(storage, 'clearStoredEnabledGroupIds');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus']));
    const { result } = renderHook(() => useUserDataSourceSettings());
    expect([...result.current.enabledGroupIds]).toEqual(['toei-bus']);
    act(() => {
      result.current.resetToDefaults();
    });
    expect(clearSpy).toHaveBeenCalledTimes(1);
    const defaults = getDefaultEnabledIds(settings);
    expect([...result.current.enabledGroupIds].sort()).toEqual([...defaults].sort());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
