import { describe, expect, it } from 'vitest';
import { translateHeadsign } from '../translate-headsign';

describe('translateHeadsign', () => {
  const names = {
    ja: '新橋駅前',
    'ja-Hrkt': 'しんばしえきまえ',
    en: 'Shimbashi Sta.',
  };

  it('returns headsign as-is when lang is omitted', () => {
    expect(translateHeadsign('新橋駅前', names)).toBe('新橋駅前');
  });

  it('returns headsign as-is when lang is undefined', () => {
    expect(translateHeadsign('新橋駅前', names, undefined)).toBe('新橋駅前');
  });

  it('returns translated name when lang matches', () => {
    expect(translateHeadsign('新橋駅前', names, 'en')).toBe('Shimbashi Sta.');
    expect(translateHeadsign('新橋駅前', names, 'ja-Hrkt')).toBe('しんばしえきまえ');
    expect(translateHeadsign('新橋駅前', names, 'ja')).toBe('新橋駅前');
  });

  it('falls back to headsign when lang does not match', () => {
    expect(translateHeadsign('新橋駅前', names, 'ko')).toBe('新橋駅前');
  });

  it('returns headsign when headsignNames is empty', () => {
    expect(translateHeadsign('新宿駅西口', {})).toBe('新宿駅西口');
    expect(translateHeadsign('新宿駅西口', {}, 'en')).toBe('新宿駅西口');
  });

  it('returns empty string when headsign is empty', () => {
    expect(translateHeadsign('', {})).toBe('');
    expect(translateHeadsign('', names)).toBe('');
  });

  it('returns empty string when headsign is empty with lang', () => {
    expect(translateHeadsign('', {}, 'en')).toBe('');
  });

  it('does not return translation for empty headsign even if names has empty key', () => {
    expect(translateHeadsign('', { en: 'Something' }, 'en')).toBe('Something');
  });
});
