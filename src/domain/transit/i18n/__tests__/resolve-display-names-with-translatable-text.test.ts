/**
 * Tests for resolve-display-names-with-translatable-text.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveDisplayNamesWithTranslatableText } from '../resolve-display-names-with-translatable-text';

describe('resolveDisplayNamesWithTranslatableText', () => {
  describe('name + 0 names', () => {
    const text = { name: 'A', names: {} };

    it('lang=en (not found)', () => {
      const actual = resolveDisplayNamesWithTranslatableText(text, 'en', ['ja']);
      expect(actual.name).toBe('A');
      expect(actual.subNames.length).toBe(0);
    });
  });

  describe('name + 1 names', () => {
    const text = { name: 'A', names: { en: 'A-en' } };

    it('lang=en (found)', () => {
      const actual = resolveDisplayNamesWithTranslatableText(text, 'en', ['ja']);
      expect(actual.name).toBe('A-en');
      expect(actual.subNames.length).toBe(1);
      expect(actual.subNames[0]).toBe('A');
    });

    it('lang=ko (not found)', () => {
      const actual = resolveDisplayNamesWithTranslatableText(text, 'ko', ['ja']);
      expect(actual.name).toBe('A');
      expect(actual.subNames.length).toBe(1);
      expect(actual.subNames[0]).toBe('A-en');
    });
  });

  describe('name + 2 names', () => {
    const text = { name: 'A', names: { en: 'A-en', de: 'A-de' } };

    it('lang=en', () => {
      const actual = resolveDisplayNamesWithTranslatableText(text, 'en', ['ja']);
      expect(actual.name).toBe('A-en');
      expect(actual.subNames.length).toBe(2);
      expect(actual.subNames).toContain('A');
      expect(actual.subNames).toContain('A-de');
    });

    it('lang=ko (not found)', () => {
      const actual = resolveDisplayNamesWithTranslatableText(text, 'ko', ['ja']);
      expect(actual.name).toBe('A');
      expect(actual.subNames.length).toBe(2);
      expect(actual.subNames).toContain('A-en');
      expect(actual.subNames).toContain('A-de');
    });

    it('deduplicates subNames by value', () => {
      const actual = resolveDisplayNamesWithTranslatableText(
        { name: 'A', names: { en: 'B', fr: 'B' } },
        'ko',
        ['ja'],
      );
      expect(actual.name).toBe('A');
      expect(actual.subNames.length).toBe(1);
      expect(actual.subNames[0]).toBe('B');
    });
  });
});
