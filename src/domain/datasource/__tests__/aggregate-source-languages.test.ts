import { describe, expect, it } from 'vitest';
import { aggregateLanguages } from '../aggregate-source-languages';
import type { DataSourceInfo } from '../data-source-info';

function makeInfo(prefix: string, translationLanguages: readonly string[]): DataSourceInfo {
  return {
    prefix,
    feedVersion: null,
    feedValidity: { start: null, end: null },
    servicePeriod: null,
    totalSizeBytes: null,
    maxTripsPerDay: null,
    boardingStopsCount: null,
    shapesAvailable: false,
    translationLanguages,
  };
}

describe('aggregateLanguages', () => {
  it('returns an empty set for empty input', () => {
    expect(aggregateLanguages([])).toEqual(new Set());
  });

  it('returns an empty set when every entry has no languages', () => {
    const result = aggregateLanguages([makeInfo('a', []), makeInfo('b', [])]);
    expect(result).toEqual(new Set());
  });

  it('returns the union of languages across entries', () => {
    const result = aggregateLanguages([
      makeInfo('a', ['ja', 'en']),
      makeInfo('b', ['en', 'zh-Hans']),
    ]);
    expect(result).toEqual(new Set(['ja', 'en', 'zh-Hans']));
  });

  it('deduplicates languages that appear in multiple entries', () => {
    const result = aggregateLanguages([
      makeInfo('a', ['ja']),
      makeInfo('b', ['ja']),
      makeInfo('c', ['ja']),
    ]);
    expect(result).toEqual(new Set(['ja']));
  });

  it('treats BCP 47 variants as distinct (e.g. ja vs ja-Hrkt)', () => {
    const result = aggregateLanguages([makeInfo('a', ['ja']), makeInfo('b', ['ja-Hrkt'])]);
    expect(result).toEqual(new Set(['ja', 'ja-Hrkt']));
  });
});
