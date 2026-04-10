/**
 * Tests for data-source-selection.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  getDefaultEnabledIds,
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
        enabled: true,
        name: { name: 'Default On', names: { en: 'Default On' } },
        countries: ['JP'],
      },
      {
        id: 'default-off',
        prefixes: ['off', 'on'],
        routeTypes: [3],
        enabled: false,
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
