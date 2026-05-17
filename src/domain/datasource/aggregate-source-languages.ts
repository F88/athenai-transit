import type { DataSourceInfo } from './data-source-info';

/**
 * Aggregate the languages supported across a set of {@link DataSourceInfo}
 * entries (e.g. every prefix in a {@link SourceGroup}).
 *
 * Returns the **union** of `translationLanguages` arrays — a code
 * appearing in any single source is included exactly once. Use `.size`
 * for "how many languages does this group offer" or iterate for display.
 *
 * Return value:
 *   - `null` — **every** input's `translationLanguages` is `null` (i.e.
 *     no prefix in the group has catalog data). Treat this as "no
 *     information available" and hide the metric.
 *   - `Set<...>` — at least one prefix has catalog data. The Set may
 *     still be empty when every catalog-covered prefix declares zero
 *     translations; that case is *not* the same as the `null` above
 *     and should render as "0 translations" rather than being hidden.
 *
 * The returned set preserves no specific iteration order; callers that
 * need a stable display order should sort the contents themselves.
 */
export function aggregateLanguages(infos: readonly DataSourceInfo[]): ReadonlySet<string> | null {
  const set = new Set<string>();
  let anyCatalogPresent = false;
  for (const info of infos) {
    if (info.translationLanguages === null) {
      continue;
    }
    anyCatalogPresent = true;
    for (const lang of info.translationLanguages) {
      set.add(lang);
    }
  }
  return anyCatalogPresent ? set : null;
}
