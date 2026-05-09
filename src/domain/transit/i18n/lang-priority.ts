import { langKeysEquivalent } from './lang-key-equivalence';

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
  // 'ar', // RTL Unhandled → disabled
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
 * Sort language keys for display.
 *
 * The base order is always {@link LANG_PRIORITY}. When `preferred`
 * is non-empty, exact matches and their variants are moved ahead of
 * that base order.
 *
 * Priority order:
 * 1. Preferred languages and their variants — exact match first in
 *    `preferred` array order,
 *    then variants defined in {@link LANG_PRIORITY},
 *    then undefined variants
 * 2. Remaining keys in the base {@link LANG_PRIORITY} order
 * 3. Keys not in any list (original relative order preserved)
 *
 * Comparison rules:
 * - Matching uses {@link langKeysEquivalent}: case-insensitive per
 *   BCP 47 **plus** zh region/script aliasing (`zh-cn` clusters with
 *   `zh-Hans`, `zh-tw` with `zh-Hant`, etc.). A `preferred` of
 *   `['zh-Hans']` therefore treats a key of `'zh-cn'` as an exact
 *   match in the same precedence slot.
 * - `preferred` is treated as an ordered precedence list, not an
 *   unordered set.
 * - Even when `preferred` is empty, keys in {@link LANG_PRIORITY}
 *   are still sorted by that base order.
 * - Keys with identical computed priority preserve their original
 *   relative order from `keys`.
 *
 * Does not deduplicate — use `new Set()` or similar if needed.
 *
 * @param keys - Language keys to sort.
 * @param preferred - Languages to prioritize in descending order
 * of precedence (e.g. `['en', 'ja']` means `en` exact match sorts
 * before `ja` exact match).
 * @returns A new sorted array.
 *
 * @example
 * ```ts
 * sortLangKeysByPriority(['en', 'ja-Hrkt', 'ko', 'ja', 'origin'], ['ja']);
 * // → ['ja', 'ja-Hrkt', 'en', 'ko', 'origin']
 *
 * sortLangKeysByPriority(['ja', 'en', 'ja-Hrkt'], ['en', 'ja']);
 * // → ['en', 'ja', 'ja-Hrkt']
 * ```
 */
export function sortLangKeysByPriority(keys: string[], preferred: readonly string[]): string[] {
  // Case-insensitive + region-alias comparisons via langKeysEquivalent
  // (BCP 47 §2.1.1 + zh region/script equivalence so that source keys
  // like `zh-cn` cluster with `preferred` of `zh-Hans`).
  const preferredPrefixes = new Set(preferred.map((p) => langPrefix(p.toLowerCase())));

  function sortKey(key: string): number {
    const keyLower = key.toLowerCase();
    const prefix = langPrefix(keyLower);
    const isAgencyVariant = preferredPrefixes.has(prefix);
    const priorityIndex = LANG_PRIORITY.findIndex((p) => langKeysEquivalent(p, key));

    if (isAgencyVariant) {
      // Agency lang exact match (or alias) → top priority in preferred order
      const preferredIndex = preferred.findIndex((p) => langKeysEquivalent(p, key));
      if (preferredIndex !== -1) {
        return -3000 + preferredIndex;
      }
      // Agency variant defined in LANG_PRIORITY (or alias)
      if (priorityIndex !== -1) {
        return -2000 + priorityIndex;
      }
      // Agency variant not in LANG_PRIORITY
      return -1000;
    }

    // LANG_PRIORITY order (or alias)
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
