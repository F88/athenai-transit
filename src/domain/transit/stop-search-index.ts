import type { Stop } from '@/types/app/transit';
import { katakanaToHiragana } from '@/utils/kana-normalize';

export interface SearchIndexEntry {
  stop: Stop;
  /**
   * Each value of `stop.stop_names`, lower-cased and katakana→hiragana
   * normalized at build time. The matcher and the sort tiebreakers all read
   * from this single representation so case / kana / language differences
   * across the GTFS / ODPT translations.txt entries are absorbed once and
   * for all.
   */
  normalizedNames: string[];
}

/**
 * Pre-build a search index entry for one stop.
 *
 * `katakanaToHiragana` and `String.toLowerCase` run once per name here, so
 * the per-keystroke matcher only does plain `String.includes` /
 * `String.startsWith` calls on already-normalized strings.
 */
export function buildSearchIndexEntry(stop: Stop): SearchIndexEntry {
  return {
    stop,
    normalizedNames: Object.values(stop.stop_names).map((n) => katakanaToHiragana(n.toLowerCase())),
  };
}

/**
 * Result of {@link filterStopsByQuery}.
 *
 * `stops` is capped at the caller's `maxResults`; `total` is the full match
 * count before truncation, so the UI can report `shown / total` and decide
 * whether to surface a "truncated" hint.
 */
export interface FilterStopsByQueryResult {
  /** Matched stops, capped at the caller's `maxResults`. */
  stops: Stop[];
  /** Total match count before truncation. `total >= stops.length` always. */
  total: number;
}

/**
 * Filter and rank a search index for a free-text query.
 *
 * Matching: case-insensitive + katakana→hiragana normalized substring match
 * against any value of `stop.stop_names`. The query is normalized the same
 * way as the index entries, so e.g. `naka` / `NAKA` / `ナカ` / `なか` all
 * behave identically against an entry containing `Nakanobu` / `なかのぶ`.
 *
 * Ranking (each step is a tiebreaker for the previous):
 *   1. Prefix bonus — any normalized name starts with the normalized query.
 *   2. Shortest matched normalized name length.
 *   3. `stop_names['ja-Hrkt']` gojuon (locale-aware) order.
 *
 * The decoration loop runs in the same single pass that does the matching,
 * so the sort comparator only reads precomputed scalars.
 */
export function filterStopsByQuery(
  searchIndex: readonly SearchIndexEntry[],
  query: string,
  maxResults: number,
): FilterStopsByQueryResult {
  const trimmed = query.trim();
  if (trimmed === '') {
    return { stops: [], total: 0 };
  }
  const normalizedQuery = katakanaToHiragana(trimmed.toLowerCase());

  type Decorated = { entry: SearchIndexEntry; prefix: 0 | 1; minMatchedLen: number };
  const decorated: Decorated[] = [];
  for (const entry of searchIndex) {
    let prefix: 0 | 1 = 1;
    let minMatchedLen = Infinity;
    for (const n of entry.normalizedNames) {
      if (!n.includes(normalizedQuery)) {
        continue;
      }
      if (n.startsWith(normalizedQuery)) {
        prefix = 0;
      }
      if (n.length < minMatchedLen) {
        minMatchedLen = n.length;
      }
    }
    if (Number.isFinite(minMatchedLen)) {
      decorated.push({ entry, prefix, minMatchedLen });
    }
  }

  decorated.sort((a, b) => {
    if (a.prefix !== b.prefix) {
      return a.prefix - b.prefix;
    }
    if (a.minMatchedLen !== b.minMatchedLen) {
      return a.minMatchedLen - b.minMatchedLen;
    }
    return (a.entry.stop.stop_names['ja-Hrkt'] ?? '').localeCompare(
      b.entry.stop.stop_names['ja-Hrkt'] ?? '',
      'ja',
    );
  });

  return {
    stops: decorated.slice(0, maxResults).map((d) => d.entry.stop),
    total: decorated.length,
  };
}
