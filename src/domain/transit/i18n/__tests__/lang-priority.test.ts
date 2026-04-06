/**
 * Tests for lang-priority.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { sortLangKeysByPriority } from '../lang-priority';

describe('sortLangKeysByPriority', () => {
  describe('preferred langs first', () => {
    it('preferred exact match comes first', () => {
      const actual = sortLangKeysByPriority(['en', 'ja', 'ko'], ['ja']);
      expect(actual[0]).toBe('ja');
    });

    it('preferred variants follow exact match', () => {
      const actual = sortLangKeysByPriority(['en', 'ja-Hrkt', 'ja'], ['ja']);
      expect(actual[0]).toBe('ja');
      expect(actual[1]).toBe('ja-Hrkt');
    });

    it('undefined preferred variant comes after defined variant', () => {
      const actual = sortLangKeysByPriority(['ja-Kana', 'ja-Hrkt', 'ja', 'en'], ['ja']);
      expect(actual[0]).toBe('ja');
      expect(actual[1]).toBe('ja-Hrkt'); // defined in LANG_PRIORITY
      expect(actual[2]).toBe('ja-Kana'); // not in LANG_PRIORITY
      expect(actual[3]).toBe('en');
    });
  });

  describe('LANG_PRIORITY order', () => {
    it('sorts by international priority', () => {
      const actual = sortLangKeysByPriority(['ko', 'de', 'en', 'fr'], []);
      expect(actual).toEqual(['en', 'fr', 'de', 'ko']);
    });

    it('zh variants are grouped', () => {
      const actual = sortLangKeysByPriority(['zh-Hant', 'en', 'zh-Hans'], []);
      expect(actual).toEqual(['en', 'zh-Hans', 'zh-Hant']);
    });
  });

  describe('unlisted keys', () => {
    it('unlisted keys come after listed keys', () => {
      const actual = sortLangKeysByPriority(['origin', 'en', 'xx'], []);
      expect(actual[0]).toBe('en');
      expect(actual[1]).toBe('origin');
      expect(actual[2]).toBe('xx');
    });

    it('unlisted keys preserve original relative order', () => {
      const actual = sortLangKeysByPriority(['zz', 'yy', 'xx', 'en'], []);
      expect(actual[0]).toBe('en');
      expect(actual[1]).toBe('zz');
      expect(actual[2]).toBe('yy');
      expect(actual[3]).toBe('xx');
    });
  });

  describe('combined', () => {
    it('preferred + LANG_PRIORITY + unlisted', () => {
      const actual = sortLangKeysByPriority(['origin', 'en', 'ja-Hrkt', 'ko', 'ja', 'xx'], ['ja']);
      expect(actual[0]).toBe('ja'); // preferred exact
      expect(actual[1]).toBe('ja-Hrkt'); // preferred variant (defined)
      expect(actual[2]).toBe('en'); // LANG_PRIORITY
      expect(actual[3]).toBe('ko'); // LANG_PRIORITY
      expect(actual[4]).toBe('origin'); // unlisted
      expect(actual[5]).toBe('xx'); // unlisted
      expect(actual.length).toBe(6);
    });
  });

  describe('edge cases', () => {
    it('empty input', () => {
      expect(sortLangKeysByPriority([], ['ja'])).toEqual([]);
    });

    it('empty preferred', () => {
      const actual = sortLangKeysByPriority(['ko', 'en'], []);
      expect(actual).toEqual(['en', 'ko']);
    });

    it('does not deduplicate', () => {
      const actual = sortLangKeysByPriority(['en', 'en'], []);
      expect(actual).toEqual(['en', 'en']);
    });
  });

  describe('BCP 47 case-insensitive', () => {
    it('ja-HrKt is treated as ja variant when preferred is ja', () => {
      const actual = sortLangKeysByPriority(['en', 'ja-HrKt', 'ko', 'ja'], ['ja']);
      expect(actual).toEqual(['ja', 'ja-HrKt', 'en', 'ko']);
    });

    it('preferred with different casing matches exact', () => {
      const actual = sortLangKeysByPriority(['en', 'ja-Hrkt', 'ko'], ['ja-HRKT']);
      expect(actual[0]).toBe('ja-Hrkt');
    });

    it('ZH-HANS is sorted by LANG_PRIORITY position', () => {
      const actual = sortLangKeysByPriority(['ko', 'ZH-HANS', 'en'], []);
      expect(actual).toEqual(['en', 'ZH-HANS', 'ko']);
    });

    it('EN matches en in LANG_PRIORITY', () => {
      const actual = sortLangKeysByPriority(['ko', 'EN', 'fr'], []);
      expect(actual).toEqual(['EN', 'fr', 'ko']);
    });
  });
});
