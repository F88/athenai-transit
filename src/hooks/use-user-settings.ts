import { useCallback, useState } from 'react';
import type { UserSettings } from '../types/app/settings';
import { normalizeLang } from '../config/supported-langs';

const STORAGE_KEY = 'athenai-settings';

/** Keys excluded from localStorage persistence (always reset to defaults on reload). */
const TRANSIENT_KEYS: (keyof UserSettings)[] = ['perfMode', 'renderMode'];

const DEFAULTS: UserSettings = {
  perfMode: 'normal',
  renderMode: 'auto',
  tileIndex: 0,
  visibleStopTypes: [0, 1, 2, 3],
  visibleRouteShapes: [0, 1, 2, 3, 4, 5, 6, 7],
  infoLevel: 'normal',
  theme: 'light',
  doubleTapDrag: 'zoom-out',
  // Use browser language as default; normalizeLang falls back to DEFAULT_LANG
  // for unsupported languages or when navigator is unavailable (e.g. tests).
  lang: normalizeLang(typeof navigator !== 'undefined' ? navigator.language : ''),
};

/**
 * Strip {@link TRANSIENT_KEYS} from a settings object.
 *
 * @param settings - Partial settings to filter.
 * @returns A new object without the transient keys.
 */
function stripTransient(settings: Partial<UserSettings>): Partial<UserSettings> {
  const filtered = { ...settings };
  for (const key of TRANSIENT_KEYS) {
    delete filtered[key];
  }
  return filtered;
}

/**
 * Load user settings from localStorage, merging with defaults.
 *
 * Keys in {@link TRANSIENT_KEYS} are ignored even if present in stored data,
 * so they always revert to defaults on reload.
 *
 * @returns Merged settings object.
 */
function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const stored = { ...DEFAULTS, ...stripTransient(JSON.parse(raw) as Partial<UserSettings>) };
    stored.lang = normalizeLang(stored.lang);
    return stored;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Persist user settings to localStorage.
 *
 * Keys in {@link TRANSIENT_KEYS} are stripped before saving.
 *
 * @param settings - Settings object to save.
 */
function saveSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripTransient(settings)));
}

/**
 * Hook for managing user-configurable application settings.
 *
 * Settings are persisted to localStorage under the `athenai-settings` key.
 * New setting keys added in the future are safely merged with defaults.
 *
 * @returns `settings` — current settings, `updateSetting` — single-key updater,
 *          and `updateSettings` — multi-key atomic updater.
 */
export function useUserSettings(): {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
} {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        next.lang = normalizeLang(next.lang);
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      next.lang = normalizeLang(next.lang);
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSetting, updateSettings };
}
