/**
 * International language priority order for display purposes.
 *
 * Based on international conventions (UN official languages, then
 * major world languages). Variants of the same language are grouped
 * together (e.g. `zh` → `zh-Hans` → `zh-Hant`).
 *
 * Keys not in this list are sorted after listed keys, preserving
 * their original relative order.
 */
const LANG_PRIORITY: readonly string[] = [
  'en',
  'fr',
  'es',
  'ar',
  'zh',
  'zh-Hans',
  'zh-Hant',
  'ru',
  'de',
  'ja',
  'ja-Hrkt',
  'ko',
];

/**
 * Extract the primary language prefix from a language key.
 *
 * @example
 * ```ts
 * langPrefix('ja-Hrkt') // → 'ja'
 * langPrefix('zh-Hans') // → 'zh'
 * langPrefix('en')      // → 'en'
 * ```
 */
function langPrefix(key: string): string {
  const i = key.indexOf('-');
  return i === -1 ? key : key.slice(0, i);
}

/**
 * Sort language keys for display, prioritizing agency languages
 * and their variants, then international order.
 *
 * Priority order:
 * 1. Preferred languages and their variants — exact match first,
 *    then variants defined in {@link LANG_PRIORITY},
 *    then undefined variants
 * 2. Remaining keys in {@link LANG_PRIORITY} order
 * 3. Keys not in any list (original relative order preserved)
 *
 * Does not deduplicate — use `new Set()` or similar if needed.
 *
 * @param keys - Language keys to sort.
 * @param preferred - Languages to prioritize (e.g. `['ja']` from agency_lang).
 * @returns A new sorted array.
 *
 * @example
 * ```ts
 * sortLangKeysByPriority(['en', 'ja-Hrkt', 'ko', 'ja', 'origin'], ['ja']);
 * // → ['ja', 'ja-Hrkt', 'en', 'ko', 'origin']
 * ```
 */
export function sortLangKeysByPriority(keys: string[], preferred: string[]): string[] {
  const preferredPrefixes = new Set(preferred.map(langPrefix));

  function sortKey(key: string): number {
    const prefix = langPrefix(key);
    const isAgencyVariant = preferredPrefixes.has(prefix);
    const priorityIndex = LANG_PRIORITY.indexOf(key);

    if (isAgencyVariant) {
      // Agency lang exact match → top priority
      if (preferred.includes(key)) {
        return -3000;
      }
      // Agency variant defined in LANG_PRIORITY
      if (priorityIndex !== -1) {
        return -2000 + priorityIndex;
      }
      // Agency variant not in LANG_PRIORITY
      return -1000;
    }

    // LANG_PRIORITY order
    if (priorityIndex !== -1) {
      return priorityIndex;
    }

    // Not in any list → end
    return 10000;
  }

  return [...keys].sort((a, b) => {
    const sa = sortKey(a);
    const sb = sortKey(b);
    if (sa !== sb) {
      return sa - sb;
    }
    // Same sort key → preserve original order
    return 0;
  });
}
