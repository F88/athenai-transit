import type { TranslatableText } from '../../../types/app/transit-composed';

const RESERVED_ORIGIN_KEY = 'origin';

function isOriginKey(key: string): boolean {
  return key.toLowerCase() === RESERVED_ORIGIN_KEY;
}

function findMatchingTranslation(
  names: Record<string, string>,
  requestedLang: string,
): { key: string; value: string } | undefined {
  const requestedLangLower = requestedLang.toLowerCase();
  for (const [key, value] of Object.entries(names)) {
    if (!isOriginKey(key) && key.toLowerCase() === requestedLangLower) {
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
   * - When `lang` is provided and found in `text.names`:
   *   `{ lang: <requested lang>, value: <translation> }`
   * - When `lang` is not found in `text.names`, or `text.names` is empty:
   *   `{ lang: 'origin', value: text.name }`
   *
   * `lang === 'origin'` indicates the raw source value was used
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
   *   `text.names`.
   * - When `resolved.lang !== 'origin'`, `others.origin` is synthesized
   *   from `text.name`, even when `text.name === ''`.
   * - If multiple keys differ only by case, the first one wins and later
   *   case variants are excluded.
   *
   * **Reserved key**: `others.origin` always represents `text.name`.
   * Any `text.names.origin` entry is ignored.
   */
  others: Record<string, string>;
}

/**
 * Resolve a {@link TranslatableText} for a given language.
 *
 * Selects the best display value based on `lang`, then returns
 * all remaining language-keyed values as `others` for the caller to
 * use as needed.
 *
 * The `'origin'` key is reserved for `text.name` (the raw source value).
 * If `text.names` contains an `'origin'` key, `text.name` takes priority.
 * The reserved keyword is the exact lowercase string `'origin'`.
 *
 * Language lookup is **case-insensitive** per BCP 47 (RFC 5646 §2.1.1).
 * `"ja-Hrkt"` matches a key `"ja-HrKt"` in `text.names`.
 * If `text.names` contains duplicate keys that differ only in case
 * (e.g. both `"ja-Hrkt"` and `"ja-HrKt"`), the first match is used
 * and the duplicate is ignored.
 *
 * `others` preserves non-resolved translations even when they have the
 * same string value as `resolved.value`. Value-based deduplication is
 * intentionally left to higher-level display helpers.
 * Empty-string translations are preserved as explicit values. If a
 * requested language matches a key whose value is `""`, that empty
 * string is resolved as the primary value instead of falling back.
 *
 * @param text - The translatable text to resolve.
 * @param lang - BCP 47-ish language key or ordered fallback chain
 *               (e.g. `"en"`, `["zh-Hant", "zh-Hans", "en"]`).
 *               Falls back to raw `text.name` when no match is found.
 * @returns Resolved value with lang key, and remaining values.
 *
 * @example
 * ```ts
 * const t = { name: 'A', names: { en: 'A-en', de: 'A-de' } };
 *
 * resolveTranslatableText(t, 'en');
 * // { resolved: { lang: 'en', value: 'A-en' },
 * //   others: { origin: 'A', de: 'A-de' } }
 *
 * resolveTranslatableText(t, 'ko');
 * // { resolved: { lang: 'origin', value: 'A' },
 * //   others: { en: 'A-en', de: 'A-de' } }
 * ```
 */
export function resolveTranslatableText(
  text: TranslatableText,
  lang: string | readonly string[],
): ResolvedTranslatableText {
  // Normalize to array for uniform processing.
  const langs = typeof lang === 'string' ? [lang] : lang;

  // Case-insensitive lookup: BCP 47 subtags are case-insensitive
  // per RFC 5646 §2.1.1 (e.g. "ja-Hrkt" and "ja-HrKt" should match).
  // Try each language in the chain until a translation is found.
  // 'origin' is a reserved key — if encountered at any position in the
  // chain, resolve immediately to text.name without looking up text.names.
  let matchedLang: string | undefined;
  let translation: string | undefined;
  for (const l of langs) {
    if (l === RESERVED_ORIGIN_KEY) {
      break; // Fall through to origin resolution below
    }
    const match = findMatchingTranslation(text.names, l);
    if (match !== undefined) {
      matchedLang = l;
      translation = match.value;
      break;
    }
  }
  const resolved =
    translation != null
      ? { lang: matchedLang!, value: translation }
      : { lang: 'origin', value: text.name };

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
  for (const [key, value] of Object.entries(text.names)) {
    const keyLower = key.toLowerCase();
    if (!seen.has(keyLower)) {
      others[key] = value;
      seen.add(keyLower);
    }
  }
  // Add origin (text.name) only when resolved is NOT origin.
  // When resolved is origin, text.name is already the resolved value.
  if (resolved.lang !== RESERVED_ORIGIN_KEY) {
    others['origin'] = text.name;
  }

  return { resolved, others };
}
