import { describe, it, expect } from 'vitest';
import { getSubNames } from '../get-sub-names';
import { makeStop } from '../../../__tests__/helpers';

describe('getSubNames', () => {
  it('returns empty array when stop_names is empty', () => {
    const stop = makeStop('A');
    expect(getSubNames(stop)).toEqual([]);
  });

  it('excludes entries matching stop_name', () => {
    const stop = {
      ...makeStop('A'),
      stop_name: 'テスト駅',
      stop_names: { ja: 'テスト駅', en: 'Test Sta.' },
    };
    const result = getSubNames(stop);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'en', value: 'Test Sta.' });
  });

  it('returns all entries when none match stop_name', () => {
    const stop = {
      ...makeStop('A'),
      stop_name: '別名',
      stop_names: { ja: 'テスト駅', en: 'Test Sta.', 'ja-Hrkt': 'てすとえき' },
    };
    const result = getSubNames(stop);

    expect(result).toHaveLength(3);
  });

  it('returns empty array when all entries match stop_name', () => {
    const stop = {
      ...makeStop('A'),
      stop_name: '同じ',
      stop_names: { ja: '同じ', en: '同じ' },
    };
    expect(getSubNames(stop)).toEqual([]);
  });

  it('preserves key-value structure', () => {
    const stop = {
      ...makeStop('A'),
      stop_name: 'テスト',
      stop_names: { 'ja-Hrkt': 'てすと', en: 'Test' },
    };
    const result = getSubNames(stop);

    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'ja-Hrkt', value: 'てすと' },
        { key: 'en', value: 'Test' },
      ]),
    );
  });
});
