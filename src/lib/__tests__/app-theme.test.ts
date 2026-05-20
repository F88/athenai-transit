import { beforeEach, describe, expect, it } from 'vitest';
import { applyAppTheme, applyStoredAppTheme, loadStoredAppTheme } from '../app-theme';

const SETTINGS_STORAGE_KEY = 'athenai-settings';

describe('app-theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('applies the dark class for dark theme', () => {
    applyAppTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class for light theme', () => {
    document.documentElement.classList.add('dark');

    applyAppTheme('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('loads the stored dark theme', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: 'dark' }));

    expect(loadStoredAppTheme()).toBe('dark');
  });

  it('falls back to light when stored settings are missing or invalid', () => {
    expect(loadStoredAppTheme()).toBe('light');

    localStorage.setItem(SETTINGS_STORAGE_KEY, 'not-json');

    expect(loadStoredAppTheme()).toBe('light');
  });

  it('applies the stored theme', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: 'dark' }));

    applyStoredAppTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
