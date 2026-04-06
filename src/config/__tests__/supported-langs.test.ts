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

  it('prefix match: en-US → en', () => {
    expect(normalizeLang('en-US')).toBe('en');
  });

  it('prefix match: ja-JP → ja', () => {
    expect(normalizeLang('ja-JP')).toBe('ja');
  });

  it('region match: zh-CN → zh-Hans', () => {
    expect(normalizeLang('zh-CN')).toBe('zh-Hans');
  });

  it('region match: zh-TW → zh-Hant', () => {
    expect(normalizeLang('zh-TW')).toBe('zh-Hant');
  });

  it('region match: zh-HK → zh-Hant', () => {
    expect(normalizeLang('zh-HK')).toBe('zh-Hant');
  });

  it('exact match takes precedence over prefix', () => {
    // zh-Hans is an exact match, not just prefix 'zh'
    expect(normalizeLang('zh-Hans')).toBe('zh-Hans');
  });
});
