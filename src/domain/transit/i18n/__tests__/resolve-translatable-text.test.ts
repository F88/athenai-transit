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

    it('keeps all keys with same value', () => {
      const actual = resolveTranslatableText({ name: 'A', names: { en: 'B', fr: 'B' } }, 'ko');
      expect(actual.resolved.value).toBe('A');
      expect(actual.others['en']).toBe('B');
      expect(actual.others['fr']).toBe('B');
    });
  });
});
