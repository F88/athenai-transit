import type { DataSourceInfo } from './data-source-info';

/**
 * Aggregate the languages supported across a set of {@link DataSourceInfo}
 * entries (e.g. every prefix in a {@link SourceGroup}).
 *
 * Returns the **union** of `languages` arrays — a code appearing in any
 * single source is included exactly once. Use `.size` for "how many
 * languages does this group offer" or iterate for display.
 *
 * The returned set preserves no specific iteration order; callers that
 * need a stable display order should sort the contents themselves.
 */
export function aggregateLanguages(infos: readonly DataSourceInfo[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const info of infos) {
    for (const lang of info.translationLanguages) {
      set.add(lang);
    }
  }
  return set;
}
