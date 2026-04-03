import { describe, expect, it } from 'vitest';
import { translateHeadsign } from '../translate-headsign';
import type { TranslatableText } from '../../../../types/app/transit-composed';

describe('translateHeadsign', () => {
  const tripHeadsign: TranslatableText = {
    name: '新橋駅前',
    names: {
      ja: '新橋駅前',
      'ja-Hrkt': 'しんばしえきまえ',
      en: 'Shimbashi Sta.',
    },
  };

  it('returns raw names when lang is omitted', () => {
    const result = translateHeadsign(tripHeadsign, undefined);
    expect(result.tripName).toBe('新橋駅前');
    expect(result.stopName).toBe('');
  });

  it('returns raw names when lang is undefined', () => {
    const result = translateHeadsign(tripHeadsign, undefined, undefined);
    expect(result.tripName).toBe('新橋駅前');
    expect(result.stopName).toBe('');
  });

  it('returns translated tripName when lang matches', () => {
    expect(translateHeadsign(tripHeadsign, undefined, 'en').tripName).toBe('Shimbashi Sta.');
    expect(translateHeadsign(tripHeadsign, undefined, 'ja-Hrkt').tripName).toBe('しんばしえきまえ');
    expect(translateHeadsign(tripHeadsign, undefined, 'ja').tripName).toBe('新橋駅前');
  });

  it('falls back to raw tripName when lang does not match', () => {
    expect(translateHeadsign(tripHeadsign, undefined, 'ko').tripName).toBe('新橋駅前');
  });

  it('returns raw tripName when names is empty', () => {
    const empty: TranslatableText = { name: '新宿駅西口', names: {} };
    expect(translateHeadsign(empty, undefined).tripName).toBe('新宿駅西口');
    expect(translateHeadsign(empty, undefined, 'en').tripName).toBe('新宿駅西口');
  });

  it('returns empty tripName when name is empty', () => {
    const empty: TranslatableText = { name: '', names: {} };
    expect(translateHeadsign(empty, undefined).tripName).toBe('');
    expect(translateHeadsign(empty, undefined).stopName).toBe('');
  });

  it('returns empty tripName when name is empty with lang', () => {
    const empty: TranslatableText = { name: '', names: {} };
    expect(translateHeadsign(empty, undefined, 'en').tripName).toBe('');
  });

  it('returns translation for empty name when names has value for lang', () => {
    const withTranslation: TranslatableText = { name: '', names: { en: 'Something' } };
    expect(translateHeadsign(withTranslation, undefined, 'en').tripName).toBe('Something');
  });

  // --- stopHeadsign ---

  it('returns stopName when stopHeadsign is provided', () => {
    const stopHeadsign: TranslatableText = {
      name: '出町柳駅',
      names: { en: 'Demachiyanagi Sta.' },
    };
    const result = translateHeadsign(tripHeadsign, stopHeadsign);
    expect(result.tripName).toBe('新橋駅前');
    expect(result.stopName).toBe('出町柳駅');
  });

  it('returns translated stopName when lang matches', () => {
    const stopHeadsign: TranslatableText = {
      name: '出町柳駅',
      names: { en: 'Demachiyanagi Sta.' },
    };
    const result = translateHeadsign(tripHeadsign, stopHeadsign, 'en');
    expect(result.tripName).toBe('Shimbashi Sta.');
    expect(result.stopName).toBe('Demachiyanagi Sta.');
  });

  it('returns empty stopName when stopHeadsign is undefined', () => {
    const result = translateHeadsign(tripHeadsign, undefined, 'en');
    expect(result.stopName).toBe('');
  });
});
