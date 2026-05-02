import type { Stop } from '@/types/app/transit';
import { katakanaToHiragana } from './kana-normalize';

/**
 * Separator used to join `stop_names` values into a single search blob.
 *
 * Real GTFS / ODPT stop name strings never contain U+0001, so concatenating
 * with this character cannot produce a substring spanning two adjacent names
 * — i.e. `name1 + SEP + name2` only matches a query when the query is
 * fully contained inside one of the source names. Queries that themselves
 * contain U+0001 are rejected by `filterStopsByQuery` to preserve this
 * invariant.
 */
const NAME_SEP = '\x01';

export interface SearchIndexEntry {
  stop: Stop;
  /** `stop_names` values joined verbatim — used for the case-sensitive fallback. */
  rawNamesBlob: string;
  /** `stop_names` values lower-cased and katakana→hiragana normalized — used for the kana-normalized fallback. */
  normalizedNamesBlob: string;
}

/**
 * Pre-build a search index entry for one stop.
 *
 * Doing this once at load time lets the per-keystroke filter perform a
 * single `String.includes` per blob instead of running `katakanaToHiragana`
 * on every name on every keystroke.
 */
export function buildSearchIndexEntry(stop: Stop): SearchIndexEntry {
  const names = Object.values(stop.stop_names);
  return {
    stop,
    rawNamesBlob: names.join(NAME_SEP),
    normalizedNamesBlob: names.map((n) => katakanaToHiragana(n.toLowerCase())).join(NAME_SEP),
  };
}

/**
 * Filter and rank a search index for a free-text query.
 *
 * Match precedence (any of):
 *   1. `stop.stop_name` contains the trimmed query (case-sensitive).
 *   2. Any value in `stop.stop_names` contains the trimmed query (raw blob).
 *   3. Any value in `stop.stop_names`, lower-cased and kana-normalized,
 *      contains the lower-cased + kana-normalized query.
 *
 * Sorted by: prefix match first → shorter `stop_name` first → ja-Hrkt
 * gojuon order. Truncated to `maxResults`.
 *
 * Queries containing `NAME_SEP` are rejected (returns []) so they cannot
 * match the join character that separates names inside the pre-built blobs.
 */
export function filterStopsByQuery(
  searchIndex: readonly SearchIndexEntry[],
  query: string,
  maxResults: number,
): Stop[] {
  const trimmed = query.trim();
  if (trimmed === '') {
    return [];
  }
  if (trimmed.includes(NAME_SEP)) {
    return [];
  }
  const lowerTrimmed = trimmed.toLowerCase();
  const normalizedQuery = katakanaToHiragana(lowerTrimmed);
  const matches: Stop[] = [];
  for (const entry of searchIndex) {
    const s = entry.stop;
    if (
      s.stop_name.includes(trimmed) ||
      entry.rawNamesBlob.includes(trimmed) ||
      (normalizedQuery !== '' && entry.normalizedNamesBlob.includes(normalizedQuery))
    ) {
      matches.push(s);
    }
  }
  matches.sort((a, b) => {
    const aPrefix = a.stop_name.startsWith(trimmed) ? 0 : 1;
    const bPrefix = b.stop_name.startsWith(trimmed) ? 0 : 1;
    if (aPrefix !== bPrefix) {
      return aPrefix - bPrefix;
    }
    if (a.stop_name.length !== b.stop_name.length) {
      return a.stop_name.length - b.stop_name.length;
    }
    return (a.stop_names['ja-Hrkt'] ?? '').localeCompare(b.stop_names['ja-Hrkt'] ?? '', 'ja');
  });
  return matches.slice(0, maxResults);
}
