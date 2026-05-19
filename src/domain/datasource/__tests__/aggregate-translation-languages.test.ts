import { describe, expect, it } from 'vitest';
import { aggregateTranslationLanguages } from '../aggregate-translation-languages';
import type { DataSourceInfo } from '../../../types/app/data-source-info';

function makeInfo(prefix: string, translationLanguages: readonly string[] | null): DataSourceInfo {
  return {
    prefix,
    feedVersion: null,
    feedValidity: { start: null, end: null },
    servicePeriod: null,
    totalSizeBytes: null,
    maxTripsPerDay: null,
    operatingDates: null,
    boardingStopsCount: null,
    routes: null,
    routeShapes: null,
    translationLanguages,
  };
}

describe('aggregateTranslationLanguages', () => {
  it('returns null for empty input (no prefix has catalog data)', () => {
    expect(aggregateTranslationLanguages([])).toBeNull();
  });

  it('returns null when every entry has translationLanguages === null', () => {
    const result = aggregateTranslationLanguages([makeInfo('a', null), makeInfo('b', null)]);
    expect(result).toBeNull();
  });

  it('returns an empty set when every entry has catalog but no languages', () => {
    const result = aggregateTranslationLanguages([makeInfo('a', []), makeInfo('b', [])]);
    expect(result).toEqual(new Set());
  });

  it('returns the union of languages across entries', () => {
    const result = aggregateTranslationLanguages([
      makeInfo('a', ['ja', 'en']),
      makeInfo('b', ['en', 'zh-Hans']),
    ]);
    expect(result).toEqual(new Set(['ja', 'en', 'zh-Hans']));
  });

  it('deduplicates languages that appear in multiple entries', () => {
    const result = aggregateTranslationLanguages([
      makeInfo('a', ['ja']),
      makeInfo('b', ['ja']),
      makeInfo('c', ['ja']),
    ]);
    expect(result).toEqual(new Set(['ja']));
  });

  it('treats BCP 47 variants as distinct (e.g. ja vs ja-Hrkt)', () => {
    const result = aggregateTranslationLanguages([
      makeInfo('a', ['ja']),
      makeInfo('b', ['ja-Hrkt']),
    ]);
    expect(result).toEqual(new Set(['ja', 'ja-Hrkt']));
  });

  it('treats a single null-catalog entry mixed with a catalog-present entry as catalog-present', () => {
    const result = aggregateTranslationLanguages([makeInfo('a', null), makeInfo('b', ['ja'])]);
    expect(result).toEqual(new Set(['ja']));
  });

  it('returns an empty set (not null) when at least one entry has catalog but empty languages', () => {
    const result = aggregateTranslationLanguages([makeInfo('a', null), makeInfo('b', [])]);
    expect(result).toEqual(new Set());
  });
});
