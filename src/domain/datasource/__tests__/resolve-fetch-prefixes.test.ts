/**
 * Tests for resolve-fetch-prefixes.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { resolveFetchPrefixes } from '../resolve-fetch-prefixes';
import type { SourceGroup } from '../../../types/app/source-group';

function createOverlappingGroups(): SourceGroup[] {
  return [
    {
      id: 'toei-bus',
      prefixes: ['minkuru'],
      routeTypes: [3],
      enabled: true,
      name: { name: 'Toei Bus', names: { en: 'Toei Bus' } },
      countries: ['JP'],
    },
    {
      id: 'toei-train',
      prefixes: ['toaran'],
      routeTypes: [0, 1, 2],
      enabled: true,
      name: { name: 'Toei Train', names: { en: 'Toei Train' } },
      countries: ['JP'],
    },
    {
      id: 'toko',
      prefixes: ['minkuru', 'toaran'],
      routeTypes: [0, 1, 2, 3],
      enabled: true,
      name: { name: 'Toei Transport', names: { en: 'Toei Transport' } },
      countries: ['JP'],
    },
  ];
}

describe('resolveFetchPrefixes', () => {
  describe('URL prefix-list path', () => {
    it('returns only the prefixes listed in ?sources= (PRD.md:118)', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchPrefixes(groups, [], 'minkuru')).toEqual(['minkuru']);
      expect(resolveFetchPrefixes(groups, [], 'toaran')).toEqual(['toaran']);
    });

    it('does NOT inflate the load target via an overlapping bundling group', () => {
      // toko bundles ['minkuru', 'toaran']. `?sources=minkuru` must NOT
      // drag toaran into the result just because both share the toko group.
      const groups = createOverlappingGroups();
      // Even if the caller's group-driven fallback would say
      // ['minkuru', 'toaran'], the URL path overrides it.
      expect(resolveFetchPrefixes(groups, ['minkuru', 'toaran'], 'minkuru')).toEqual(['minkuru']);
    });

    it('preserves the input order of the requested prefixes', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchPrefixes(groups, [], 'toaran,minkuru')).toEqual(['toaran', 'minkuru']);
    });

    it('drops unknown prefixes silently from the URL path', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchPrefixes(groups, [], 'minkuru,does-not-exist')).toEqual(['minkuru']);
    });

    it('returns an empty array when the URL path yields no known prefix', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchPrefixes(groups, ['minkuru', 'toaran'], 'no-such-prefix')).toEqual([]);
    });
  });

  describe('group-driven fallback path', () => {
    it('returns the fallback prefix list when ?sources= is absent', () => {
      expect(resolveFetchPrefixes(createOverlappingGroups(), ['minkuru', 'toaran'], null)).toEqual([
        'minkuru',
        'toaran',
      ]);
    });

    it('returns the fallback prefix list for ?sources=all (group expansion path)', () => {
      // The `'all'` keyword is intentionally routed through the fallback
      // so the existing behaviour ("enable every group, including those
      // whose default `enabled` flag is `false`") is preserved by the
      // caller's group resolution.
      const fallback = ['minkuru', 'toaran', 'extra'];
      expect(resolveFetchPrefixes(createOverlappingGroups(), fallback, 'all')).toEqual(fallback);
    });

    it('returns the fallback verbatim — the resolver does not dedupe or sort it', () => {
      // Deduping is the caller's job (DSM already does so). The resolver
      // returns the fallback as-is so the ordering / dedup semantic is
      // not silently changed at this layer.
      const fallback = ['minkuru', 'minkuru', 'toaran'];
      expect(resolveFetchPrefixes(createOverlappingGroups(), fallback, null)).toEqual(fallback);
    });
  });

  it('does not mutate the input arrays', () => {
    const groups = createOverlappingGroups();
    const fallback = ['minkuru', 'toaran'];
    const groupsLen = groups.length;
    const fallbackLen = fallback.length;
    resolveFetchPrefixes(groups, fallback, 'minkuru');
    resolveFetchPrefixes(groups, fallback, null);
    expect(groups.length).toBe(groupsLen);
    expect(fallback.length).toBe(fallbackLen);
  });
});
