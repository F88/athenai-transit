import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserSettings } from '../use-user-settings';

const STORAGE_KEY = 'athenai-settings';

beforeEach(() => {
  localStorage.clear();
});

describe('useUserSettings', () => {
  // ── initial load ──────────────────────────────────────

  describe('initial load', () => {
    it('returns defaults when localStorage is empty', () => {
      const { result } = renderHook(() => useUserSettings());
      const s = result.current.settings;

      expect(s.infoLevel).toBe('normal');
      expect(s.perfMode).toBe('normal');
      expect(s.renderMode).toBe('auto');
      expect(s.tileIndex).toBe(0);
      expect(s.theme).toBe('light');
      expect(s.doubleTapDrag).toBe('zoom-out');
      // lang depends on navigator.language; verify it's a supported value
      expect(typeof s.lang).toBe('string');
      expect(s.lang.length).toBeGreaterThan(0);
    });

    it('merges stored values with defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tileIndex: 2 }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.tileIndex).toBe(2);
      expect(result.current.settings.perfMode).toBe('normal');
    });

    it('fills missing keys from defaults (migration)', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ infoLevel: 'detailed' }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.infoLevel).toBe('detailed');
      expect(result.current.settings.tileIndex).toBe(0);
    });

    it('returns defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');

      const { result } = renderHook(() => useUserSettings());
      const s = result.current.settings;

      expect(s.infoLevel).toBe('normal');
      expect(s.perfMode).toBe('normal');
      expect(s.renderMode).toBe('auto');
      expect(s.tileIndex).toBe(0);
      expect(s.theme).toBe('light');
      expect(typeof s.lang).toBe('string');
    });
  });

  // ── transient keys ──────────────────────────────────────

  describe('transient keys', () => {
    it('does not persist perfMode or renderMode to localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSettings({
          perfMode: 'full',
          renderMode: 'standard',
        });
      });

      // In-memory state reflects the change
      expect(result.current.settings.perfMode).toBe('full');
      expect(result.current.settings.renderMode).toBe('standard');

      // localStorage does not contain transient keys
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.perfMode).toBeUndefined();
      expect(stored.renderMode).toBeUndefined();
    });

    it('ignores transient keys in localStorage on load', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          perfMode: 'full',
          renderMode: 'standard',
          infoLevel: 'detailed',
        }),
      );

      const { result } = renderHook(() => useUserSettings());

      // Transient keys revert to defaults
      expect(result.current.settings.perfMode).toBe('normal');
      expect(result.current.settings.renderMode).toBe('auto');
      // Non-transient keys are restored
      expect(result.current.settings.infoLevel).toBe('detailed');
    });

    it('resets transient keys on reload simulation', () => {
      const { result: first } = renderHook(() => useUserSettings());

      act(() => {
        first.current.updateSettings({
          perfMode: 'full',
          renderMode: 'standard',
          infoLevel: 'verbose',
        });
      });

      // Simulate reload
      const { result: second } = renderHook(() => useUserSettings());

      expect(second.current.settings.perfMode).toBe('normal');
      expect(second.current.settings.renderMode).toBe('auto');
      expect(second.current.settings.infoLevel).toBe('verbose');
    });
  });

  // ── updateSetting (single key) ──────────────────────────────

  describe('updateSetting', () => {
    it('updates a persistent setting and persists to localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('infoLevel', 'detailed');
      });

      expect(result.current.settings.infoLevel).toBe('detailed');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.infoLevel).toBe('detailed');
    });

    it('updates a transient setting in memory but not in localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('perfMode', 'full');
      });

      expect(result.current.settings.perfMode).toBe('full');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.perfMode).toBeUndefined();
    });

    it('preserves other settings when updating one key', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('infoLevel', 'verbose');
      });

      expect(result.current.settings.infoLevel).toBe('verbose');
      expect(result.current.settings.tileIndex).toBe(0);
    });
  });

  // ── updateSettings (multi-key) ──────────────────────────────

  describe('updateSettings', () => {
    it('updates multiple settings atomically', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSettings({
          infoLevel: 'verbose',
          tileIndex: 3,
        });
      });

      expect(result.current.settings.infoLevel).toBe('verbose');
      expect(result.current.settings.tileIndex).toBe(3);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.infoLevel).toBe('verbose');
      expect(stored.tileIndex).toBe(3);
    });

    it('writes to localStorage exactly once', () => {
      const { result } = renderHook(() => useUserSettings());
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        result.current.updateSettings({
          infoLevel: 'detailed',
          tileIndex: 2,
        });
      });

      const writes = spy.mock.calls.filter(([key]) => key === STORAGE_KEY);
      expect(writes).toHaveLength(1);
      spy.mockRestore();
    });

    it('can update a subset of settings', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSettings({ infoLevel: 'detailed' });
      });

      expect(result.current.settings.infoLevel).toBe('detailed');
      expect(result.current.settings.tileIndex).toBe(0);
    });
  });

  // ── atomicity: updateSetting vs updateSettings ───────────────────

  describe('atomicity', () => {
    it('two sequential updateSetting calls create an intermediate localStorage state', () => {
      const { result } = renderHook(() => useUserSettings());
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        result.current.updateSetting('infoLevel', 'detailed');
        result.current.updateSetting('tileIndex', 5);
      });

      // First write: infoLevel changed but tileIndex still default
      const firstWrite = JSON.parse(spy.mock.calls[0][1]) as Record<string, unknown>;
      expect(firstWrite).toMatchObject({
        infoLevel: 'detailed',
        tileIndex: 0, // not yet updated
      });

      // Second write: both updated
      const secondWrite = JSON.parse(spy.mock.calls[1][1]) as Record<string, unknown>;
      expect(secondWrite).toMatchObject({
        infoLevel: 'detailed',
        tileIndex: 5,
      });

      spy.mockRestore();
    });

    it('updateSettings avoids intermediate localStorage state', () => {
      const { result } = renderHook(() => useUserSettings());
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        result.current.updateSettings({
          infoLevel: 'detailed',
          tileIndex: 5,
        });
      });

      const writes = spy.mock.calls.filter(([key]) => key === STORAGE_KEY);
      expect(writes).toHaveLength(1);

      // The only write has both values updated together
      const stored = JSON.parse(writes[0][1]) as Record<string, unknown>;
      expect(stored).toMatchObject({
        infoLevel: 'detailed',
        tileIndex: 5,
      });

      spy.mockRestore();
    });
  });

  // ── lang setting ─────────────────────────────────────

  describe('lang setting', () => {
    it('defaults to navigator.language when supported, otherwise DEFAULT_LANG', () => {
      const { result } = renderHook(() => useUserSettings());
      const expected = ['ja', 'ja-Hrkt', 'en', 'de', 'es', 'fr', 'ko', 'zh-Hans', 'zh-Hant'];
      // navigator.language in test env may vary; result must be a supported lang
      expect(expected).toContain(result.current.settings.lang);
    });

    it('persists lang to localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('lang', 'en');
      });

      expect(result.current.settings.lang).toBe('en');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.lang).toBe('en');
    });

    it('restores lang from localStorage on reload', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: 'en' }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.lang).toBe('en');
    });

    it('fills lang with default when missing from stored data', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tileIndex: 1 }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.lang).toBe('ja');
      expect(result.current.settings.tileIndex).toBe(1);
    });

    it('normalizes unsupported lang to default on load', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: 'pt' }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.lang).toBe('ja');
    });

    it('normalizes corrupted lang to default on load', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: 'not-a-lang' }));

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.lang).toBe('ja');
    });

    it('normalizes unsupported lang to default on save via updateSetting', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('lang', 'pt');
      });

      // localStorage should have the normalized value
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.lang).toBe('ja');
    });

    it('accepts supported lang de on save', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('lang', 'de');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored.lang).toBe('de');
    });
  });

  // ── persistence round-trip ────────────────────────────

  describe('persistence', () => {
    it('survives a round-trip through localStorage for persistent keys', () => {
      const { result: first } = renderHook(() => useUserSettings());

      act(() => {
        first.current.updateSettings({
          infoLevel: 'verbose',
          tileIndex: 3,
        });
      });

      // Simulate a new hook instance (e.g., page reload)
      const { result: second } = renderHook(() => useUserSettings());

      expect(second.current.settings.infoLevel).toBe('verbose');
      expect(second.current.settings.tileIndex).toBe(3);
      // Transient keys reset to defaults
      expect(second.current.settings.perfMode).toBe('normal');
      expect(second.current.settings.renderMode).toBe('auto');
    });
  });
});
