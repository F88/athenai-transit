/**
 * Tests for resolve-translatable-text.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveTranslatableText } from '../resolve-translatable-text';

describe('resolveTranslatableText', () => {
  describe('name + 0 names', () => {
    const text = { name: 'A', names: {} };

    it('lang=en (not found)', () => {
      const actual = resolveTranslatableText(text, 'en');
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(Object.keys(actual.others).length).toBe(0);
    });

    it('lang=origin', () => {
      const actual = resolveTranslatableText(text, 'origin');
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(Object.keys(actual.others).length).toBe(0);
    });
  });

  describe('name + 1 names', () => {
    const text = { name: 'A', names: { en: 'A-en' } };

    it('lang=en (found)', () => {
      const actual = resolveTranslatableText(text, 'en');
      expect(actual.resolved.lang).toBe('en');
      expect(actual.resolved.value).toBe('A-en');
      expect(Object.keys(actual.others).length).toBe(1);
      expect(actual.others['origin']).toBe('A');
    });

    it('lang=ko (not found)', () => {
      const actual = resolveTranslatableText(text, 'ko');
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(Object.keys(actual.others).length).toBe(1);
      expect(actual.others['en']).toBe('A-en');
    });
  });

  describe('name + 2 names', () => {
    const text = { name: 'A', names: { en: 'A-en', de: 'A-de' } };

    it('lang=en', () => {
      const actual = resolveTranslatableText(text, 'en');
      expect(actual.resolved.lang).toBe('en');
      expect(actual.resolved.value).toBe('A-en');
      expect(Object.keys(actual.others).length).toBe(2);
      expect(actual.others['origin']).toBe('A');
      expect(actual.others['de']).toBe('A-de');
    });

    it('lang=de', () => {
      const actual = resolveTranslatableText(text, 'de');
      expect(actual.resolved.lang).toBe('de');
      expect(actual.resolved.value).toBe('A-de');
      expect(Object.keys(actual.others).length).toBe(2);
      expect(actual.others['origin']).toBe('A');
      expect(actual.others['en']).toBe('A-en');
    });

    it('lang=ko (not found)', () => {
      const actual = resolveTranslatableText(text, 'ko');
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(Object.keys(actual.others).length).toBe(2);
      expect(actual.others['en']).toBe('A-en');
      expect(actual.others['de']).toBe('A-de');
    });

    it('others excludes values matching resolved', () => {
      const actual = resolveTranslatableText({ name: 'A', names: { ja: 'A', en: 'A-en' } }, 'ja');
      expect(actual.resolved.value).toBe('A');
      expect(actual.others['ja']).toBeUndefined();
      expect(actual.others['origin']).toBeUndefined(); // same value as resolved
      expect(actual.others['en']).toBe('A-en');
    });

    it('names contains origin key — text.name wins', () => {
      const actual = resolveTranslatableText(
        { name: 'A', names: { origin: 'X', en: 'A-en' } },
        'ko',
      );
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(actual.others['origin']).toBeUndefined();
      expect(actual.others['en']).toBe('A-en');
    });

    it('lang=origin always returns text.name, ignoring names.origin', () => {
      const actual = resolveTranslatableText(
        { name: 'A', names: { origin: 'X', en: 'A-en' } },
        'origin',
      );
      expect(actual.resolved.lang).toBe('origin');
      expect(actual.resolved.value).toBe('A');
      expect(actual.others['origin']).toBeUndefined();
      expect(actual.others['en']).toBe('A-en');
    });

    it('lang=origin deduplicates case-variant keys in others', () => {
      const actual = resolveTranslatableText(
        { name: 'A', names: { 'ja-Hrkt': 'ひらがな', 'ja-HrKt': 'カタカナ', en: 'A-en' } },
        'origin',
      );
      expect(actual.resolved.value).toBe('A');
      // Only one of the case variants should appear in others.
      const hrktKeys = Object.keys(actual.others).filter((k) => k.toLowerCase() === 'ja-hrkt');
      expect(hrktKeys).toHaveLength(1);
      expect(actual.others['en']).toBe('A-en');
    });

    it('keeps all keys with same value', () => {
      const actual = resolveTranslatableText({ name: 'A', names: { en: 'B', fr: 'B' } }, 'ko');
      expect(actual.resolved.value).toBe('A');
      expect(actual.others['en']).toBe('B');
      expect(actual.others['fr']).toBe('B');
    });
  });

  describe('BCP 47 case-insensitive lookup', () => {
    it('lang=ja-Hrkt matches key ja-Hrkt (exact)', () => {
      const text = { name: '渋谷駅', names: { 'ja-Hrkt': 'しぶやえき', en: 'Shibuya Sta.' } };
      const actual = resolveTranslatableText(text, 'ja-Hrkt');
      expect(actual.resolved.lang).toBe('ja-Hrkt');
      expect(actual.resolved.value).toBe('しぶやえき');
    });

    it('lang=ja-Hrkt matches key ja-HrKt (case differs)', () => {
      const text = { name: '渋谷駅', names: { 'ja-HrKt': 'しぶやえき', en: 'Shibuya Sta.' } };
      const actual = resolveTranslatableText(text, 'ja-Hrkt');
      expect(actual.resolved.lang).toBe('ja-Hrkt');
      expect(actual.resolved.value).toBe('しぶやえき');
    });

    it('lang=ja-HrKt matches key ja-Hrkt (reverse case differs)', () => {
      const text = { name: '渋谷駅', names: { 'ja-Hrkt': 'しぶやえき' } };
      const actual = resolveTranslatableText(text, 'ja-HrKt');
      expect(actual.resolved.lang).toBe('ja-HrKt');
      expect(actual.resolved.value).toBe('しぶやえき');
    });

    it('lang=EN matches key en', () => {
      const text = { name: '渋谷駅', names: { en: 'Shibuya Sta.' } };
      const actual = resolveTranslatableText(text, 'EN');
      expect(actual.resolved.lang).toBe('EN');
      expect(actual.resolved.value).toBe('Shibuya Sta.');
    });

    it('lang=ZH-HANS matches key zh-Hans', () => {
      const text = { name: '渋谷駅', names: { 'zh-Hans': '涩谷站' } };
      const actual = resolveTranslatableText(text, 'ZH-HANS');
      expect(actual.resolved.lang).toBe('ZH-HANS');
      expect(actual.resolved.value).toBe('涩谷站');
    });

    it('duplicate keys with different casing: first match wins, duplicate excluded from others', () => {
      // Per BCP 47 (RFC 5646 §2.1.1), subtag comparisons are case-insensitive.
      // If the data contains both "ja-Hrkt" and "ja-HrKt", they refer to the
      // same language. The resolver returns the first match and excludes the
      // duplicate from others to prevent it leaking into subNames.
      const text = {
        name: '渋谷駅',
        names: { 'ja-Hrkt': 'しぶやえき', 'ja-HrKt': 'シブヤエキ', en: 'Shibuya Sta.' },
      };
      const actual = resolveTranslatableText(text, 'ja-Hrkt');
      expect(actual.resolved.lang).toBe('ja-Hrkt');
      expect(actual.resolved.value).toBe('しぶやえき');
      // Duplicate "ja-HrKt" must not appear in others.
      expect(actual.others['ja-HrKt']).toBeUndefined();
      expect(actual.others['ja-Hrkt']).toBeUndefined();
      // Other languages are still present.
      expect(actual.others['en']).toBe('Shibuya Sta.');
      expect(actual.others['origin']).toBe('渋谷駅');
      expect(Object.keys(actual.others)).toHaveLength(2);
    });
  });
});
