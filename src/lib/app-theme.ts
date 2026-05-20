import type { Theme } from '../types/app/settings';

const SETTINGS_STORAGE_KEY = 'athenai-settings';

type StoredSettings = {
  theme?: unknown;
};

export function applyAppTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function loadStoredAppTheme(): Theme {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw === null) {
      return 'light';
    }

    const settings = JSON.parse(raw) as StoredSettings;
    return settings.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyStoredAppTheme(): void {
  applyAppTheme(loadStoredAppTheme());
}
