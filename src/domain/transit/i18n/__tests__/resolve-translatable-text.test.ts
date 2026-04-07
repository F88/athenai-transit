/**
 * Tests for resolve-translatable-text.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveTranslatableText } from '../resolve-translatable-text';

describe('resolveTranslatableText', () => {
  describe('resolves the primary display value', () => {
    it('falls back to origin when translations are missing', () => {
      expect(resolveTranslatableText({ name: 'A', names: {} }, 'en')).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: {},
      });
    });

    it('resolves a direct language match', () => {
      expect(resolveTranslatableText({ name: 'A', names: { en: 'A-en' } }, 'en')).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { origin: 'A' },
      });
    });

    it('falls back to origin when the requested language is missing', () => {
      expect(resolveTranslatableText({ name: 'A', names: { en: 'A-en' } }, 'ko')).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en' },
      });
    });

    it('falls back to origin when lang is an empty array', () => {
      expect(resolveTranslatableText({ name: 'A', names: { en: 'A-en', de: 'A-de' } }, [])).toEqual(
        {
          resolved: { lang: 'origin', value: 'A' },
          others: { en: 'A-en', de: 'A-de' },
        },
      );
    });

    it('falls back to an empty origin value when text.name is empty', () => {
      expect(
        resolveTranslatableText({ name: '', names: { en: 'A-en', de: 'A-de' } }, 'ko'),
      ).toEqual({
        resolved: { lang: 'origin', value: '' },
        others: { en: 'A-en', de: 'A-de' },
      });
    });

    it('resolves an empty-string translation when the key exists', () => {
      expect(resolveTranslatableText({ name: 'A', names: { en: '', de: 'A-de' } }, 'en')).toEqual({
        resolved: { lang: 'en', value: '' },
        others: { de: 'A-de', origin: 'A' },
      });
    });
  });

  describe('builds others from non-resolved entries', () => {
    it('includes remaining translations and origin for a resolved language', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { en: 'A-en', de: 'A-de' } }, 'en'),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('excludes only the resolved language key', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { en: 'A-en', de: 'A-de' } }, 'de'),
      ).toEqual({
        resolved: { lang: 'de', value: 'A-de' },
        others: { en: 'A-en', origin: 'A' },
      });
    });

    it('keeps all translations when resolved falls back to origin', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { en: 'A-en', de: 'A-de' } }, 'ko'),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en', de: 'A-de' },
      });
    });

    it('keeps entries with the same value as resolved', () => {
      expect(resolveTranslatableText({ name: 'A', names: { ja: 'A', en: 'A-en' } }, 'ja')).toEqual({
        resolved: { lang: 'ja', value: 'A' },
        others: { en: 'A-en', origin: 'A' },
      });
    });

    it('keeps duplicate values under different keys', () => {
      expect(resolveTranslatableText({ name: 'A', names: { en: 'B', fr: 'B' } }, 'ko')).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'B', fr: 'B' },
      });
    });

    it('keeps empty-string translations in others', () => {
      expect(
        resolveTranslatableText(
          { name: 'A', names: { en: 'A-en', de: 'A-de', fr: '', FR: 'FR' } },
          'en',
        ),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', fr: '', origin: 'A' },
      });
    });

    it('keeps same-value translations when origin stops the fallback chain', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { en: 'A', de: 'A' } }, ['ko', 'origin', 'en']),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A', de: 'A' },
      });
    });

    it('keeps all non-resolved translations in multilingual data', () => {
      expect(
        resolveTranslatableText(
          {
            name: '曙橋',
            names: {
              ja: '曙橋',
              'ja-Hrkt': 'あけぼのばし',
              en: 'Akebonobashi',
              ko: '아케보노바시',
              'zh-Hans': '曙桥',
            },
          },
          ['ja-Hrkt', 'ja', 'en'],
        ),
      ).toEqual({
        resolved: { lang: 'ja-Hrkt', value: 'あけぼのばし' },
        others: {
          ja: '曙橋',
          en: 'Akebonobashi',
          ko: '아케보노바시',
          'zh-Hans': '曙桥',
          origin: '曙橋',
        },
      });
    });
  });

  describe('handles reserved origin semantics', () => {
    it('resolves origin directly when requested', () => {
      expect(resolveTranslatableText({ name: 'A', names: {} }, 'origin')).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: {},
      });
    });

    it('ignores names.origin when resolved falls back to origin', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { origin: 'X', en: 'A-en' } }, 'ko'),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en' },
      });
    });

    it('uses text.name as others.origin when a non-origin language resolves', () => {
      expect(
        resolveTranslatableText(
          { name: 'A', names: { origin: 'X', en: 'A-en', de: 'A-de' } },
          'en',
        ),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('keeps others.origin even when text.name is empty', () => {
      expect(
        resolveTranslatableText({ name: '', names: { en: 'A-en', de: 'A-de' } }, 'en'),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: '' },
      });
    });

    it('ignores all origin case variants when lang is origin', () => {
      expect(
        resolveTranslatableText(
          {
            name: 'A',
            names: { origin: 'X', ORIGIN: 'A-O', Origin: 'A-o', en: 'A', de: 'A' },
          },
          'origin',
        ),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A', de: 'A' },
      });
    });

    it('does not resolve names.origin for mixed-case ORIGIN', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { origin: 'X', en: 'A-en' } }, 'ORIGIN'),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en' },
      });
    });
  });

  describe('supports case-insensitive lookup', () => {
    it('matches an exact key', () => {
      expect(
        resolveTranslatableText(
          { name: '渋谷駅', names: { 'ja-Hrkt': 'しぶやえき', en: 'Shibuya Sta.' } },
          'ja-Hrkt',
        ),
      ).toEqual({
        resolved: { lang: 'ja-Hrkt', value: 'しぶやえき' },
        others: { en: 'Shibuya Sta.', origin: '渋谷駅' },
      });
    });

    it('matches when the stored key casing differs', () => {
      expect(
        resolveTranslatableText(
          { name: '渋谷駅', names: { 'ja-HrKt': 'しぶやえき', en: 'Shibuya Sta.' } },
          'ja-Hrkt',
        ),
      ).toEqual({
        resolved: { lang: 'ja-Hrkt', value: 'しぶやえき' },
        others: { en: 'Shibuya Sta.', origin: '渋谷駅' },
      });
    });

    it('matches when the requested key casing differs', () => {
      expect(
        resolveTranslatableText({ name: '渋谷駅', names: { 'ja-Hrkt': 'しぶやえき' } }, 'ja-HrKt'),
      ).toEqual({
        resolved: { lang: 'ja-HrKt', value: 'しぶやえき' },
        others: { origin: '渋谷駅' },
      });
    });

    it('matches simple language tags case-insensitively', () => {
      expect(
        resolveTranslatableText({ name: '渋谷駅', names: { en: 'Shibuya Sta.' } }, 'EN'),
      ).toEqual({
        resolved: { lang: 'EN', value: 'Shibuya Sta.' },
        others: { origin: '渋谷駅' },
      });
    });

    it('matches script subtags case-insensitively', () => {
      expect(
        resolveTranslatableText({ name: '渋谷駅', names: { 'zh-Hans': '涩谷站' } }, 'ZH-HANS'),
      ).toEqual({
        resolved: { lang: 'ZH-HANS', value: '涩谷站' },
        others: { origin: '渋谷駅' },
      });
    });
  });

  describe('deduplicates case-variant keys with first-wins semantics', () => {
    it('excludes duplicate case variants from others after a direct match', () => {
      expect(
        resolveTranslatableText(
          {
            name: '渋谷駅',
            names: { 'ja-Hrkt': 'しぶやえき', 'ja-HrKt': 'シブヤエキ', en: 'Shibuya Sta.' },
          },
          'ja-Hrkt',
        ),
      ).toEqual({
        resolved: { lang: 'ja-Hrkt', value: 'しぶやえき' },
        others: { en: 'Shibuya Sta.', origin: '渋谷駅' },
      });
    });

    it('keeps the first case-variant key in others when resolved is origin', () => {
      expect(
        resolveTranslatableText(
          { name: 'A', names: { 'ja-Hrkt': 'ひらがな', 'ja-HrKt': 'カタカナ', en: 'A-en' } },
          'origin',
        ),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { 'ja-Hrkt': 'ひらがな', en: 'A-en' },
      });
    });

    it('keeps the first case-insensitive duplicate key in others', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { ja: 'B', JA: 'C', ko: 'X' } }, [
          'ko',
          'ja',
          'en',
        ]),
      ).toEqual({
        resolved: { lang: 'ko', value: 'X' },
        others: { ja: 'B', origin: 'A' },
      });
    });

    it('uses the first case-insensitive duplicate for resolution even when it is empty', () => {
      expect(
        resolveTranslatableText(
          { name: '', names: { origin: 'X', Origin: 'A-o', en: 'A', de: 'A', fr: '', FR: 'FR' } },
          ['FR'],
        ),
      ).toEqual({
        resolved: { lang: 'FR', value: '' },
        others: { en: 'A', de: 'A', origin: '' },
      });
    });
  });

  describe('supports fallback chains', () => {
    const text = { name: 'A', names: { en: 'A-en', de: 'A-de' } };

    it('resolves the first matching language in the chain', () => {
      expect(resolveTranslatableText(text, ['ko', 'en'])).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('resolves the first matching language case-insensitively', () => {
      expect(resolveTranslatableText(text, ['KO', 'EN'])).toEqual({
        resolved: { lang: 'EN', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('falls back to origin when no chain entry matches', () => {
      expect(resolveTranslatableText(text, ['ko', 'fr'])).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en', de: 'A-de' },
      });
    });

    it('stops at origin when it appears first in the chain', () => {
      expect(resolveTranslatableText(text, ['origin', 'en'])).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en', de: 'A-de' },
      });
    });

    it('stops at origin when it appears in the middle of the chain', () => {
      expect(resolveTranslatableText(text, ['ko', 'origin', 'en'])).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A-en', de: 'A-de' },
      });
    });

    it('ignores origin case variants in names when origin stops the chain', () => {
      expect(
        resolveTranslatableText(
          {
            name: 'A',
            names: { origin: 'X', ORIGIN: 'A-O', Origin: 'A-o', en: 'A', de: 'A' },
          },
          ['ko', 'origin', 'en'],
        ),
      ).toEqual({
        resolved: { lang: 'origin', value: 'A' },
        others: { en: 'A', de: 'A' },
      });
    });

    it('resolves to an empty origin value and omits origin variants when origin stops the chain', () => {
      expect(
        resolveTranslatableText(
          {
            name: '',
            names: { origin: 'X', ORIGIN: 'A-O', Origin: 'A-o', en: 'A', de: 'A' },
          },
          ['ko', 'origin', 'en'],
        ),
      ).toEqual({
        resolved: { lang: 'origin', value: '' },
        others: { en: 'A', de: 'A' },
      });
    });

    it('keeps empty-string translations and empty origin in others after chain resolution', () => {
      expect(
        resolveTranslatableText(
          { name: '', names: { origin: 'X', Origin: 'A-o', en: 'A', de: 'A', fr: '' } },
          ['ko', 'en'],
        ),
      ).toEqual({
        resolved: { lang: 'en', value: 'A' },
        others: { de: 'A', fr: '', origin: '' },
      });
    });

    it('does not treat mixed-case ORIGIN as the reserved stop keyword', () => {
      expect(
        resolveTranslatableText({ name: 'A', names: { origin: 'X', en: 'A-en', de: 'A-de' } }, [
          'ko',
          'ORIGIN',
          'en',
        ]),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('ignores origin case variants in names for mixed-case ORIGIN chain entries', () => {
      expect(
        resolveTranslatableText(
          {
            name: 'A',
            names: { origin: 'X', ORIGIN: 'A-O', Origin: 'A-o', en: 'A-en', de: 'A-de' },
          },
          ['ko', 'ORIGIN', 'en'],
        ),
      ).toEqual({
        resolved: { lang: 'en', value: 'A-en' },
        others: { de: 'A-de', origin: 'A' },
      });
    });

    it('keeps non-resolved chain languages in others', () => {
      expect(resolveTranslatableText(text, ['de', 'en'])).toEqual({
        resolved: { lang: 'de', value: 'A-de' },
        others: { en: 'A-en', origin: 'A' },
      });
    });

    it('uses the first case-insensitive match in chain and excludes duplicate case variants', () => {
      expect(
        resolveTranslatableText(
          {
            name: '渋谷駅',
            names: { 'ja-Hrkt': 'しぶやえき', 'ja-HrKt': 'シブヤエキ', en: 'Shibuya Sta.' },
          },
          ['KO', 'JA-HRKT'],
        ),
      ).toEqual({
        resolved: { lang: 'JA-HRKT', value: 'しぶやえき' },
        others: { en: 'Shibuya Sta.', origin: '渋谷駅' },
      });
    });
  });
});
