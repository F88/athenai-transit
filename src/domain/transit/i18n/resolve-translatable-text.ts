import type { TranslatableText } from '../../../types/app/transit-composed';

const RESERVED_ORIGIN_KEY = 'origin';

function isOriginKey(key: string): boolean {
  return key.toLowerCase() === RESERVED_ORIGIN_KEY;
}

function findMatchingTranslation(
  names: Record<string, string>,
  preferredLang: string,
): { key: string; value: string } | undefined {
  const preferredLangLower = preferredLang.toLowerCase();
  for (const [key, value] of Object.entries(names)) {
    if (!isOriginKey(key) && key.toLowerCase() === preferredLangLower) {
      return { key, value };
    }
  }
  return undefined;
}

/**
 * Result of {@link resolveTranslatableText}.
 */
export interface ResolvedTranslatableText {
  /**
   * The resolved display value with its language key.
   *
   * - When `preferredLangs` contains a matching language entry:
   *   `{ lang: <matched preferred lang>, value: <translation> }`
   * - When no preferred language matches, or `data.names` is empty:
   *   `{ lang: 'origin', value: data.name }`
   *
   * `resolved.lang === 'origin'` indicates the raw source value was used
   * (either by default or as fallback).
   */
  resolved: { lang: string; value: string };
  /**
   * Remaining entries after resolving the primary language.
   *
   * Construction rules:
   * - The resolved language key is excluded.
   * - Entries are excluded by key, not by value. A different key may
   *   remain in `others` even when its value matches `resolved.value`.
   * - Empty-string translations are preserved.
   * - Keys that equal `'origin'` case-insensitively are never copied from
   *   `data.names`.
   * - When `resolved.lang !== 'origin'`, `others.origin` is synthesized
   *   from `data.name`, even when `data.name === ''`.
   * - If multiple keys differ only by case, the first one wins and later
   *   case variants are excluded.
   *
   * **Reserved key**: `others.origin` always represents `data.name`.
   * Any `data.names.origin` entry is ignored.
   */
  others: Record<string, string>;
}

/**
 * Resolve a {@link TranslatableText} using an ordered language preference chain.
 *
 * Selects the best display value based on `preferredLangs`, then returns
 * all remaining language-keyed values as `others` for the caller to
 * use as needed.
 *
 * The `'origin'` key is reserved for `data.name` (the raw source value).
 * If `data.names` contains an `'origin'` key, `data.name` takes priority.
 * The reserved keyword is the exact lowercase string `'origin'`.
 *
 * Language lookup is **case-insensitive** per BCP 47 (RFC 5646 §2.1.1).
 * `"ja-Hrkt"` matches a key `"ja-HrKt"` in `data.names`.
 * If `data.names` contains duplicate keys that differ only in case
 * (e.g. both `"ja-Hrkt"` and `"ja-HrKt"`), the first match is used
 * and the duplicate is ignored.
 *
 * `others` preserves non-resolved translations even when they have the
 * same string value as `resolved.value`. Value-based deduplication is
 * intentionally left to higher-level display helpers.
 * Empty-string translations are preserved as explicit values. If a
 * preferred language matches a key whose value is `""`, that empty
 * string is resolved as the primary value instead of falling back.
 *
 * @param data - The translatable source data to resolve.
 * @param preferredLangs - Ordered BCP 47-ish language fallback chain
 *                         (e.g. `["en"]`, `["zh-Hant", "zh-Hans", "en"]`).
 *                         The array is evaluated from first to last, and
 *                         the first matching language is selected.
 *                         Falls back to raw `data.name` when no match is found.
 * @returns Resolved value with lang key, and remaining values.
 *
 * @example
 * ```ts
 * const t = { name: 'A', names: { en: 'A-en', de: 'A-de' } };
 *
 * resolveTranslatableText(t, ['en']);
 * // { resolved: { lang: 'en', value: 'A-en' },
 * //   others: { origin: 'A', de: 'A-de' } }
 *
 * resolveTranslatableText(t, ['ko']);
 * // { resolved: { lang: 'origin', value: 'A' },
 * //   others: { en: 'A-en', de: 'A-de' } }
 * ```
 */
export function resolveTranslatableText(
  data: Readonly<TranslatableText>,
  preferredLangs: readonly string[],
): ResolvedTranslatableText {
  // Case-insensitive lookup: BCP 47 subtags are case-insensitive
  // per RFC 5646 §2.1.1 (e.g. "ja-Hrkt" and "ja-HrKt" should match).
  // Try each language in the chain until a translation is found.
  // 'origin' is a reserved key — if encountered at any position in the
  // chain, resolve immediately to data.name without looking up data.names.
  let matchedLang: string | undefined;
  let translation: string | undefined;
  for (const preferredLang of preferredLangs) {
    if (isOriginKey(preferredLang)) {
      break; // Fall through to origin resolution below
    }
    const match = findMatchingTranslation(data.names, preferredLang);
    if (match !== undefined) {
      matchedLang = preferredLang;
      translation = match.value;
      break;
    }
  }
  const resolved =
    translation != null
      ? { lang: matchedLang!, value: translation }
      : { lang: 'origin', value: data.name };

  // Build others: all translations except the resolved language key.
  // Deduplicate by lowercase key to prevent case-variant duplicates
  // (e.g. "ja-Hrkt" and "ja-HrKt") from appearing twice.
  // Values are never compared — value deduplication is the caller's
  // responsibility (e.g. resolveDisplayNamesWithTranslatableText).
  // 'origin' always maps to text.name, overwriting any 'origin' in text.names.
  const others: Record<string, string> = {};
  const seen = new Set<string>();
  if (matchedLang) {
    seen.add(matchedLang.toLowerCase());
  }
  seen.add(RESERVED_ORIGIN_KEY);
  for (const [key, value] of Object.entries(data.names)) {
    const keyLower = key.toLowerCase();
    if (!seen.has(keyLower)) {
      others[key] = value;
      seen.add(keyLower);
    }
  }
  // Add origin (data.name) only when resolved is NOT origin.
  // When resolved is origin, data.name is already the resolved value.
  if (resolved.lang !== RESERVED_ORIGIN_KEY) {
    others['origin'] = data.name;
  }

  return { resolved, others };
}
