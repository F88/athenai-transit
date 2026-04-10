/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourceManager } from '../data-source-manager';
import type { SourceGroup } from '../../types/app/source-group';
import settings from '../data-source-settings';
import { resetParamsCache } from '../../lib/query-params';

const STORAGE_KEY = 'enabled-sources';

/**
 * Replace the current URL (path + query) and reset the cached
 * URLSearchParams instance so the next call to `getSourcesParam()`
 * sees the new search string.
 */
function setSearch(search: string): void {
  window.history.replaceState({}, '', search === '' ? '/' : `/?${search}`);
  resetParamsCache();
}

async function importFreshDataSourceManager(
  customSettings?: SourceGroup[],
): Promise<typeof DataSourceManager> {
  vi.resetModules();

  if (customSettings) {
    vi.doMock('../data-source-settings', () => ({
      default: customSettings,
    }));
  }

  const mod = await import('../data-source-manager');
  return mod.DataSourceManager;
}

function createCustomSettings(): SourceGroup[] {
  return [
    {
      id: 'default-on',
      prefixes: ['on'],
      routeTypes: [3],
      enabled: true,
      name: { name: 'Default On', names: { en: 'Default On' } },
      countries: ['JP'],
    },
    {
      id: 'default-off',
      prefixes: ['off'],
      routeTypes: [3],
      enabled: false,
      name: { name: 'Default Off', names: { en: 'Default Off' } },
      countries: ['JP'],
    },
  ];
}

function createMultiPrefixSettings(): SourceGroup[] {
  return [
    {
      id: 'alpha',
      prefixes: ['alpha-local', 'alpha-express'],
      routeTypes: [3],
      enabled: true,
      name: { name: 'Alpha', names: { en: 'Alpha' } },
      countries: ['JP'],
    },
    {
      id: 'beta',
      prefixes: ['beta-main'],
      routeTypes: [2],
      enabled: false,
      name: { name: 'Beta', names: { en: 'Beta' } },
      countries: ['JP'],
    },
    {
      id: 'gamma',
      prefixes: ['gamma-main'],
      routeTypes: [0],
      enabled: true,
      name: { name: 'Gamma', names: { en: 'Gamma' } },
      countries: ['DE'],
    },
  ];
}

function createDuplicateIdSettings(): SourceGroup[] {
  return [
    {
      id: 'shared',
      prefixes: ['c', 'a'],
      routeTypes: [3],
      enabled: true,
      name: { name: 'Shared A', names: { en: 'Shared A' } },
      countries: ['JP'],
    },
    {
      id: 'shared',
      prefixes: ['a', 'a', 'b', 'a'],
      routeTypes: [3],
      enabled: true,
      name: { name: 'Shared B', names: { en: 'Shared B' } },
      countries: ['JP'],
    },
  ];
}

beforeEach(() => {
  localStorage.clear();
  setSearch('');
});

afterEach(() => {
  vi.doUnmock('../data-source-settings');
  vi.resetModules();
});

describe('DataSourceManager', () => {
  describe('Constructor', () => {
    it('uses only default-enabled groups when neither URL param nor localStorage is present', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      const manager = new DataSourceManager();

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['on']);
    });

    it('enables every group including config-default-disabled ones when URL param is `?sources=all`', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      setSearch('sources=all');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(true);
      expect(manager.getEnabledPrefixes()).toEqual(['on', 'off']);
    });

    it('enables only groups containing the requested prefix when URL param lists prefixes', () => {
      // `minkuru` belongs to the `toei-bus` group only.
      setSearch('sources=minkuru');
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(false);
      expect(manager.isEnabled('yurikamome')).toBe(false);
      expect(manager.isEnabled('vag-freiburg')).toBe(false);
    });

    it('enables a config-default-disabled group when query params explicitly target it', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      setSearch('sources=beta-main');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(true);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['beta-main']);
    });

    it('hydrates the enabled set from localStorage when no URL param is present', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'yurikamome']));
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(true);
      expect(manager.isEnabled('keio-bus')).toBe(false);
    });

    it('enables a config-default-disabled group when localStorage explicitly includes it', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['beta']));
      const manager = new DataSourceManager();

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(true);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['beta-main']);
    });

    it('falls back to default-enabled groups when localStorage contains invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      const manager = new DataSourceManager();

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['on']);
    });

    it('treats a JSON string in localStorage as a malformed persisted selection and enables no known groups', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      localStorage.setItem(STORAGE_KEY, JSON.stringify('beta'));
      const manager = new DataSourceManager();

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(false);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual([]);
    });

    it('replaces localStorage entries instead of unioning with them when URL params are present', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['alpha']));
      setSearch('sources=beta-main');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(true);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['beta-main']);
    });

    it('treats a no-match URL param as an explicit empty override even when localStorage has enabled groups', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus', 'yurikamome']));
      setSearch('sources=nonexistent-prefix');
      const manager = new DataSourceManager();

      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
      expect(manager.getEnabledPrefixes()).toEqual([]);
    });

    it('falls through to localStorage when `?sources=` has an empty value', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['toei-bus']));
      setSearch('sources=');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('does not treat an empty `?sources=` value as `all`', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      setSearch('sources=');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual(['on']);
    });

    it('enables every group whose prefixes match a comma-separated list', () => {
      // `minkuru` → toei-bus, `toaran` → toei-train
      setSearch('sources=minkuru,toaran');
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('trims whitespace around comma-separated prefixes', () => {
      setSearch('sources=minkuru%2C%20toaran'); // "minkuru, toaran"
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('enables nothing when the requested prefix matches no group', () => {
      setSearch('sources=nonexistent-prefix');
      const manager = new DataSourceManager();
      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });

    it('treats `all` as an exact match — `all,minkuru` is parsed as a prefix list', () => {
      // The `all` keyword is honoured only when it is the *entire* param value.
      // Anything else is split on commas and looked up as prefixes, where
      // `all` itself never matches a real GTFS prefix.
      setSearch('sources=all,minkuru');
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(false);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('treats an empty array in localStorage as "everything disabled"', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      const manager = new DataSourceManager();
      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });

    it('enables no known groups when localStorage contains only unknown ids', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['unknown-id']));
      const manager = new DataSourceManager();
      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
      expect(manager.getEnabledPrefixes()).toEqual([]);
    });

    it('treats all groups with the same id as enabled when defaults include that id', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createDuplicateIdSettings());
      const manager = new DataSourceManager();

      expect(manager.isEnabled('shared')).toBe(true);
      expect(manager.getEnabledPrefixes()).toEqual(['c', 'a', 'b']);
    });

    it('treats all groups with the same id as enabled when localStorage includes that id', async () => {
      const groups = createDuplicateIdSettings().map((group) => ({ ...group, enabled: false }));
      const DataSourceManager = await importFreshDataSourceManager(groups);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['shared']));
      const manager = new DataSourceManager();

      expect(manager.isEnabled('shared')).toBe(true);
      expect(manager.getEnabledPrefixes()).toEqual(['c', 'a', 'b']);
    });

    it('treats all groups with the same id as enabled when query param matches one of them', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createDuplicateIdSettings());
      setSearch('sources=b');
      const manager = new DataSourceManager();

      expect(manager.isEnabled('shared')).toBe(true);
      expect(manager.getEnabledPrefixes()).toEqual(['c', 'a', 'b']);
    });
  });

  describe('getGroups', () => {
    it('returns every configured source group in definition order', async () => {
      const groups = createMultiPrefixSettings();
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager();

      expect(manager.getGroups()).toEqual(groups);
    });

    it('returns groups regardless of their enabled state', async () => {
      const groups = createMultiPrefixSettings();
      const DataSourceManager = await importFreshDataSourceManager(groups);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      const manager = new DataSourceManager();

      expect(manager.getGroups()).toEqual(groups);
      for (const group of manager.getGroups()) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });
  });

  describe('isEnabled', () => {
    it('returns true for a default-enabled group', () => {
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
    });

    it('returns false for a group that has been disabled via setEnabled', () => {
      const manager = new DataSourceManager();
      manager.setEnabled('toei-bus', false);
      expect(manager.isEnabled('toei-bus')).toBe(false);
    });

    it('returns false for an unknown group id', () => {
      const manager = new DataSourceManager();
      expect(manager.isEnabled('this-group-does-not-exist')).toBe(false);
    });

    it('reflects re-enabling a previously disabled group', () => {
      const manager = new DataSourceManager();
      manager.setEnabled('toei-bus', false);
      expect(manager.isEnabled('toei-bus')).toBe(false);
      manager.setEnabled('toei-bus', true);
      expect(manager.isEnabled('toei-bus')).toBe(true);
    });
  });

  describe('setEnabled', () => {
    it('disables a previously enabled group', () => {
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(true);
      manager.setEnabled('toei-bus', false);
      expect(manager.isEnabled('toei-bus')).toBe(false);
    });

    it('enables a previously disabled group', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      const manager = new DataSourceManager();
      expect(manager.isEnabled('toei-bus')).toBe(false);
      manager.setEnabled('toei-bus', true);
      expect(manager.isEnabled('toei-bus')).toBe(true);
    });

    it('is idempotent: enabling an already-enabled group is a no-op', () => {
      const manager = new DataSourceManager();
      manager.setEnabled('toei-bus', true);
      manager.setEnabled('toei-bus', true);
      expect(manager.isEnabled('toei-bus')).toBe(true);
      // The persisted set must not contain duplicate entries.
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
      const occurrences = stored.filter((id) => id === 'toei-bus').length;
      expect(occurrences).toBe(1);
    });

    it('disabling an unknown id does not throw', () => {
      const manager = new DataSourceManager();
      expect(() => manager.setEnabled('unknown-id', false)).not.toThrow();
    });

    it('persists the resulting enabled set to localStorage', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager();
      manager.setEnabled('gamma', false);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '[]') as string[];
      expect(parsed).toEqual(['alpha']);
    });

    it('changes are visible to a freshly constructed manager (round-trip via localStorage)', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager1 = new DataSourceManager();
      manager1.setEnabled('alpha', false);
      manager1.setEnabled('beta', true);

      const manager2 = new DataSourceManager();
      expect(manager2.isEnabled('alpha')).toBe(false);
      expect(manager2.isEnabled('beta')).toBe(true);
      expect(manager2.isEnabled('gamma')).toBe(true);
    });

    it('disables all groups that share the same id', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createDuplicateIdSettings());
      const manager = new DataSourceManager();

      manager.setEnabled('shared', false);

      expect(manager.isEnabled('shared')).toBe(false);
      expect(manager.getEnabledPrefixes()).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
    });
  });

  describe('getEnabledPrefixes', () => {
    it('returns prefixes from default-enabled groups in group order', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual(['alpha-local', 'alpha-express', 'gamma-main']);
    });

    it('returns an empty array when nothing is enabled', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual([]);
    });

    it('excludes prefixes from groups that were disabled after construction', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager();
      manager.setEnabled('alpha', false);

      expect(manager.getEnabledPrefixes()).toEqual(['gamma-main']);
    });

    it('returns prefixes only from explicitly enabled groups when URL param is used', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      setSearch('sources=alpha-express,beta-main');
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual(['alpha-local', 'alpha-express', 'beta-main']);
    });

    it('preserves group definition order instead of localStorage insertion order', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['gamma', 'alpha']));
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual(['alpha-local', 'alpha-express', 'gamma-main']);
    });

    it('deduplicates repeated prefixes before returning load targets', async () => {
      const groups: SourceGroup[] = [
        {
          id: 'default-on',
          prefixes: ['on'],
          routeTypes: [3],
          enabled: true,
          name: { name: 'Default On', names: { en: 'Default On' } },
          countries: ['JP'],
        },
        {
          id: 'default-off',
          prefixes: ['off', 'on'],
          routeTypes: [3],
          enabled: true,
          name: { name: 'Default Off', names: { en: 'Default Off' } },
          countries: ['JP'],
        },
      ];
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual(['on', 'off']);
    });

    it('deduplicates repeated prefixes within and across enabled groups', async () => {
      const groups: SourceGroup[] = [
        {
          id: 'default-on',
          prefixes: ['c', 'a'],
          routeTypes: [3],
          enabled: true,
          name: { name: 'Default On', names: { en: 'Default On' } },
          countries: ['JP'],
        },
        {
          id: 'default-off',
          prefixes: ['a', 'a', 'b', 'a'],
          routeTypes: [3],
          enabled: true,
          name: { name: 'Default Off', names: { en: 'Default Off' } },
          countries: ['JP'],
        },
      ];
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager();

      expect(manager.getEnabledPrefixes()).toEqual(['c', 'a', 'b']);
    });
  });
});
