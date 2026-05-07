import type { Stop } from '@/types/app/transit';
import { katakanaToHiragana } from '@/utils/kana-normalize';

/**
 * Normalize a string for stop search.
 *
 * Pipeline:
 *   1. `toLowerCase` — collapse case (`NAKA` / `Naka` / `naka` → `naka`).
 *   2. `katakanaToHiragana` — collapse kana script (`ナカ` → `なか`).
 *   3. NFD → strip Latin combining marks (U+0300–U+036F) → NFC —
 *      collapse Latin diacritics (`Ōyana` → `oyana`, `café` → `cafe`).
 *
 * Why the strip range is narrowed to U+0300–U+036F: kana voicing marks
 * live in U+3099 / U+309A. Stripping `\p{Diacritic}` wholesale would
 * mangle `が` (= `か` + U+3099) into `か`, which is unacceptable for
 * stop-name search. Limiting the replace to the Combining Diacritical
 * Marks block keeps kana voicing intact while still catching macron,
 * acute, grave, circumflex, tilde, diaeresis, caron, cedilla, etc.
 *
 * The trailing NFC re-composes any kana that NFD decomposed in step 3
 * (e.g. `が` → `か` + U+3099 → recomposed back to `が`), so callers can
 * rely on the output being canonical (NFC) regardless of input form.
 */
export function normalizeForSearch(s: string): string {
  return katakanaToHiragana(s.toLowerCase())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Resolve the `ja-Hrkt` (Hiragana / Katakana script) translation from
 * `stop.stop_names` with case-insensitive key matching.
 *
 * Some upstream feeds use non-canonical casing (e.g. kseiw stores the key
 * as `ja-HrKt` with a capital K) so the literal `stop_names['ja-Hrkt']`
 * lookup misses them. BCP-47 language tags are case-insensitive by
 * specification, so treating `ja-HrKt` and `ja-Hrkt` as the same key is
 * correct, not lenient.
 *
 * Returns `''` when no matching key exists, which is the same neutral
 * value the legacy code defaulted to.
 */
function findHrktName(stop_names: Record<string, string>): string {
  for (const key of Object.keys(stop_names)) {
    if (key.toLowerCase() === 'ja-hrkt') {
      return stop_names[key] ?? '';
    }
  }
  return '';
}

export interface SearchIndexEntry {
  stop: Stop;
  /**
   * Each value of `stop.stop_names`, run through {@link normalizeForSearch}
   * at build time. The matcher and the sort tiebreakers all read from this
   * single representation so case / kana / Latin-diacritic / language
   * differences across the GTFS / ODPT translations.txt entries are
   * absorbed once and for all.
   */
  normalizedNames: string[];
  /**
   * `stop_names['ja-Hrkt']` resolved with case-insensitive key lookup,
   * pre-computed for the final sort tiebreaker. Empty string when the
   * stop has no kana translation at all.
   */
  hrktSortKey: string;
}

/**
 * Pre-build a search index entry for one stop.
 *
 * The normalize pipeline runs once per name here, so the per-keystroke
 * matcher only does plain `String.includes` / `String.startsWith` calls on
 * already-normalized strings.
 */
export function buildSearchIndexEntry(stop: Stop): SearchIndexEntry {
  return {
    stop,
    normalizedNames: Object.values(stop.stop_names).map(normalizeForSearch),
    hrktSortKey: findHrktName(stop.stop_names),
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
 *   3. `hrktSortKey` (case-insensitive `ja-Hrkt` lookup) gojuon order.
 *   4. Shortest matched name itself, locale-aware compared in `ja` —
 *      kicks in only when the previous tiers tie (e.g. both stops lack
 *      a `ja-Hrkt` translation entirely, like toaran feeds). Aligns the
 *      ordering with the language the user is actually searching in,
 *      since `matchedName` is the normalized form of whichever name
 *      hit the query.
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
  const normalizedQuery = normalizeForSearch(trimmed);

  type Decorated = {
    entry: SearchIndexEntry;
    prefix: 0 | 1;
    minMatchedLen: number;
    matchedName: string;
  };
  const decorated: Decorated[] = [];
  for (const entry of searchIndex) {
    let prefix: 0 | 1 = 1;
    let minMatchedLen = Infinity;
    let matchedName = '';
    for (const n of entry.normalizedNames) {
      if (!n.includes(normalizedQuery)) {
        continue;
      }
      if (n.startsWith(normalizedQuery)) {
        prefix = 0;
      }
      if (n.length < minMatchedLen) {
        minMatchedLen = n.length;
        matchedName = n;
      }
    }
    if (Number.isFinite(minMatchedLen)) {
      decorated.push({ entry, prefix, minMatchedLen, matchedName });
    }
  }

  decorated.sort((a, b) => {
    if (a.prefix !== b.prefix) {
      return a.prefix - b.prefix;
    }
    if (a.minMatchedLen !== b.minMatchedLen) {
      return a.minMatchedLen - b.minMatchedLen;
    }
    const hrktCmp = a.entry.hrktSortKey.localeCompare(b.entry.hrktSortKey, 'ja');
    if (hrktCmp !== 0) {
      return hrktCmp;
    }
    return a.matchedName.localeCompare(b.matchedName, 'ja');
  });

  return {
    stops: decorated.slice(0, maxResults).map((d) => d.entry.stop),
    total: decorated.length,
  };
}
