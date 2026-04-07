/**
 * Tests for resolve-display-names-with-translatable-text.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveDisplayNamesWithTranslatableText } from '../resolve-display-names-with-translatable-text';

describe('resolveDisplayNamesWithTranslatableText', () => {
  describe('resolves the primary display name', () => {
    it('resolves a direct preferred language', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: 'A-en' } },
          ['en'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A-en',
        subNames: ['A'],
      });
    });

    it('resolves the first matching language in the fallback chain', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: '曙橋',
            names: {
              ja: '曙橋',
              'ja-Hrkt': 'あけぼのばし',
              en: 'Akebonobashi',
            },
          },
          ['ja-Hrkt', 'ja', 'en'],
          ['en'],
        ),
      ).toEqual({
        name: 'あけぼのばし',
        subNames: ['Akebonobashi', '曙橋'],
      });
    });

    it('falls back to origin when no preferred language matches', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: 'A-en', de: 'A-de' } },
          ['ko'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['A-en', 'A-de'],
      });
    });

    it('returns an empty subNames array when there are no remaining values', () => {
      expect(
        resolveDisplayNamesWithTranslatableText({ name: 'A', names: {} }, ['en'], ['ja']),
      ).toEqual({
        name: 'A',
        subNames: [],
      });
    });
  });

  describe('builds subNames for display', () => {
    it('sorts subNames by subNamePriorityLangs before returning them', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: 'A',
            names: {
              ko: 'A-ko',
              'ja-Hrkt': 'A-kana',
              ja: 'A-ja',
              en: 'A-en',
            },
          },
          ['origin'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['A-ja', 'A-kana', 'A-en', 'A-ko'],
      });
    });

    it('deduplicates subNames by value after sorting', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: 'B', fr: 'B', de: 'C' } },
          ['ko'],
          ['fr'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['B', 'C'],
      });
    });

    it('excludes values that match the resolved name', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { ja: 'A', en: 'A-en' } },
          ['ko'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['A-en'],
      });
    });

    it('removes every subName candidate whose value matches the resolved name', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: 'A',
            names: {
              en: 'A',
              fr: 'A',
              de: 'B',
              ja: 'A-ja',
            },
          },
          ['en'],
          ['fr'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['B', 'A-ja'],
      });
    });

    it('returns an empty subNames array when every candidate matches the resolved name', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: 'A',
            names: {
              en: 'A',
              ja: 'A',
            },
          },
          ['en'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A',
        subNames: [],
      });
    });

    it('keeps empty-string subNames when they are distinct from the resolved name', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: 'A-en', fr: '' } },
          ['en'],
          ['fr'],
        ),
      ).toEqual({
        name: 'A-en',
        subNames: ['', 'A'],
      });
    });

    it('removes empty-string subNames when the resolved name is also empty', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: '', fr: '' } },
          ['en'],
          ['fr'],
        ),
      ).toEqual({
        name: '',
        subNames: ['A'],
      });
    });

    it('deduplicates origin against another subName with the same value', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: '曙橋', names: { ja: '曙橋', en: 'Akebonobashi' } },
          ['en'],
          ['ja'],
        ),
      ).toEqual({
        name: 'Akebonobashi',
        subNames: ['曙橋'],
      });
    });

    it('uses sorted key order before deduplication when duplicates exist', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          { name: 'A', names: { en: 'Same', fr: 'Same', ja: 'Other' } },
          ['ko'],
          ['fr'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['Same', 'Other'],
      });
    });

    it('treats data.name as the only origin entry', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: 'A',
            names: {
              origin: 'ignored-origin',
              Origin: 'ignored-Origin',
              en: 'A-en',
            },
          },
          ['en'],
          ['ja'],
        ),
      ).toEqual({
        name: 'A-en',
        subNames: ['A'],
      });
    });

    it('normalizes duplicate language keys case-insensitively before sorting', () => {
      expect(
        resolveDisplayNamesWithTranslatableText(
          {
            name: 'A',
            names: {
              FR: 'first-fr',
              fr: 'later-fr',
              en: 'A-en',
              ja: 'A-ja',
            },
          },
          ['ko'],
          ['fr'],
        ),
      ).toEqual({
        name: 'A',
        subNames: ['first-fr', 'A-en', 'A-ja'],
      });
    });
  });
});
