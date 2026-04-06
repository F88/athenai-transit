import { describe, expect, it } from 'vitest';
import { normalizeLang } from '../supported-langs';

describe('normalizeLang', () => {
  it('returns supported code as-is', () => {
    expect(normalizeLang('ja')).toBe('ja');
    expect(normalizeLang('en')).toBe('en');
    expect(normalizeLang('zh-Hans')).toBe('zh-Hans');
  });

  it('returns default for unsupported code', () => {
    expect(normalizeLang('pt')).toBe('ja');
    expect(normalizeLang('not-a-lang')).toBe('ja');
  });

  it('canonicalizes case: EN → en', () => {
    expect(normalizeLang('EN')).toBe('en');
  });

  it('canonicalizes case: ja-hrkt → ja-Hrkt', () => {
    expect(normalizeLang('ja-hrkt')).toBe('ja-Hrkt');
  });

  it('canonicalizes case: ZH-HANS → zh-Hans', () => {
    expect(normalizeLang('ZH-HANS')).toBe('zh-Hans');
  });

  it('returns default for empty string', () => {
    expect(normalizeLang('')).toBe('ja');
  });
});
