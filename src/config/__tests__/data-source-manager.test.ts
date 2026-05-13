/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourceManager } from '../data-source-manager';
import type { SourceGroup } from '../../types/app/source-group';
import settings from '../data-source-settings';
import { resetParamsCache } from '../../lib/query-params';

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
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
      name: { name: 'Default On', names: { en: 'Default On' } },
      countries: ['JP'],
    },
    {
      id: 'default-off',
      prefixes: ['off'],
      routeTypes: [3],
      systemEnabledByDefault: false,
      userEnabledByDefault: false,
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
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
      name: { name: 'Alpha', names: { en: 'Alpha' } },
      countries: ['JP'],
    },
    {
      id: 'beta',
      prefixes: ['beta-main'],
      routeTypes: [2],
      systemEnabledByDefault: false,
      userEnabledByDefault: false,
      name: { name: 'Beta', names: { en: 'Beta' } },
      countries: ['JP'],
    },
    {
      id: 'gamma',
      prefixes: ['gamma-main'],
      routeTypes: [0],
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
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
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
      name: { name: 'Shared A', names: { en: 'Shared A' } },
      countries: ['JP'],
    },
    {
      id: 'shared',
      prefixes: ['a', 'a', 'b', 'a'],
      routeTypes: [3],
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
      name: { name: 'Shared B', names: { en: 'Shared B' } },
      countries: ['JP'],
    },
  ];
}

beforeEach(() => {
  // DSM no longer touches localStorage directly (since Phase 1) but tests
  // run in jsdom and may inherit state from earlier suites — clear to be
  // safe.
  localStorage.clear();
  setSearch('');
});

afterEach(() => {
  vi.doUnmock('../data-source-settings');
  vi.resetModules();
});

describe('DataSourceManager', () => {
  describe('Constructor', () => {
    it('uses only default-enabled groups when neither URL param nor stored selection is present', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual(['on']);
    });

    it('enables every group including config-default-disabled ones when URL param is `?sources=all`', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      setSearch('sources=all');
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('default-on')).toBe(true);
      expect(manager.isEnabled('default-off')).toBe(true);
      expect(manager.getEnabledDataSources()).toEqual(['on', 'off']);
    });

    it('enables only groups containing the requested prefix when URL param lists prefixes', () => {
      // `minkuru` belongs to the `toei-bus` group only.
      setSearch('sources=minkuru');
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(false);
      expect(manager.isEnabled('yurikamome')).toBe(false);
      expect(manager.isEnabled('vag-freiburg')).toBe(false);
    });

    it('enables a config-default-disabled group when query params explicitly target it', async () => {
      // URL `?sources=` is the operator/debug escape hatch — it
      // bypasses the system gate that the stored-selection path above
      // enforces. Force-loading a `systemEnabledByDefault: false`
      // group via URL is intended behavior (test fixtures, debugging
      // a retired source).
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      setSearch('sources=beta-main');
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(true);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual(['beta-main']);
    });

    it('hydrates the enabled set from the stored selection when no URL param is present', () => {
      const manager = new DataSourceManager(new Set(['toei-bus', 'yurikamome']));
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(true);
      expect(manager.isEnabled('keio-bus')).toBe(false);
    });

    it('drops stored IDs that point to system-disabled groups on boot (system gate)', async () => {
      // A group flipped off in config (`systemEnabledByDefault: false`)
      // must NOT load just because the user's localStorage still has its
      // ID — otherwise retiring a source becomes a no-op for returning
      // users with stale storage. The URL `?sources=` override (see the
      // dedicated test below) is the intentional debug/operator escape
      // hatch and is exempt from this gate.
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager(new Set(['beta']));

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(false);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual([]);
    });

    it('keeps system-enabled stored IDs while dropping system-disabled ones', async () => {
      // Mixed case: the system gate is a per-ID filter, not all-or-
      // nothing. `alpha` (systemEnabledByDefault: true) survives,
      // `beta` (false) is dropped.
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager(new Set(['alpha', 'beta']));

      expect(manager.isEnabled('alpha')).toBe(true);
      expect(manager.isEnabled('beta')).toBe(false);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual(['alpha-local', 'alpha-express']);
    });

    it('replaces the stored selection instead of unioning with it when URL params are present', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      setSearch('sources=beta-main');
      const manager = new DataSourceManager(new Set(['alpha']));

      expect(manager.isEnabled('alpha')).toBe(false);
      expect(manager.isEnabled('beta')).toBe(true);
      expect(manager.isEnabled('gamma')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual(['beta-main']);
    });

    it('treats a no-match URL param as an explicit empty override even when the stored selection has enabled groups', () => {
      setSearch('sources=nonexistent-prefix');
      const manager = new DataSourceManager(new Set(['toei-bus', 'yurikamome']));

      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
      expect(manager.getEnabledDataSources()).toEqual([]);
    });

    it('treats `?sources=` (empty value) as a force-load-empty override and ignores the stored selection', () => {
      // `?sources=` (empty value) is a URL-level explicit "force-load
      // zero sources". DSM must NOT collapse this with "param absent"
      // (= null) via truthy/falsy checks — the load layer in
      // `resolveFetchDataSources` already treats empty as force-empty,
      // and the UI's `isForcedSourcesMode` is true for empty too.
      setSearch('sources=');
      const manager = new DataSourceManager(new Set(['toei-bus']));

      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
      expect(manager.getEnabledDataSources()).toEqual([]);
    });

    it('does not treat an empty `?sources=` value as `all`', async () => {
      // Empty `?sources=` is force-empty, NOT a fallback to defaults.
      // (Pre-Phase-1 DSM collapsed empty into null via `!sourcesParam`
      // and fell through to defaults; that was the bug.)
      const DataSourceManager = await importFreshDataSourceManager(createCustomSettings());
      setSearch('sources=');
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('default-on')).toBe(false);
      expect(manager.isEnabled('default-off')).toBe(false);
      expect(manager.getEnabledDataSources()).toEqual([]);
    });

    it('enables every group whose prefixes match a comma-separated list', () => {
      // `minkuru` → toei-bus, `toaran` → toei-train
      setSearch('sources=minkuru,toaran');
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('trims whitespace around comma-separated prefixes', () => {
      setSearch('sources=minkuru%2C%20toaran'); // "minkuru, toaran"
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(true);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('enables nothing when the requested prefix matches no group', () => {
      setSearch('sources=nonexistent-prefix');
      const manager = new DataSourceManager(null);
      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });

    it('treats `all` as an exact match — `all,minkuru` is parsed as a prefix list', () => {
      // The `all` keyword is honoured only when it is the *entire* param value.
      // Anything else is split on commas and looked up as prefixes, where
      // `all` itself never matches a real GTFS prefix.
      setSearch('sources=all,minkuru');
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('toei-bus')).toBe(true);
      expect(manager.isEnabled('toei-train')).toBe(false);
      expect(manager.isEnabled('yurikamome')).toBe(false);
    });

    it('treats an empty stored Set as "everything disabled" (user-explicit empty, β semantic)', () => {
      const manager = new DataSourceManager(new Set());
      for (const group of settings) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });

    it('treats all groups with the same id as enabled when defaults include that id', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createDuplicateIdSettings());
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('shared')).toBe(true);
      expect(manager.getEnabledDataSources()).toEqual(['c', 'a', 'b']);
    });

    it('treats all groups with the same id as enabled when the stored selection includes that id', async () => {
      // Test target: duplicate-id semantic on the stored-selection path.
      // Fixture keeps `systemEnabledByDefault: true` (so the system gate
      // doesn't filter `'shared'` out) but sets `userEnabledByDefault:
      // false` (so the stored path — NOT defaults — is what's exercised
      // here).
      const groups = createDuplicateIdSettings().map((group) => ({
        ...group,
        userEnabledByDefault: false,
      }));
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager(new Set(['shared']));

      expect(manager.isEnabled('shared')).toBe(true);
      expect(manager.getEnabledDataSources()).toEqual(['c', 'a', 'b']);
    });

    it('treats all groups with the same id as enabled when query param matches one of them', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createDuplicateIdSettings());
      setSearch('sources=b');
      const manager = new DataSourceManager(null);

      expect(manager.isEnabled('shared')).toBe(true);
      // DSM is the *group-driven* view, so the prefix list here is the
      // group expansion (not the URL-level prefix narrowing — that
      // narrowing is `resolveFetchDataSources`'s job, exercised in its
      // own test).
      expect(manager.getEnabledDataSources()).toEqual(['c', 'a', 'b']);
    });
  });

  describe('?sources= unknown-prefix warning', () => {
    // The logger maps `warn` level to `console.warn` (`src/lib/logger.ts:60`)
    // and `warn` always bypasses tag filtering. Spying on `console.warn`
    // therefore observes the logger output without coupling to the
    // logger module's internals.
    //
    // The spy type is derived via a helper to keep generic information
    // (tsconfig.app.json and the test typecheck disagree on how to spell
    // `ReturnType<typeof vi.spyOn<...>>` directly).
    const makeWarnSpy = () =>
      vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress noise in test output; assertions read from mock.calls.
      });
    let warnSpy: ReturnType<typeof makeWarnSpy>;

    beforeEach(() => {
      warnSpy = makeWarnSpy();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    function findUnknownPrefixWarn(): string | undefined {
      return warnSpy.mock.calls
        .map((call: unknown[]) => call.map((arg) => String(arg)).join(' '))
        .find((msg) => msg.includes('Ignored unknown prefixes'));
    }

    it('emits a warn log listing the unknown prefix from `?sources=`', () => {
      setSearch('sources=minkuru,definitely-not-a-real-prefix');
      new DataSourceManager(null);

      const warnMessage = findUnknownPrefixWarn();
      expect(warnMessage).toBeDefined();
      expect(warnMessage).toContain('definitely-not-a-real-prefix');
      // The known prefix should not be flagged as unknown.
      expect(warnMessage).not.toContain('[minkuru');
    });

    it('lists every unknown prefix when multiple are present', () => {
      setSearch('sources=foo,bar,minkuru');
      new DataSourceManager(null);

      const warnMessage = findUnknownPrefixWarn();
      expect(warnMessage).toBeDefined();
      expect(warnMessage).toContain('foo');
      expect(warnMessage).toContain('bar');
    });

    it('does not emit the unknown-prefix warning when `?sources=all`', () => {
      setSearch('sources=all');
      new DataSourceManager(null);

      expect(findUnknownPrefixWarn()).toBeUndefined();
    });

    it('does not emit the unknown-prefix warning when every requested prefix matches a group', () => {
      setSearch('sources=minkuru,toaran');
      new DataSourceManager(null);

      expect(findUnknownPrefixWarn()).toBeUndefined();
    });

    it('does not emit the unknown-prefix warning when `?sources=` is absent', () => {
      // No ?sources= param → DSM does not even reach the warning path.
      new DataSourceManager(null);

      expect(findUnknownPrefixWarn()).toBeUndefined();
    });
  });

  describe('getGroups', () => {
    it('returns every configured source group in definition order', async () => {
      const groups = createMultiPrefixSettings();
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager(null);

      expect(manager.getGroups()).toEqual(groups);
    });

    it('returns groups regardless of their enabled state', async () => {
      const groups = createMultiPrefixSettings();
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager(new Set());

      expect(manager.getGroups()).toEqual(groups);
      for (const group of manager.getGroups()) {
        expect(manager.isEnabled(group.id)).toBe(false);
      }
    });
  });

  describe('isEnabled', () => {
    it('returns true for a default-enabled group', () => {
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('toei-bus')).toBe(true);
    });

    it('returns false for an unknown group id', () => {
      const manager = new DataSourceManager(null);
      expect(manager.isEnabled('this-group-does-not-exist')).toBe(false);
    });

    it('reflects the stored selection passed to the constructor', () => {
      const manager = new DataSourceManager(new Set(['toei-train']));
      expect(manager.isEnabled('toei-train')).toBe(true);
      expect(manager.isEnabled('toei-bus')).toBe(false);
    });
  });

  describe('getEnabledDataSources', () => {
    it('returns prefixes from default-enabled groups in group order', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager(null);

      expect(manager.getEnabledDataSources()).toEqual([
        'alpha-local',
        'alpha-express',
        'gamma-main',
      ]);
    });

    it('returns an empty array when nothing is enabled', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager(new Set());

      expect(manager.getEnabledDataSources()).toEqual([]);
    });

    it('returns prefixes only from explicitly enabled groups when URL param is used', async () => {
      // DSM exposes the *group-driven* view: enabling a group via
      // `?sources=` includes every prefix in that group. The
      // narrower prefix-only contract from PRD.md:118 is enforced by
      // `resolveFetchDataSources`, not by DSM directly — see its tests.
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      setSearch('sources=alpha-express,beta-main');
      const manager = new DataSourceManager(null);

      expect(manager.getEnabledDataSources()).toEqual([
        'alpha-local',
        'alpha-express',
        'beta-main',
      ]);
    });

    it('preserves group definition order instead of stored-selection insertion order', async () => {
      const DataSourceManager = await importFreshDataSourceManager(createMultiPrefixSettings());
      const manager = new DataSourceManager(new Set(['gamma', 'alpha']));

      expect(manager.getEnabledDataSources()).toEqual([
        'alpha-local',
        'alpha-express',
        'gamma-main',
      ]);
    });

    it('deduplicates repeated prefixes before returning load targets', async () => {
      const groups: SourceGroup[] = [
        {
          id: 'default-on',
          prefixes: ['on'],
          routeTypes: [3],
          systemEnabledByDefault: true,
          userEnabledByDefault: true,
          name: { name: 'Default On', names: { en: 'Default On' } },
          countries: ['JP'],
        },
        {
          id: 'default-off',
          prefixes: ['off', 'on'],
          routeTypes: [3],
          systemEnabledByDefault: true,
          userEnabledByDefault: true,
          name: { name: 'Default Off', names: { en: 'Default Off' } },
          countries: ['JP'],
        },
      ];
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager(null);

      expect(manager.getEnabledDataSources()).toEqual(['on', 'off']);
    });

    it('deduplicates repeated prefixes within and across enabled groups', async () => {
      const groups: SourceGroup[] = [
        {
          id: 'default-on',
          prefixes: ['c', 'a'],
          routeTypes: [3],
          systemEnabledByDefault: true,
          userEnabledByDefault: true,
          name: { name: 'Default On', names: { en: 'Default On' } },
          countries: ['JP'],
        },
        {
          id: 'default-off',
          prefixes: ['a', 'a', 'b', 'a'],
          routeTypes: [3],
          systemEnabledByDefault: true,
          userEnabledByDefault: true,
          name: { name: 'Default Off', names: { en: 'Default Off' } },
          countries: ['JP'],
        },
      ];
      const DataSourceManager = await importFreshDataSourceManager(groups);
      const manager = new DataSourceManager(null);

      expect(manager.getEnabledDataSources()).toEqual(['c', 'a', 'b']);
    });
  });
});
