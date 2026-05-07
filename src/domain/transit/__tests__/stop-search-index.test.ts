import { describe, expect, it } from 'vitest';
import type { Stop } from '@/types/app/transit';
import {
  buildSearchIndexEntry,
  filterStopsByQuery,
  normalizeForSearch,
} from '../stop-search-index';

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

describe('normalizeForSearch', () => {
  it('lower-cases ASCII', () => {
    expect(normalizeForSearch('Shibuya')).toBe('shibuya');
    expect(normalizeForSearch('SHIBUYA')).toBe('shibuya');
  });

  it('converts katakana to hiragana', () => {
    expect(normalizeForSearch('シンジュク')).toBe('しんじゅく');
  });

  it('strips Latin combining diacritics (macron, acute, tilde, etc.)', () => {
    expect(normalizeForSearch('Ōyana')).toBe('oyana');
    expect(normalizeForSearch('Café')).toBe('cafe');
    expect(normalizeForSearch('Niño')).toBe('nino');
    expect(normalizeForSearch('Über')).toBe('uber');
    expect(normalizeForSearch('façade')).toBe('facade');
  });

  it('preserves kana voicing marks (dakuten / handakuten)', () => {
    // Critical guard: stripping `\p{Diacritic}` wholesale would mangle
    // these (が → か, ぱ → は). The U+0300–U+036F bound prevents that.
    expect(normalizeForSearch('がっこう')).toBe('がっこう');
    expect(normalizeForSearch('パーク')).toBe('ぱーく');
    expect(normalizeForSearch('ガンダム')).toBe('がんだむ');
  });

  it('returns canonical NFC form even when input is decomposed', () => {
    // Pre-decomposed input should still come out NFC-recomposed.
    const decomposed = 'Ōyana'; // O + combining macron
    expect(normalizeForSearch(decomposed)).toBe('oyana');
  });
});

describe('buildSearchIndexEntry', () => {
  it('normalizes each stop_names value via normalizeForSearch', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '新宿',
        stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク', en: 'Shinjuku' },
      }),
    );
    expect(entry.normalizedNames).toEqual(['新宿', 'しんじゅく', 'shinjuku']);
  });

  it('strips Latin diacritics from stop_names values', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '大柳',
        stop_names: { ja: '大柳', 'ja-Hrkt': 'オオヤナ', en: 'Ōyana' },
      }),
    );
    expect(entry.normalizedNames).toEqual(['大柳', 'おおやな', 'oyana']);
  });

  it('resolves hrktSortKey from a canonical `ja-Hrkt` key', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '新宿',
        stop_names: { ja: '新宿', 'ja-Hrkt': 'シンジュク', en: 'Shinjuku' },
      }),
    );
    expect(entry.hrktSortKey).toBe('シンジュク');
  });

  it('resolves hrktSortKey from a non-canonical key casing (e.g. `ja-HrKt`)', () => {
    // BCP-47 language tags are case-insensitive; some upstream feeds (e.g.
    // kseiw) store the key with non-standard casing. Treat them as a hit.
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '中宿',
        stop_names: { ja: '中宿', 'ja-HrKt': 'なかじゅく', en: 'Nakajyuku' },
      }),
    );
    expect(entry.hrktSortKey).toBe('なかじゅく');
  });

  it('returns empty hrktSortKey when no kana translation exists', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '中延',
        stop_names: { ja: '中延', en: 'Nakanobu' },
      }),
    );
    expect(entry.hrktSortKey).toBe('');
  });

  it('falls back to stop_name when stop_names is empty (vagfr regression guard)', () => {
    // Real-world case: VAG Freiburg ships `feed_lang=""` and no
    // translations.txt entries, so injectOriginLang skips synthesizing a
    // language-keyed name and `stop_names` ends up `{}`. Every vagfr stop
    // would silently fall out of the search index without this fallback.
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 'vagfr:1',
        stop_name: 'Freiburg',
        stop_names: {},
      }),
    );
    expect(entry.normalizedNames).toEqual(['freiburg']);
  });

  it('produces an empty list when both stop_name and stop_names are empty', () => {
    const entry = buildSearchIndexEntry(makeStop({ stop_id: 's1', stop_name: '', stop_names: {} }));
    expect(entry.normalizedNames).toEqual([]);
    expect(entry.hrktSortKey).toBe('');
  });

  it('does not duplicate stop_name when it already appears in stop_names', () => {
    const entry = buildSearchIndexEntry(
      makeStop({
        stop_id: 's1',
        stop_name: '新宿',
        stop_names: { ja: '新宿', en: 'Shinjuku' },
      }),
    );
    expect(entry.normalizedNames).toEqual(['新宿', 'shinjuku']);
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

  it('returns an empty result for empty / whitespace-only query', () => {
    expect(filterStopsByQuery(index, '', 10)).toEqual({ stops: [], total: 0 });
    expect(filterStopsByQuery(index, '   ', 10)).toEqual({ stops: [], total: 0 });
  });

  it('returns an empty result when the query collapses to an empty normalized form', () => {
    // Latin combining marks (U+0300–U+036F) are stripped by
    // normalizeForSearch. A query consisting only of combining marks
    // therefore normalizes to ''; without the empty-query guard
    // `String.includes('')` would match every stop and the truncated
    // top-N would surface as a meaningless dump of the entire index.
    expect(filterStopsByQuery(index, '̄', 10)).toEqual({ stops: [], total: 0 });
    expect(filterStopsByQuery(index, '́̀', 10)).toEqual({ stops: [], total: 0 });
  });

  it('matches by direct stop_name', () => {
    expect(filterStopsByQuery(index, '新宿', 10).stops.map((s) => s.stop_id)).toEqual(['s1']);
  });

  it('matches via any stop_names entry (e.g., en)', () => {
    expect(filterStopsByQuery(index, 'Shibuya', 10).stops.map((s) => s.stop_id)).toEqual(['s2']);
  });

  it('falls back to kana-normalized matching (hiragana query → katakana name)', () => {
    expect(filterStopsByQuery(index, 'しんじゅく', 10).stops.map((s) => s.stop_id)).toEqual(['s1']);
  });

  it('matches case-insensitively (lowercase query)', () => {
    expect(filterStopsByQuery(index, 'shibuya', 10).stops.map((s) => s.stop_id)).toEqual(['s2']);
  });

  it('matches case-insensitively (uppercase query)', () => {
    expect(filterStopsByQuery(index, 'SHIBUYA', 10).stops.map((s) => s.stop_id)).toEqual(['s2']);
  });

  it('respects maxResults but reports the full pre-truncation count via total', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      makeStop({
        stop_id: `m${i}`,
        stop_name: `Match${i}`,
        stop_names: { ja: `Match${i}` },
      }),
    );
    const result = filterStopsByQuery(many.map(buildSearchIndexEntry), 'Match', 3);
    expect(result.stops).toHaveLength(3);
    expect(result.total).toBe(5);
  });

  it('reports total === stops.length when the result set is not truncated', () => {
    const result = filterStopsByQuery(index, '新宿', 10);
    expect(result.stops).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('orders prefix matches before substring matches, then by shortest matched name length', () => {
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
    expect(result.stops.map((s) => s.stop_id)).toEqual(['short', 'long', 'sub']);
  });

  it('matches Latin-diacritic names via the diacritic-stripped query', () => {
    // Regression for "oyana" → "Ōyana" (toei bus stop 大柳).
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'oyana',
        stop_name: '大柳',
        stop_names: { ja: '大柳', 'ja-Hrkt': 'オオヤナ', en: 'Ōyana' },
      }),
    ];
    const idx = stops2.map(buildSearchIndexEntry);
    expect(filterStopsByQuery(idx, 'oyana', 10).stops.map((s) => s.stop_id)).toEqual(['oyana']);
    expect(filterStopsByQuery(idx, 'OYANA', 10).stops.map((s) => s.stop_id)).toEqual(['oyana']);
    expect(filterStopsByQuery(idx, 'Oyana', 10).stops.map((s) => s.stop_id)).toEqual(['oyana']);
  });

  it('case-insensitive prefix bonus across language fields (regression for romaji query)', () => {
    // The Japanese stop_name (中井 / 中延) does not start with "naka", so the
    // prefix bonus must come from the en field. The shorter en name should
    // rank first via the matched-name length tiebreaker.
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'nakanobu',
        stop_name: '中延',
        stop_names: { ja: '中延', en: 'Nakanobu' },
      }),
      makeStop({
        stop_id: 'nakai',
        stop_name: '中井',
        stop_names: { ja: '中井', en: 'Nakai' },
      }),
    ];
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), 'NAKA', 10);
    expect(result.stops.map((s) => s.stop_id)).toEqual(['nakai', 'nakanobu']);
  });

  it('sorts stops with a populated hrktSortKey before stops without one', () => {
    // Real-world impact: kanji queries like `駅` previously surfaced
    // partial-data feeds (toaran / minkuru — no ja-Hrkt) above
    // fully-translated feeds simply because empty strings localeCompare
    // less than any non-empty string. The empty-key stop must rank
    // *after* the populated-key stop so feeds with complete
    // translations are favored.
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'no-hrkt',
        stop_name: '四谷駅',
        stop_names: { ja: '四谷駅', en: 'Yotsuya Sta.' },
      }),
      makeStop({
        stop_id: 'has-hrkt',
        stop_name: '赤羽駅',
        stop_names: { ja: '赤羽駅', 'ja-Hrkt': 'あかばねえき', en: 'Akabane Sta.' },
      }),
    ];
    // Both share length 3 on the ja kanji match for '駅'. Without the
    // empty-key-last rule the toaran-style stop (no-hrkt) would win
    // because '' < 'あかばねえき' in locale order.
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), '駅', 10);
    expect(result.stops.map((s) => s.stop_id)).toEqual(['has-hrkt', 'no-hrkt']);
  });

  it('falls back to gojuon order via hrktSortKey for tied length and prefix matches', () => {
    // Two stops with non-canonical `ja-HrKt` (capital K) keys — both match
    // the query at the same matched-name length, so the final tiebreaker
    // (case-insensitive `ja-Hrkt` lookup) decides. Without the
    // case-insensitive resolution they would tie at empty-string and fall
    // back to input order.
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'fu',
        stop_name: 'ふなのまち',
        stop_names: { ja: 'ふなのまち', 'ja-HrKt': 'ふなのまち' },
      }),
      makeStop({
        stop_id: 'na',
        stop_name: 'なかのうら',
        stop_names: { ja: 'なかのうら', 'ja-HrKt': 'なかのうら' },
      }),
    ];
    // Input order is fu, na. Gojuon order is na (な) < fu (ふ).
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), 'の', 10);
    expect(result.stops.map((s) => s.stop_id)).toEqual(['na', 'fu']);
  });

  it('falls back to matchedName order when ja-Hrkt is absent and lengths tie', () => {
    // Toaran-style: no `ja-Hrkt` entry at all, en names tie at the same
    // length. Without the matchedName tiebreaker the order would depend
    // on input order from the search index.
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'kanda',
        stop_name: '東神田',
        stop_names: { ja: '東神田', en: 'Higashi-Kanda' },
      }),
      makeStop({
        stop_id: 'ginza',
        stop_name: '東銀座',
        stop_names: { ja: '東銀座', en: 'Higashi-Ginza' },
      }),
    ];
    // Input order is kanda, ginza. Both 'higashi-kanda' / 'higashi-ginza'
    // are 13 chars and prefix-match 'higashi'. The matchedName tiebreaker
    // (locale ja) should put `higashi-ginza` before `higashi-kanda`.
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), 'higashi', 10);
    expect(result.stops.map((s) => s.stop_id)).toEqual(['ginza', 'kanda']);
  });

  it('falls back to platform_code numeric order for same-name stops, with null last', () => {
    // Mirrors the toei bus 王子駅前 case: one stop_name shared across
    // many platform poles. Same prefix / length / hrktSortKey /
    // matchedName for every entry, so platform_code is the only
    // discriminator. `null` / undefined platform_code sorts last.
    const stops2: Stop[] = [
      makeStop({
        stop_id: 'p10',
        stop_name: '王子駅前',
        stop_names: { ja: '王子駅前', 'ja-Hrkt': 'おうじえきまえ', en: 'Ōji Sta.' },
        platform_code: '10',
      }),
      makeStop({
        stop_id: 'p2',
        stop_name: '王子駅前',
        stop_names: { ja: '王子駅前', 'ja-Hrkt': 'おうじえきまえ', en: 'Ōji Sta.' },
        platform_code: '2',
      }),
      makeStop({
        stop_id: 'pNone',
        stop_name: '王子駅前',
        stop_names: { ja: '王子駅前', 'ja-Hrkt': 'おうじえきまえ', en: 'Ōji Sta.' },
      }),
      makeStop({
        stop_id: 'p1',
        stop_name: '王子駅前',
        stop_names: { ja: '王子駅前', 'ja-Hrkt': 'おうじえきまえ', en: 'Ōji Sta.' },
        platform_code: '1',
      }),
    ];
    const result = filterStopsByQuery(stops2.map(buildSearchIndexEntry), 'sta.', 10);
    expect(result.stops.map((s) => s.stop_id)).toEqual(['p1', 'p2', 'p10', 'pNone']);
  });

  it('does not match across name boundaries', () => {
    // Stop has names "ab" and "cd" — query "bc" must not match because
    // each name is checked independently, never concatenated.
    const stop = makeStop({
      stop_id: 'edge',
      stop_name: 'ab',
      stop_names: { ja: 'ab', en: 'cd' },
    });
    const idx = [buildSearchIndexEntry(stop)];
    expect(filterStopsByQuery(idx, 'bc', 10)).toEqual({ stops: [], total: 0 });
  });
});
