/**
 * Tests for build-names-by-lang-priority.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { buildNamesByLangPriority } from '../build-names-by-lang-priority';

describe('buildNamesByLangPriority', () => {
  it('returns origin when there are no translated names', () => {
    expect(buildNamesByLangPriority({ origin: 'A' }, ['ja'])).toEqual(['A']);
  });

  it('sorts names by priorityLangs', () => {
    expect(
      buildNamesByLangPriority(
        {
          origin: 'A',
          ko: 'A-ko',
          'ja-Hrkt': 'A-kana',
          ja: 'A-ja',
          en: 'A-en',
        },
        ['ja'],
      ),
    ).toEqual(['A-ja', 'A-kana', 'A-en', 'A-ko', 'A']);
  });

  it('keeps origin as just another keyed entry', () => {
    expect(
      buildNamesByLangPriority(
        {
          en: 'A-en',
          origin: 'A',
        },
        ['ja'],
      ),
    ).toEqual(['A-en', 'A']);
  });

  it('preserves distinct values even when keys differ only by case', () => {
    expect(
      buildNamesByLangPriority(
        {
          FR: 'first-fr',
          fr: 'later-fr',
          en: 'A-en',
          ja: 'A-ja',
          origin: 'A',
        },
        ['fr'],
      ),
    ).toEqual(['first-fr', 'later-fr', 'A-en', 'A-ja', 'A']);
  });

  it('deduplicates by value after sorting', () => {
    expect(
      buildNamesByLangPriority(
        {
          en: 'Same',
          fr: 'Same',
          ja: 'Other',
          origin: 'A',
        },
        ['fr'],
      ),
    ).toEqual(['Same', 'Other', 'A']);
  });

  it('deduplicates origin against another entry with the same value', () => {
    expect(
      buildNamesByLangPriority(
        {
          ja: 'A',
          en: 'A-en',
          origin: 'A',
        },
        ['ja'],
      ),
    ).toEqual(['A', 'A-en']);
  });

  it('deduplicates origin against another entry with the same value after sorting by priority', () => {
    expect(
      buildNamesByLangPriority(
        {
          ja: 'A',
          origin: 'A',
          en: 'A-en',
        },
        ['en'],
      ),
    ).toEqual(['A-en', 'A']);
  });

  it('treats origin as an exact preferred key when priorityLangs explicitly includes it', () => {
    expect(
      buildNamesByLangPriority(
        {
          ja: '亜',
          origin: 'A',
          en: 'A-en',
          'ja-HRKT': 'あ',
        },
        ['en', 'origin'],
      ),
    ).toEqual(['A-en', 'A', '亜', 'あ']);
  });

  it('preserves empty-string values and deduplicates them by value', () => {
    expect(
      buildNamesByLangPriority(
        {
          fr: '',
          en: '',
          ja: 'A-ja',
          origin: 'A',
        },
        ['fr'],
      ),
    ).toEqual(['', 'A-ja', 'A']);
  });

  it('keeps values that may later match the primary name', () => {
    expect(
      buildNamesByLangPriority(
        {
          ja: 'A',
          en: 'A-en',
          origin: 'A',
        },
        ['ja'],
      ),
    ).toEqual(['A', 'A-en']);
  });
});
