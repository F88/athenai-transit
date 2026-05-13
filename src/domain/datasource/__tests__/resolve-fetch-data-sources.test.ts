/**
 * Tests for resolve-fetch-data-sources.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { resolveFetchDataSources } from '../resolve-fetch-data-sources';
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

describe('resolveFetchDataSources', () => {
  describe('URL data-source-list path', () => {
    it('returns only the data sources listed in ?sources= (PRD.md:118)', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchDataSources(groups, [], 'minkuru')).toEqual(['minkuru']);
      expect(resolveFetchDataSources(groups, [], 'toaran')).toEqual(['toaran']);
    });

    it('does NOT inflate the load target via an overlapping bundling group', () => {
      // toko bundles ['minkuru', 'toaran']. `?sources=minkuru` must NOT
      // drag toaran into the result just because both share the toko group.
      const groups = createOverlappingGroups();
      // Even if the caller's group-driven fallback would say
      // ['minkuru', 'toaran'], the URL path overrides it.
      expect(resolveFetchDataSources(groups, ['minkuru', 'toaran'], 'minkuru')).toEqual([
        'minkuru',
      ]);
    });

    it('preserves the input order of the requested data sources', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchDataSources(groups, [], 'toaran,minkuru')).toEqual(['toaran', 'minkuru']);
    });

    it('drops unknown data sources silently from the URL path', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchDataSources(groups, [], 'minkuru,does-not-exist')).toEqual(['minkuru']);
    });

    it('returns an empty array when the URL path yields no known data source', () => {
      const groups = createOverlappingGroups();
      expect(resolveFetchDataSources(groups, ['minkuru', 'toaran'], 'no-such-prefix')).toEqual([]);
    });

    it('deduplicates repeated prefixes in ?sources= (regression: double fetch + duplicated merge output)', () => {
      // `?sources=minkuru,minkuru` previously slipped through this
      // resolver unchanged, causing fetchSourcesV2 to load the same
      // bundle twice and mergeSourcesV2 to push duplicate timetable
      // entries / sourceMetas. The group-driven path always deduped via
      // DataSourceManager.getEnabledPrefixes — this direct path must
      // honour the same contract.
      const groups = createOverlappingGroups();
      expect(resolveFetchDataSources(groups, [], 'minkuru,minkuru')).toEqual(['minkuru']);
      expect(resolveFetchDataSources(groups, [], 'toaran,minkuru,toaran')).toEqual([
        'toaran',
        'minkuru',
      ]);
    });
  });

  describe('group-driven fallback path', () => {
    it('returns the fallback data-source list when ?sources= is absent', () => {
      expect(
        resolveFetchDataSources(createOverlappingGroups(), ['minkuru', 'toaran'], null),
      ).toEqual(['minkuru', 'toaran']);
    });

    it('returns the fallback data-source list for ?sources=all (group expansion path)', () => {
      // The `'all'` keyword is intentionally routed through the fallback
      // so the existing behaviour ("enable every group, including those
      // whose default `enabled` flag is `false`") is preserved by the
      // caller's group resolution.
      const fallback = ['minkuru', 'toaran', 'extra'];
      expect(resolveFetchDataSources(createOverlappingGroups(), fallback, 'all')).toEqual(fallback);
    });

    it('returns the fallback verbatim — the resolver does not dedupe or sort it', () => {
      // Deduping is the caller's job (DSM already does so). The resolver
      // returns the fallback as-is so the ordering / dedup semantic is
      // not silently changed at this layer.
      const fallback = ['minkuru', 'minkuru', 'toaran'];
      expect(resolveFetchDataSources(createOverlappingGroups(), fallback, null)).toEqual(fallback);
    });
  });

  it('does not mutate the input arrays', () => {
    const groups = createOverlappingGroups();
    const fallback = ['minkuru', 'toaran'];
    const groupsLen = groups.length;
    const fallbackLen = fallback.length;
    resolveFetchDataSources(groups, fallback, 'minkuru');
    resolveFetchDataSources(groups, fallback, null);
    expect(groups.length).toBe(groupsLen);
    expect(fallback.length).toBe(fallbackLen);
  });
});
