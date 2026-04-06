import { describe, expect, it } from 'vitest';
import type { SupportedLang } from '../../../../config/supported-langs';
import { SUPPORTED_LANG_CODES, SUPPORTED_LANGS } from '../../../../config/supported-langs';
import { resolveLangChain } from '../resolve-lang-chain';

describe('resolveLangChain (SUPPORTED_LANGS)', () => {
  it('en has no fallback (terminal)', () => {
    expect(resolveLangChain('en', SUPPORTED_LANGS)).toEqual(['en']);
  });

  it('ja falls back to en', () => {
    expect(resolveLangChain('ja', SUPPORTED_LANGS)).toEqual(['ja', 'en']);
  });

  it('ja-Hrkt falls back to ja then en', () => {
    expect(resolveLangChain('ja-Hrkt', SUPPORTED_LANGS)).toEqual(['ja-Hrkt', 'ja', 'en']);
  });

  it('zh-Hant falls back to zh-Hans then en', () => {
    expect(resolveLangChain('zh-Hant', SUPPORTED_LANGS)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
  });

  it('zh-Hans falls back to en', () => {
    expect(resolveLangChain('zh-Hans', SUPPORTED_LANGS)).toEqual(['zh-Hans', 'en']);
  });

  it('ko falls back to en', () => {
    expect(resolveLangChain('ko', SUPPORTED_LANGS)).toEqual(['ko', 'en']);
  });

  it('de falls back to en', () => {
    expect(resolveLangChain('de', SUPPORTED_LANGS)).toEqual(['de', 'en']);
  });

  it('unknown lang returns single-element chain', () => {
    expect(resolveLangChain('pt', SUPPORTED_LANGS)).toEqual(['pt']);
  });

  it('all supported langs produce non-empty chains', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      const chain = resolveLangChain(code, SUPPORTED_LANGS);
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0]).toBe(code);
    }
  });
});

describe('resolveLangChain (custom langs)', () => {
  const custom: SupportedLang[] = [
    { code: 'a', label: 'A', shortLabel: 'A', fallback: 'b' },
    { code: 'b', label: 'B', shortLabel: 'B', fallback: 'c' },
    { code: 'c', label: 'C', shortLabel: 'C' },
  ];

  it('chains through multiple fallbacks', () => {
    expect(resolveLangChain('a', custom)).toEqual(['a', 'b', 'c']);
  });

  it('starts mid-chain', () => {
    expect(resolveLangChain('b', custom)).toEqual(['b', 'c']);
  });

  it('terminal has no fallback', () => {
    expect(resolveLangChain('c', custom)).toEqual(['c']);
  });

  it('unknown lang in custom list returns single element', () => {
    expect(resolveLangChain('x', custom)).toEqual(['x']);
  });

  it('case-insensitive: ZH-HANT canonicalized to zh-Hant', () => {
    const langs: SupportedLang[] = [
      { code: 'zh-Hant', label: '', shortLabel: '', fallback: 'zh-Hans' },
      { code: 'zh-Hans', label: '', shortLabel: '', fallback: 'en' },
      { code: 'en', label: '', shortLabel: '' },
    ];
    expect(resolveLangChain('ZH-HANT', langs)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
  });

  it('case-insensitive: ja-HrKt canonicalized to ja-Hrkt', () => {
    const langs: SupportedLang[] = [
      { code: 'ja-Hrkt', label: '', shortLabel: '', fallback: 'ja' },
      { code: 'ja', label: '', shortLabel: '', fallback: 'en' },
      { code: 'en', label: '', shortLabel: '' },
    ];
    expect(resolveLangChain('ja-HrKt', langs)).toEqual(['ja-Hrkt', 'ja', 'en']);
  });

  it('detects circular fallback and stops', () => {
    const circular: SupportedLang[] = [
      { code: 'x', label: 'X', shortLabel: 'X', fallback: 'y' },
      { code: 'y', label: 'Y', shortLabel: 'Y', fallback: 'x' },
    ];
    expect(resolveLangChain('x', circular)).toEqual(['x', 'y']);
  });
});
