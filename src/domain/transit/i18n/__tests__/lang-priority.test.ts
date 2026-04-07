/**
 * Tests for lang-priority.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { sortLangKeysByPriority } from '../lang-priority';

describe('sortLangKeysByPriority', () => {
  describe('when preferred is empty', () => {
    describe('when keys.length is 0', () => {
      it('returns an empty array', () => {
        expect(sortLangKeysByPriority([], [])).toEqual([]);
      });
    });

    describe('when keys.length is 1', () => {
      it('returns the single key as-is', () => {
        expect(sortLangKeysByPriority(['origin'], [])).toEqual(['origin']);
      });
    });

    describe('when keys.length is 2', () => {
      it('sorts listed keys by LANG_PRIORITY order', () => {
        expect(sortLangKeysByPriority(['ko', 'en'], [])).toEqual(['en', 'ko']);
      });

      it('puts unlisted keys after listed keys', () => {
        expect(sortLangKeysByPriority(['origin', 'en'], [])).toEqual(['en', 'origin']);
      });

      it('preserves original order for unlisted keys with equal priority', () => {
        expect(sortLangKeysByPriority(['zz', 'yy'], [])).toEqual(['zz', 'yy']);
      });
    });

    describe('when keys.length is 3 or more', () => {
      it('sorts listed keys by LANG_PRIORITY and leaves unlisted keys at the end', () => {
        expect(sortLangKeysByPriority(['origin', 'en', 'xx'], [])).toEqual(['en', 'origin', 'xx']);
      });

      it('groups zh variants in LANG_PRIORITY order', () => {
        expect(sortLangKeysByPriority(['zh-Hant', 'en', 'zh-Hans'], [])).toEqual([
          'en',
          'zh-Hans',
          'zh-Hant',
        ]);
      });

      it('preserves relative order among unlisted keys', () => {
        expect(sortLangKeysByPriority(['zz', 'yy', 'xx', 'en'], [])).toEqual([
          'en',
          'zz',
          'yy',
          'xx',
        ]);
      });

      it('does not deduplicate', () => {
        expect(sortLangKeysByPriority(['en', 'en', 'fr'], [])).toEqual(['en', 'en', 'fr']);
      });

      it('matches LANG_PRIORITY case-insensitively', () => {
        expect(sortLangKeysByPriority(['ko', 'ZH-HANS', 'EN', 'fr'], [])).toEqual([
          'EN',
          'fr',
          'ZH-HANS',
          'ko',
        ]);
      });
    });
  });

  describe('when preferred has one element', () => {
    describe('when keys.length is 1', () => {
      it('returns the single exact preferred key as-is', () => {
        expect(sortLangKeysByPriority(['ja'], ['ja'])).toEqual(['ja']);
      });
    });

    describe('when keys.length is 2', () => {
      it('moves the exact preferred key before non-preferred keys', () => {
        expect(sortLangKeysByPriority(['en', 'ja'], ['ja'])).toEqual(['ja', 'en']);
      });

      it('moves a defined preferred variant after the exact match', () => {
        expect(sortLangKeysByPriority(['ja-Hrkt', 'ja'], ['ja'])).toEqual(['ja', 'ja-Hrkt']);
      });
    });

    describe('when keys.length is 3 or more', () => {
      it('puts the preferred exact key first, then preferred defined variants, then remaining keys', () => {
        expect(
          sortLangKeysByPriority(['origin', 'en', 'ja-Hrkt', 'ko', 'ja', 'xx'], ['ja']),
        ).toEqual(['ja', 'ja-Hrkt', 'en', 'ko', 'origin', 'xx']);
      });

      it('puts preferred defined and undefined variants first even when the exact key is absent', () => {
        expect(sortLangKeysByPriority(['en', 'ja-Kana', 'ja-Hrkt', 'fr'], ['ja'])).toEqual([
          'ja-Hrkt',
          'ja-Kana',
          'en',
          'fr',
        ]);
      });

      it('puts undefined preferred variants after defined variants of the same prefix', () => {
        expect(sortLangKeysByPriority(['ja-Kana', 'ja-Hrkt', 'ja', 'en'], ['ja'])).toEqual([
          'ja',
          'ja-Hrkt',
          'ja-Kana',
          'en',
        ]);
      });

      it('preserves original order among undefined preferred variants with equal priority', () => {
        expect(sortLangKeysByPriority(['ja-Latn', 'en', 'ja-Kana', 'ja-Foo'], ['ja'])).toEqual([
          'ja-Latn',
          'ja-Kana',
          'ja-Foo',
          'en',
        ]);
      });

      it('moves the exact preferred key ahead of unrelated listed keys', () => {
        expect(sortLangKeysByPriority(['ko', 'fr', 'ja'], ['ja'])).toEqual(['ja', 'fr', 'ko']);
      });

      it('moves a preferred defined variant ahead of unrelated listed and unlisted keys without an exact match', () => {
        expect(sortLangKeysByPriority(['misc', 'ko', 'ja-Hrkt', 'en'], ['ja'])).toEqual([
          'ja-Hrkt',
          'en',
          'ko',
          'misc',
        ]);
      });

      it('matches preferred variants case-insensitively', () => {
        expect(sortLangKeysByPriority(['en', 'ja-HrKt', 'ko', 'ja'], ['ja'])).toEqual([
          'ja',
          'ja-HrKt',
          'en',
          'ko',
        ]);
      });

      it('matches exact preferred keys case-insensitively', () => {
        expect(sortLangKeysByPriority(['en', 'ja-Hrkt', 'ko'], ['ja-HRKT'])).toEqual([
          'ja-Hrkt',
          'en',
          'ko',
        ]);
      });

      it('does not deduplicate exact preferred matches with different casing', () => {
        expect(sortLangKeysByPriority(['JA', 'en', 'ja'], ['ja'])).toEqual(['JA', 'ja', 'en']);
      });
    });
  });

  describe('when preferred has multiple elements', () => {
    describe('when keys.length is 2', () => {
      it('orders exact preferred keys by preferred array order', () => {
        expect(sortLangKeysByPriority(['ja', 'en'], ['en', 'ja'])).toEqual(['en', 'ja']);
      });
    });

    describe('when keys.length is 3 or more', () => {
      it('uses preferred array order for exact matches before variants', () => {
        expect(
          sortLangKeysByPriority(['ja', 'en', 'ja-Hrkt', 'fr', 'zh-Hans'], ['en', 'ja']),
        ).toEqual(['en', 'ja', 'ja-Hrkt', 'fr', 'zh-Hans']);
      });

      it('keeps defined variants ahead of undefined variants within the same preferred prefix', () => {
        expect(
          sortLangKeysByPriority(['ja-Kana', 'fr', 'ja-Hrkt', 'en', 'ja'], ['en', 'ja']),
        ).toEqual(['en', 'ja', 'ja-Hrkt', 'ja-Kana', 'fr']);
      });

      it('combines exact matches, variants, LANG_PRIORITY, and unlisted keys in one total order', () => {
        expect(
          sortLangKeysByPriority(
            ['origin', 'zh-Hans', 'ja-HRKT', 'fr', 'en', 'ja', 'xx'],
            ['en', 'ja'],
          ),
        ).toEqual(['en', 'ja', 'ja-HRKT', 'fr', 'zh-Hans', 'origin', 'xx']);
      });

      it('preserves original order for exact matches with identical preferred precedence after casing normalization', () => {
        expect(sortLangKeysByPriority(['EN', 'en', 'ja'], ['en', 'ja'])).toEqual([
          'EN',
          'en',
          'ja',
        ]);
      });
    });
  });
});
