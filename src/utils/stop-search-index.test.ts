import { describe, expect, it } from 'vitest';
import type { Stop } from '@/types/app/transit';
import { buildSearchIndexEntry, filterStopsByQuery } from './stop-search-index';

function makeStop(
  partial: Pick<Stop, 'stop_id' | 'stop_name' | 'stop_names'> & Partial<Stop>,
): Stop {
  return {
    stop_lat: 0,
    stop_lon: 0,
    location_type: 0,
    agency_id: '',
    ...partial,
  };
}

describe('buildSearchIndexEntry', () => {
  it('joins stop_names values with U+0001 in the raw blob', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '新宿',
        stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク', en: 'Shinjuku' },
      }),
    );
    expect(entry.rawNamesBlob).toBe('新宿\x01シンジュク\x01Shinjuku');
  });

  it('lower-cases and applies katakanaToHiragana for the normalized blob', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '新宿',
        stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク', en: 'Shinjuku' },
      }),
    );
    expect(entry.normalizedNamesBlob).toBe('新宿\x01しんじゅく\x01shinjuku');
  });

  it('produces empty blobs when stop_names is empty', () => {
    const entry = buildSearchIndexEntry(
      makeStop({ stop_id: 's1', stop_name: '無名', stop_names: {} }),
    );
    expect(entry.rawNamesBlob).toBe('');
    expect(entry.normalizedNamesBlob).toBe('');
  });
});

describe('filterStopsByQuery', () => {
  const stops: Stop[] = [
    makeStop({
      stop_id: 's1',
      stop_name: '新宿',
      stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク', en: 'Shinjuku' },
    }),
    makeStop({
      stop_id: 's2',
      stop_name: '渋谷',
      stop_names: { ja: '渋谷', 'ja-Hrkt': 'シブヤ', en: 'Shibuya' },
    }),
    makeStop({
      stop_id: 's3',
      stop_name: '中野',
      stop_names: { ja: '中野', 'ja-Hrkt': 'ナカノ', en: 'Nakano' },
    }),
  ];
  const index = stops.map(buildSearchIndexEntry);

  it('returns [] for empty / whitespace-only query', () => {
    expect(filterStopsByQuery(index, '', 10)).toEqual([]);
    expect(filterStopsByQuery(index, '   ', 10)).toEqual([]);
  });

  it('matches by direct stop_name', () => {
    expect(filterStopsByQuery(index, '新宿', 10).map((s) => s.stop_id)).toEqual(['s1']);
  });

  it('matches via raw stop_names entries (e.g., en)', () => {
    expect(filterStopsByQuery(index, 'Shibuya', 10).map((s) => s.stop_id)).toEqual(['s2']);
  });

  it('falls back to kana-normalized matching (hiragana query → katakana name)', () => {
    expect(filterStopsByQuery(index, 'しんじゅく', 10).map((s) => s.stop_id)).toEqual(['s1']);
  });

  it('matches case-insensitively via the normalized blob', () => {
    expect(filterStopsByQuery(index, 'shibuya', 10).map((s) => s.stop_id)).toEqual(['s2']);
  });

  it('rejects queries containing the NAME_SEP character (regression guard)', () => {
    // Without this guard, the U+0001 join character inside the blobs would
    // make every multi-name stop match — see PR #177 review.
    expect(filterStopsByQuery(index, '\x01', 10)).toEqual([]);
    expect(filterStopsByQuery(index, 'ab\x01cd', 10)).toEqual([]);
  });

  it('respects maxResults', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      makeStop({
        stop_id: `m${i}`,
        stop_name: `Match${i}`,
        stop_names: { ja: `Match${i}` },
      }),
    );
    expect(filterStopsByQuery(many.map(buildSearchIndexEntry), 'Match', 3)).toHaveLength(3);
  });

  it('orders prefix matches before substring matches, then by name length', () => {
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'long',
        stop_name: '新宿三丁目',
        stop_names: { ja: '新宿三丁目', 'ja-Hrkt': 'シンジュクサンチョウメ' },
      }),
      makeStop({
        stop_id: 'short',
        stop_name: '新宿',
        stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク' },
      }),
      makeStop({
        stop_id: 'sub',
        stop_name: '東新宿',
        stop_names: { ja: '東新宿', 'ja-Hrkt': 'ヒガシシンジュク' },
      }),
    ];
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), '新宿', 10);
    expect(result.map((s) => s.stop_id)).toEqual(['short', 'long', 'sub']);
  });

  it('does not match across name boundaries (NAME_SEP integrity)', () => {
    // Stop has names "ab" and "cd" — query "bc" must not match because
    // "ab" + SEP + "cd" should never look like a contiguous "bc" substring.
    const stop = makeStop({
      stop_id: 'edge',
      stop_name: 'ab',
      stop_names: { ja: 'ab', en: 'cd' },
    });
    const idx = [buildSearchIndexEntry(stop)];
    expect(filterStopsByQuery(idx, 'bc', 10)).toEqual([]);
  });
});
