import { describe, expect, it } from 'vitest';
import { normalizeStopName } from '../normalize-stop-name';

describe('normalizeStopName', () => {
  it('removes trailing 前', () => {
    expect(normalizeStopName('渋谷駅前')).toBe('渋谷駅');
    expect(normalizeStopName('笹塚駅前')).toBe('笹塚駅');
    expect(normalizeStopName('セシオン杉並前')).toBe('セシオン杉並');
  });

  it('does not remove 前 in the middle of a name', () => {
    expect(normalizeStopName('前橋駅')).toBe('前橋駅');
    expect(normalizeStopName('杏林大学杉並病院前')).toBe('杏林大学杉並病院');
  });

  it('removes small kana ヶ', () => {
    expect(normalizeStopName('阿佐ヶ谷')).toBe('阿佐谷');
    expect(normalizeStopName('幡ヶ谷駅')).toBe('幡谷駅');
  });

  it('removes katakana ケ', () => {
    expect(normalizeStopName('阿佐ケ谷')).toBe('阿佐谷');
  });

  it('removes hiragana が', () => {
    expect(normalizeStopName('霞が関')).toBe('霞関');
  });

  it('normalizes katakana ノ to hiragana の', () => {
    expect(normalizeStopName('堀ノ内')).toBe('堀の内');
  });

  it('applies all normalizations together', () => {
    expect(normalizeStopName('阿佐ヶ谷駅前')).toBe('阿佐谷駅');
  });

  it('returns unchanged name when no normalization applies', () => {
    expect(normalizeStopName('中野駅')).toBe('中野駅');
    expect(normalizeStopName('高円寺陸橋')).toBe('高円寺陸橋');
  });
});
