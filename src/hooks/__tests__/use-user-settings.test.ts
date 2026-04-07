import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { DEFAULT_LANG, normalizeLang } from '../../config/supported-langs';
import { useUserSettings } from '../use-user-settings';

const STORAGE_KEY = 'athenai-settings';
const originalNavigatorLanguageDescriptor = Object.getOwnPropertyDescriptor(
  window.navigator,
  'language',
);

function setNavigatorLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: lang,
  });
}

function readStoredSettings(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
}

async function renderFreshUseUserSettings() {
  vi.resetModules();
  const module = await import('../use-user-settings');
  return renderHook(() => module.useUserSettings());
}

const IMPORT_TIME_DEFAULT_LANG = normalizeLang(
  typeof navigator !== 'undefined' ? navigator.language : '',
);

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  setNavigatorLanguage('ja-JP');
});

afterAll(() => {
  if (originalNavigatorLanguageDescriptor) {
    Object.defineProperty(window.navigator, 'language', originalNavigatorLanguageDescriptor);
  }
});

describe('useUserSettings', () => {
  // ── initial load ──────────────────────────────────────

  describe('initial load', () => {
    it('returns defaults when localStorage is empty', async () => {
      const { result } = await renderFreshUseUserSettings();
      const s = result.current.settings;

      expect(s.infoLevel).toBe('normal');
      expect(s.perfMode).toBe('normal');
      expect(s.renderMode).toBe('auto');
      expect(s.visibleRouteShapes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(s.visibleStopTypes).toEqual([0, 1, 2, 3]);
      expect(s.tileIndex).toBe(0);
      expect(s.theme).toBe('light');
      expect(s.doubleTapDrag).toBe('zoom-out');
      expect(s.lang).toBe('ja');
    });

    it('normalizes navigator.language on initial load', async () => {
      setNavigatorLanguage('zh-TW');

      const { result } = await renderFreshUseUserSettings();

      expect(result.current.settings.lang).toBe('zh-Hant');
    });

    it('falls back to DEFAULT_LANG when navigator.language is unsupported', async () => {
      setNavigatorLanguage('pt-BR');

      const { result } = await renderFreshUseUserSettings();

      expect(result.current.settings.lang).toBe(DEFAULT_LANG);
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

    it('returns defaults when localStorage contains invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');

      const { result } = await renderFreshUseUserSettings();
      const s = result.current.settings;

      expect(s.infoLevel).toBe('normal');
      expect(s.perfMode).toBe('normal');
      expect(s.renderMode).toBe('auto');
      expect(s.visibleRouteShapes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(s.visibleStopTypes).toEqual([0, 1, 2, 3]);
      expect(s.tileIndex).toBe(0);
      expect(s.theme).toBe('light');
      expect(s.doubleTapDrag).toBe('zoom-out');
      expect(s.lang).toBe('ja');
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
      const stored = readStoredSettings();
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

      const stored = readStoredSettings();
      expect(stored.infoLevel).toBe('detailed');
    });

    it('updates a transient setting in memory but not in localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('perfMode', 'full');
      });

      expect(result.current.settings.perfMode).toBe('full');

      const stored = readStoredSettings();
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

      const stored = readStoredSettings();
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
    it('defaults to navigator.language when supported, otherwise DEFAULT_LANG', async () => {
      const { result } = await renderFreshUseUserSettings();
      expect(result.current.settings.lang).toBe('ja');
    });

    it('persists lang to localStorage', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('lang', 'en');
      });

      expect(result.current.settings.lang).toBe('en');

      const stored = readStoredSettings();
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

      expect(result.current.settings.lang).toBe(IMPORT_TIME_DEFAULT_LANG);
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
      const stored = readStoredSettings();
      expect(stored.lang).toBe('ja');
    });

    it('accepts supported lang de on save', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSetting('lang', 'de');
      });

      const stored = readStoredSettings();
      expect(stored.lang).toBe('de');
    });

    it('normalizes unsupported lang to default on save via updateSettings', () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => {
        result.current.updateSettings({ lang: 'pt-BR' });
      });

      expect(result.current.settings.lang).toBe(DEFAULT_LANG);
      expect(readStoredSettings().lang).toBe(DEFAULT_LANG);
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
