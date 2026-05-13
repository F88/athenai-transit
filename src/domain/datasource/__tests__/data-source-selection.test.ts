/**
 * Tests for data-source-selection.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  findUnknownPrefixesInSourcesParam,
  getDefaultEnabledIds,
  getEnabledDataSourcesFromSourcesParam,
  getEnabledIdsFromSourcesParam,
  getEnabledPrefixesFromGroups,
  parseStoredEnabledIds,
} from '../data-source-selection';
import type { SourceGroup } from '../../../types/app/source-group';

function createGroups(): SourceGroup[] {
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

describe('getDefaultEnabledIds', () => {
  it('returns only groups marked enabled by default', () => {
    expect([...getDefaultEnabledIds(createGroups())]).toEqual(['alpha', 'gamma']);
  });
});

describe('getEnabledIdsFromSourcesParam', () => {
  it('enables every group for the exact all keyword', () => {
    expect([...getEnabledIdsFromSourcesParam(createGroups(), 'all')]).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('enables the whole group when any requested prefix matches it', () => {
    expect([...getEnabledIdsFromSourcesParam(createGroups(), 'alpha-express,beta-main')]).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('trims whitespace around comma-separated prefixes', () => {
    expect([...getEnabledIdsFromSourcesParam(createGroups(), 'alpha-express, beta-main')]).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('returns an empty set when no requested prefix matches any group', () => {
    expect([...getEnabledIdsFromSourcesParam(createGroups(), 'missing')]).toEqual([]);
  });
});

describe('getEnabledDataSourcesFromSourcesParam', () => {
  function createOverlappingGroups(): SourceGroup[] {
    return [
      {
        id: 'toei-bus',
        prefixes: ['minkuru'],
        routeTypes: [3],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
        name: { name: 'Toei Bus', names: { en: 'Toei Bus' } },
        countries: ['JP'],
      },
      {
        id: 'toei-train',
        prefixes: ['toaran'],
        routeTypes: [0, 1, 2],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
        name: { name: 'Toei Train', names: { en: 'Toei Train' } },
        countries: ['JP'],
      },
      {
        id: 'toko',
        prefixes: ['minkuru', 'toaran'],
        routeTypes: [0, 1, 2, 3],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
        name: { name: 'Toei Transport', names: { en: 'Toei Transport' } },
        countries: ['JP'],
      },
    ];
  }

  it('returns the exact prefixes the user requested when they are known', () => {
    expect(getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local,beta-main')).toEqual([
      'alpha-local',
      'beta-main',
    ]);
  });

  it('preserves the input order of the requested prefixes', () => {
    expect(getEnabledDataSourcesFromSourcesParam(createGroups(), 'beta-main,alpha-local')).toEqual([
      'beta-main',
      'alpha-local',
    ]);
  });

  it('drops unknown prefixes silently (callers use findUnknownPrefixesInSourcesParam to surface them)', () => {
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local,nope,beta-main'),
    ).toEqual(['alpha-local', 'beta-main']);
  });

  it('trims whitespace around comma-separated prefixes', () => {
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), ' alpha-local , beta-main '),
    ).toEqual(['alpha-local', 'beta-main']);
  });

  it('returns an empty array when every requested prefix is unknown', () => {
    expect(getEnabledDataSourcesFromSourcesParam(createGroups(), 'foo,bar')).toEqual([]);
  });

  it('"all" expands to every prefix configured across all groups (deduped)', () => {
    expect([...getEnabledDataSourcesFromSourcesParam(createGroups(), 'all')].sort()).toEqual([
      'alpha-express',
      'alpha-local',
      'beta-main',
      'gamma-main',
    ]);
  });

  it('does NOT inflate the load target by walking into other prefixes of bundling groups (regression for PRD.md:118)', () => {
    // toko bundles ['minkuru', 'toaran']. With the older group-id-based
    // path, ?sources=minkuru would enable both toei-bus and toko, and
    // expand back into ['minkuru', 'toaran'] — silently loading toaran
    // even though the user only asked for minkuru. The prefix-centric
    // resolver must return exactly the requested prefix.
    expect(getEnabledDataSourcesFromSourcesParam(createOverlappingGroups(), 'minkuru')).toEqual([
      'minkuru',
    ]);
    expect(getEnabledDataSourcesFromSourcesParam(createOverlappingGroups(), 'toaran')).toEqual([
      'toaran',
    ]);
  });

  it('with the "all" keyword, deduplicates prefixes that overlap across groups', () => {
    // toko shares minkuru with toei-bus and toaran with toei-train.
    const result = getEnabledDataSourcesFromSourcesParam(createOverlappingGroups(), 'all');
    expect([...result].sort()).toEqual(['minkuru', 'toaran']);
  });

  it('deduplicates a prefix that the user repeats in the URL (regression: double-fetch + duplicated timetable/sourceMeta)', () => {
    // Without dedupe, ?sources=minkuru,minkuru reaches fetchSourcesV2
    // as ['minkuru', 'minkuru'], which fetches the same JSON twice,
    // then mergeSourcesV2 push(...groups) duplicates every timetable
    // entry and sourceMetas.push(...) duplicates the source meta row.
    // The group-driven path always deduped via getEnabledPrefixes;
    // the direct prefix path must match that contract.
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local,alpha-local'),
    ).toEqual(['alpha-local']);
    expect(
      getEnabledDataSourcesFromSourcesParam(
        createGroups(),
        'alpha-local,beta-main,alpha-local,beta-main',
      ),
    ).toEqual(['alpha-local', 'beta-main']);
  });

  it('keeps the first occurrence when a prefix is repeated (preserves input order)', () => {
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'beta-main,alpha-local,beta-main'),
    ).toEqual(['beta-main', 'alpha-local']);
  });

  it('treats whitespace-only differences as the same prefix when deduping', () => {
    // After trim, ' alpha-local ' and 'alpha-local' are the same prefix
    // and must collapse — otherwise a URL like
    // `?sources=alpha-local, alpha-local` would still double-fetch.
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local, alpha-local'),
    ).toEqual(['alpha-local']);
  });

  it('handles empty segments without inflating the result', () => {
    // Empty segments from `,,` / leading / trailing commas must not
    // count toward the result, and must not interfere with dedupe of
    // adjacent valid prefixes.
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), ',alpha-local,,alpha-local,'),
    ).toEqual(['alpha-local']);
  });

  it('collapses a prefix repeated more than twice (3+ duplicates)', () => {
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local,alpha-local,alpha-local'),
    ).toEqual(['alpha-local']);
  });

  it('deduplicates around interleaved unknown prefixes', () => {
    // unknown entries are silently dropped (callers use
    // findUnknownPrefixesInSourcesParam to surface them) — the dropped
    // entries must not interfere with dedupe of the known prefix.
    expect(
      getEnabledDataSourcesFromSourcesParam(createGroups(), 'alpha-local,nope,alpha-local'),
    ).toEqual(['alpha-local']);
  });

  it('returns an empty array (not [""]) for an empty sources param', () => {
    expect(getEnabledDataSourcesFromSourcesParam(createGroups(), '')).toEqual([]);
  });
});

describe('findUnknownPrefixesInSourcesParam', () => {
  it('returns an empty array when every requested prefix matches a group', () => {
    expect(findUnknownPrefixesInSourcesParam(createGroups(), 'alpha-local,beta-main')).toEqual([]);
  });

  it('returns the unknown prefixes in the order they appeared', () => {
    expect(
      findUnknownPrefixesInSourcesParam(createGroups(), 'alpha-local,nope,beta-main,zzz'),
    ).toEqual(['nope', 'zzz']);
  });

  it('returns every requested prefix when none match', () => {
    expect(findUnknownPrefixesInSourcesParam(createGroups(), 'missing,absent')).toEqual([
      'missing',
      'absent',
    ]);
  });

  it('trims whitespace around requested prefixes before comparing', () => {
    expect(findUnknownPrefixesInSourcesParam(createGroups(), ' alpha-local , nope ')).toEqual([
      'nope',
    ]);
  });

  it('returns an empty array for sourcesParam === "all"', () => {
    expect(findUnknownPrefixesInSourcesParam(createGroups(), 'all')).toEqual([]);
  });

  it('ignores empty entries from leading/trailing/double commas', () => {
    expect(findUnknownPrefixesInSourcesParam(createGroups(), ',alpha-local,,nope,')).toEqual([
      'nope',
    ]);
  });
});

describe('parseStoredEnabledIds', () => {
  it('returns null when storage is empty', () => {
    expect(parseStoredEnabledIds(null)).toBeNull();
  });

  it('parses stored group IDs into a set', () => {
    expect([...parseStoredEnabledIds('["alpha","gamma"]')!]).toEqual(['alpha', 'gamma']);
  });
});

describe('getEnabledPrefixesFromGroups', () => {
  it('returns all prefixes from enabled groups in group definition order', () => {
    expect(getEnabledPrefixesFromGroups(createGroups(), new Set(['gamma', 'alpha']))).toEqual([
      'alpha-local',
      'alpha-express',
      'gamma-main',
    ]);
  });

  it('returns repeated prefixes when multiple enabled groups contain the same prefix', () => {
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
        systemEnabledByDefault: false,
        userEnabledByDefault: false,
        name: { name: 'Default Off', names: { en: 'Default Off' } },
        countries: ['JP'],
      },
    ];

    expect(getEnabledPrefixesFromGroups(groups, new Set(['default-on', 'default-off']))).toEqual([
      'on',
      'off',
      'on',
    ]);
  });

  it('preserves repeated prefixes within a group as well as across groups', () => {
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

    expect(getEnabledPrefixesFromGroups(groups, new Set(['default-on', 'default-off']))).toEqual([
      'c',
      'a',
      'a',
      'a',
      'b',
      'a',
    ]);
  });
});
