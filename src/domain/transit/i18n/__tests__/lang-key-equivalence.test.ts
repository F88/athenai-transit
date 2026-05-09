import { describe, expect, it } from 'vitest';

import { REGION_TO_LANG } from '../../../../config/supported-langs';
import { langKeysEquivalent } from '../lang-key-equivalence';

describe('REGION_TO_LANG (alias map invariants)', () => {
  it('all keys are lowercase', () => {
    // langKeysEquivalent depends on this — callers always lowercase the
    // input before lookup, so an uppercase key in the map would be dead.
    for (const key of Object.keys(REGION_TO_LANG)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('all values are non-empty', () => {
    for (const value of Object.values(REGION_TO_LANG)) {
      expect(value).not.toBe('');
    }
  });
});

describe('langKeysEquivalent', () => {
  describe('identity', () => {
    it('returns true for identical keys', () => {
      expect(langKeysEquivalent('en', 'en')).toBe(true);
      expect(langKeysEquivalent('ja-Hrkt', 'ja-Hrkt')).toBe(true);
    });

    it('returns true for empty strings (degenerate match)', () => {
      expect(langKeysEquivalent('', '')).toBe(true);
    });
  });

  describe('case-insensitive (BCP 47 §2.1.1)', () => {
    it('treats different casings as equivalent', () => {
      expect(langKeysEquivalent('ja-Hrkt', 'ja-HrKt')).toBe(true);
      expect(langKeysEquivalent('JA-HRKT', 'ja-hrkt')).toBe(true);
      expect(langKeysEquivalent('EN', 'en')).toBe(true);
      expect(langKeysEquivalent('Zh-Hans', 'ZH-HANS')).toBe(true);
    });
  });

  describe('Chinese region → script alias', () => {
    it('treats zh-cn and zh-Hans as equivalent', () => {
      expect(langKeysEquivalent('zh-cn', 'zh-Hans')).toBe(true);
      expect(langKeysEquivalent('zh-Hans', 'zh-cn')).toBe(true);
    });

    it('treats zh-CN (uppercase region) and zh-Hans as equivalent', () => {
      expect(langKeysEquivalent('zh-CN', 'zh-Hans')).toBe(true);
    });

    it('treats zh-tw and zh-Hant as equivalent', () => {
      expect(langKeysEquivalent('zh-tw', 'zh-Hant')).toBe(true);
      expect(langKeysEquivalent('zh-Hant', 'zh-tw')).toBe(true);
    });

    it('treats zh-hk and zh-mo as Traditional aliases', () => {
      expect(langKeysEquivalent('zh-hk', 'zh-Hant')).toBe(true);
      expect(langKeysEquivalent('zh-mo', 'zh-Hant')).toBe(true);
    });

    it('treats zh-sg as a Simplified alias', () => {
      expect(langKeysEquivalent('zh-sg', 'zh-Hans')).toBe(true);
    });

    it('treats two region tags pointing at the same script as equivalent', () => {
      // zh-cn and zh-sg both map to zh-Hans.
      expect(langKeysEquivalent('zh-cn', 'zh-sg')).toBe(true);
      // zh-tw / zh-hk / zh-mo all map to zh-Hant.
      expect(langKeysEquivalent('zh-tw', 'zh-hk')).toBe(true);
    });
  });

  describe('non-equivalent variants', () => {
    it('keeps zh-Hans and zh-Hant distinct (different scripts)', () => {
      expect(langKeysEquivalent('zh-Hans', 'zh-Hant')).toBe(false);
    });

    it('keeps zh-cn and zh-tw distinct (different target scripts)', () => {
      expect(langKeysEquivalent('zh-cn', 'zh-tw')).toBe(false);
    });

    it('does NOT alias bare zh to either script', () => {
      // 'zh' alone is genuinely ambiguous; rely on resolveLangChain's
      // parent-prefix expansion instead of aliasing here.
      expect(langKeysEquivalent('zh', 'zh-Hans')).toBe(false);
      expect(langKeysEquivalent('zh', 'zh-Hant')).toBe(false);
      expect(langKeysEquivalent('zh', 'zh-cn')).toBe(false);
    });

    it('rejects unrelated languages', () => {
      expect(langKeysEquivalent('en', 'ja')).toBe(false);
      expect(langKeysEquivalent('ja', 'ko')).toBe(false);
      expect(langKeysEquivalent('zh-Hans', 'ja')).toBe(false);
    });
  });

  describe('unknown codes', () => {
    it('compares case-insensitively without an alias entry', () => {
      expect(langKeysEquivalent('xx-yy', 'XX-YY')).toBe(true);
      expect(langKeysEquivalent('xx-yy', 'xx-zz')).toBe(false);
    });
  });
});
