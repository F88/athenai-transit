import { describe, expect, it } from 'vitest';
import { toTranslationCoverageLevel } from '../translation-coverage-level';

describe('toTranslationCoverageLevel', () => {
  it('returns level 1 for an empty set', () => {
    expect(toTranslationCoverageLevel(new Set())).toBe(1);
  });

  it('returns level 1 when there is only one raw language tag', () => {
    expect(toTranslationCoverageLevel(new Set(['ja']))).toBe(1);
    expect(toTranslationCoverageLevel(new Set(['ja-Hrkt']))).toBe(1);
    expect(toTranslationCoverageLevel(new Set(['de']))).toBe(1);
  });

  it('collapses primary languages case-insensitively', () => {
    expect(toTranslationCoverageLevel(new Set(['JA']))).toBe(1);
    expect(toTranslationCoverageLevel(new Set(['Ja-HrKt']))).toBe(1);
    expect(toTranslationCoverageLevel(new Set(['EN-us']))).toBe(1);
  });

  it('returns at least level 2 when multiple raw tags collapse to one primary language', () => {
    expect(toTranslationCoverageLevel(new Set(['ja', 'ja-Hrkt']))).toBe(2);
    expect(toTranslationCoverageLevel(new Set(['ja', 'ja-HRKT']))).toBe(2);
    expect(toTranslationCoverageLevel(new Set(['ja_JP', 'JA-Hrkt']))).toBe(2);
  });

  it('returns level 3 for two primary languages', () => {
    expect(toTranslationCoverageLevel(new Set(['en', 'ja']))).toBe(3);
    expect(toTranslationCoverageLevel(new Set(['ja', 'ko']))).toBe(3);
    expect(toTranslationCoverageLevel(new Set(['en-US', 'JA-HrKT']))).toBe(3);
  });

  it('returns level 4 for three primary languages', () => {
    expect(toTranslationCoverageLevel(new Set(['en', 'ja', 'zh-Hans']))).toBe(4);
    expect(toTranslationCoverageLevel(new Set(['EN-us', 'JA-Hrkt', 'ZH-tw']))).toBe(4);
  });

  it('keeps four to nine primary languages at level 4', () => {
    expect(toTranslationCoverageLevel(new Set(['en', 'ja', 'ko', 'zh-Hans']))).toBe(4);
    expect(
      toTranslationCoverageLevel(new Set(['en', 'ja', 'ko', 'zh-Hans', 'de', 'fr', 'es', 'it'])),
    ).toBe(4);
  });

  it('returns level 5 for ten or more primary languages', () => {
    expect(
      toTranslationCoverageLevel(
        new Set(['en', 'ja', 'ko', 'zh-Hans', 'de', 'fr', 'es', 'it', 'pt', 'ru']),
      ),
    ).toBe(5);
    expect(
      toTranslationCoverageLevel(
        new Set(['en', 'ja', 'ko', 'zh-Hans', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar']),
      ),
    ).toBe(5);
  });

  it('treats underscore variants as the same primary language', () => {
    expect(toTranslationCoverageLevel(new Set(['ja_JP']))).toBe(1);
  });
});
