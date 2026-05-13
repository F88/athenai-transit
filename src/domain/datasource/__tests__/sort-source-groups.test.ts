/**
 * Tests for sort-source-groups.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { sortSourceGroupsForDisplay } from '../sort-source-groups';
import type { SourceGroup } from '../../../types/app/source-group';

function makeGroup(overrides: Partial<SourceGroup> & { id: string }): SourceGroup {
  return {
    id: overrides.id,
    prefixes: overrides.prefixes ?? [overrides.id],
    routeTypes: overrides.routeTypes ?? [3],
    enabled: overrides.enabled ?? true,
    name: overrides.name ?? { name: overrides.id, names: { en: overrides.id } },
    countries: overrides.countries ?? ['JP'],
  };
}

describe('sortSourceGroupsForDisplay', () => {
  it('sorts by country code ascending when countries differ', () => {
    const groups = [
      makeGroup({ id: 'jp-a', countries: ['JP'] }),
      makeGroup({ id: 'de-a', countries: ['DE'] }),
      makeGroup({ id: 'it-a', countries: ['IT'] }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id);
    expect(sorted).toEqual(['de-a', 'it-a', 'jp-a']);
  });

  it('uses the first country code when a group is cross-border', () => {
    const groups = [
      makeGroup({ id: 'cross', countries: ['IT', 'DE'] }),
      makeGroup({ id: 'jp-only', countries: ['JP'] }),
      makeGroup({ id: 'de-only', countries: ['DE'] }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id);
    expect(sorted).toEqual(['de-only', 'cross', 'jp-only']);
  });

  it('within the same country, sorts by localized name (en)', () => {
    const groups = [
      makeGroup({
        id: 'beta',
        countries: ['JP'],
        name: { name: 'Beta', names: { en: 'Beta' } },
      }),
      makeGroup({
        id: 'alpha',
        countries: ['JP'],
        name: { name: 'Alpha', names: { en: 'Alpha' } },
      }),
      makeGroup({
        id: 'gamma',
        countries: ['JP'],
        name: { name: 'Gamma', names: { en: 'Gamma' } },
      }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id);
    expect(sorted).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('uses the requested language for name resolution', () => {
    // `en` puts Alpha first; `ja` puts えど (e-do, in hiragana) first
    // because hiragana え < か.
    const groups = [
      makeGroup({
        id: 'kasai',
        countries: ['JP'],
        name: { name: 'Kasai', names: { en: 'Kasai', ja: 'かさい' } },
      }),
      makeGroup({
        id: 'edobus',
        countries: ['JP'],
        name: { name: 'Edobus', names: { en: 'Edobus', ja: 'えどばす' } },
      }),
    ];
    expect(sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id)).toEqual(['edobus', 'kasai']);
    expect(sortSourceGroupsForDisplay(groups, 'ja').map((g) => g.id)).toEqual(['edobus', 'kasai']);
  });

  it('falls back to the canonical name when names[lang] is missing', () => {
    const groups = [
      makeGroup({
        id: 'jp-b',
        countries: ['JP'],
        name: { name: 'Beta', names: {} },
      }),
      makeGroup({
        id: 'jp-a',
        countries: ['JP'],
        name: { name: 'Alpha', names: {} },
      }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'fr').map((g) => g.id);
    expect(sorted).toEqual(['jp-a', 'jp-b']);
  });

  it('places groups with empty countries first (empty string sorts before any letter)', () => {
    const groups = [
      makeGroup({ id: 'jp-a', countries: ['JP'] }),
      makeGroup({ id: 'no-country', countries: [] }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id);
    expect(sorted).toEqual(['no-country', 'jp-a']);
  });

  it('preserves definition order for entries that tie on both keys (sort is stable)', () => {
    const sharedName = { name: 'Same', names: { en: 'Same' } };
    const groups = [
      makeGroup({ id: 'first', countries: ['JP'], name: sharedName }),
      makeGroup({ id: 'second', countries: ['JP'], name: sharedName }),
      makeGroup({ id: 'third', countries: ['JP'], name: sharedName }),
    ];
    const sorted = sortSourceGroupsForDisplay(groups, 'en').map((g) => g.id);
    expect(sorted).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const groups = [
      makeGroup({ id: 'jp-z', countries: ['JP'] }),
      makeGroup({ id: 'de-a', countries: ['DE'] }),
    ];
    const inputIds = groups.map((g) => g.id);
    sortSourceGroupsForDisplay(groups, 'en');
    expect(groups.map((g) => g.id)).toEqual(inputIds);
  });

  it('returns an empty array for an empty input', () => {
    expect(sortSourceGroupsForDisplay([], 'en')).toEqual([]);
  });
});
