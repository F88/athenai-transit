/**
 * Tests for inject-origin-lang.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { injectOriginLang } from '../inject-origin-lang';

describe('injectOriginLang', () => {
  describe('injects base value when originLang key is missing', () => {
    it('injects when names has no matching key', () => {
      const result = injectOriginLang({ en: 'AEON ST' }, 'イオンST', 'ja');
      expect(result).toEqual({ ja: 'イオンST', en: 'AEON ST' });
    });

    it('injects for non-Japanese originLang', () => {
      const result = injectOriginLang({ ja: '東京駅' }, 'Tokyo Sta.', 'en');
      expect(result).toEqual({ en: 'Tokyo Sta.', ja: '東京駅' });
    });

    it('injects even when baseValue is empty', () => {
      // Empty base values are valid in GTFS
      const result = injectOriginLang({ en: 'eng' }, '', 'ja');
      expect(result).toEqual({ ja: '', en: 'eng' });
    });

    it('injects when names is empty', () => {
      const result = injectOriginLang({}, '曙橋', 'ja');
      expect(result).toEqual({ ja: '曙橋' });
    });
  });

  describe('preserves explicit translations', () => {
    it('does not overwrite when names already has the key', () => {
      const result = injectOriginLang(
        { ja: '池袋サンシャインシティ', en: 'Ikebukuro Sunshine City' },
        '池袋SC',
        'ja',
      );
      expect(result).toEqual({ ja: '池袋サンシャインシティ', en: 'Ikebukuro Sunshine City' });
    });

    it('returns the original object reference when no injection needed', () => {
      const names = { ja: 'explicit-ja', en: 'eng' };
      const result = injectOriginLang(names, 'base', 'ja');
      expect(result).toBe(names);
    });
  });

  describe('skips injection for undefined/empty/mul', () => {
    it('skips when originLang is undefined', () => {
      const names = { en: 'eng' };
      const result = injectOriginLang(names, 'base', undefined);
      expect(result).toBe(names);
    });

    it('skips when originLang is empty string', () => {
      const names = { en: 'eng' };
      const result = injectOriginLang(names, 'base', '');
      expect(result).toBe(names);
    });

    it('skips when originLang is "mul" (multilingual)', () => {
      // GTFS "mul" means base values are in mixed languages;
      // translations.txt is expected to provide explicit entries.
      const names = { de: 'Genf', it: 'Ginevra' };
      const result = injectOriginLang(names, 'Genève', 'mul');
      expect(result).toBe(names);
    });

    it('skips when originLang is "MUL" (case-insensitive)', () => {
      const names = { de: 'Genf' };
      const result = injectOriginLang(names, 'Genève', 'MUL');
      expect(result).toBe(names);
    });

    it('skips when originLang is "Mul" (mixed case)', () => {
      const names = { de: 'Genf' };
      const result = injectOriginLang(names, 'Genève', 'Mul');
      expect(result).toBe(names);
    });
  });

  describe('case-insensitive key matching', () => {
    it('does not inject when names has uppercase variant of originLang', () => {
      const names = { JA: 'explicit-JA', en: 'eng' };
      const result = injectOriginLang(names, 'base', 'ja');
      expect(result).toBe(names);
    });

    it('does not inject when originLang is uppercase and names has lowercase key', () => {
      const names = { ja: 'explicit-ja', en: 'eng' };
      const result = injectOriginLang(names, 'base', 'JA');
      expect(result).toBe(names);
    });

    it('does not inject when names has mixed-case subtag variant', () => {
      const names = { 'ja-Hrkt': 'ひらがな', en: 'eng' };
      const result = injectOriginLang(names, 'base', 'ja-hrkt');
      expect(result).toBe(names);
    });
  });

  describe('real-world scenarios', () => {
    it('Seibu Bus: Japanese base with English-only translation', () => {
      // feed_lang="ja", base is Japanese, translations.txt has only en
      const result = injectOriginLang(
        { en: 'AEON ST (Higashi-Kurume circular bus)' },
        'イオンＳＴ（東久留米循環線）',
        'ja',
      );
      expect(result).toEqual({
        ja: 'イオンＳＴ（東久留米循環線）',
        en: 'AEON ST (Higashi-Kurume circular bus)',
      });
    });

    it('Toei Bus: Japanese base with explicit ja + en translations', () => {
      // feed_lang="ja", translations.txt has both ja and en — no injection
      const names = {
        ja: '池袋サンシャインシティ',
        'ja-Hrkt': 'いけぶくろさんしゃいんしてぃ',
        en: 'Ikebukuro Sunshine City',
      };
      const result = injectOriginLang(names, '池袋サンシャインシティ', 'ja');
      expect(result).toBe(names);
    });

    it('multilingual feed: base in mixed language, no injection', () => {
      // feed_lang="mul", translations.txt expected to provide all languages
      const names = { de: 'Genf', it: 'Ginevra', fr: 'Genève' };
      const result = injectOriginLang(names, 'Genève', 'mul');
      expect(result).toBe(names);
    });

    it('Italian operator: Italian base with no Italian translation key', () => {
      // feed_lang="IT" (ACTV Venice), base is Italian
      const result = injectOriginLang({ en: 'Venice' }, 'Venezia', 'IT');
      expect(result).toEqual({ IT: 'Venezia', en: 'Venice' });
    });

    it('German operator: German base with no German translation key', () => {
      // feed_lang="DE" (VAG Freiburg), base is German
      const result = injectOriginLang({}, 'Bertoldsbrunnen', 'DE');
      expect(result).toEqual({ DE: 'Bertoldsbrunnen' });
    });
  });
});
