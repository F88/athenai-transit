import type { TranslatableText } from '../../../types/app/transit-composed';

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
   * All available values except the resolved one, keyed by language.
   *
   * `text.name` is included under the reserved key `'origin'`.
   * Translation entries from `text.names` are included under their
   * language keys. Entries whose value matches `resolved.value`
   * are excluded to avoid duplication.
   *
   * **Reserved key**: `'origin'` is always `text.name`. If `text.names`
   * contains an `'origin'` key, it is overwritten by `text.name`.
   */
  others: Record<string, string>;
}

/**
 * Resolve a {@link TranslatableText} for a given language.
 *
 * Selects the best display value based on `lang`, then returns
 * all remaining values as `others` for the caller to use as needed.
 *
 * The `'origin'` key is reserved for `text.name` (the raw source value).
 * If `text.names` contains an `'origin'` key, `text.name` takes priority.
 *
 * Language lookup is **case-insensitive** per BCP 47 (RFC 5646 §2.1.1).
 * `"ja-Hrkt"` matches a key `"ja-HrKt"` in `text.names`.
 * If `text.names` contains duplicate keys that differ only in case
 * (e.g. both `"ja-Hrkt"` and `"ja-HrKt"`), the first match is used
 * and the duplicate is ignored.
 *
 * @param text - The translatable text to resolve.
 * @param lang - BCP 47-ish language key (e.g. `"en"`, `"ja-Hrkt"`).
 *               Falls back to raw `text.name` when not found.
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
  lang: string,
): ResolvedTranslatableText {
  // 'origin' is an internal reserved key for text.name.
  // If lang='origin' is passed, always return text.name directly
  // without looking up text.names (even if it contains an 'origin' key).
  if (lang === 'origin') {
    const others: Record<string, string> = {};
    const seen = new Set<string>(['origin']);
    for (const [key, value] of Object.entries(text.names)) {
      const keyLower = key.toLowerCase();
      if (seen.has(keyLower)) {
        continue;
      }
      seen.add(keyLower);
      if (value && value !== text.name) {
        others[key] = value;
      }
    }
    return { resolved: { lang: 'origin', value: text.name }, others };
  }

  // Case-insensitive lookup: BCP 47 subtags are case-insensitive
  // per RFC 5646 §2.1.1 (e.g. "ja-Hrkt" and "ja-HrKt" should match).
  const langLower = lang.toLowerCase();
  const matchedKey = Object.keys(text.names).find((k) => k.toLowerCase() === langLower);
  const translation = matchedKey != null ? text.names[matchedKey] : undefined;
  const resolved =
    translation != null ? { lang, value: translation } : { lang: 'origin', value: text.name };

  // Build others: deduplicate by lowercase key to prevent case-variant
  // duplicates (e.g. "ja-Hrkt" and "ja-HrKt") from leaking into subNames.
  // 'origin' always maps to text.name, overwriting any 'origin' in text.names.
  const others: Record<string, string> = {};
  const seen = new Set<string>();
  // Mark the resolved language as seen so it's excluded from others.
  seen.add(langLower);
  seen.add('origin');
  for (const [key, value] of Object.entries(text.names)) {
    const keyLower = key.toLowerCase();
    if (!seen.has(keyLower) && value && value !== resolved.value) {
      others[key] = value;
      seen.add(keyLower);
    }
  }
  // Add origin (text.name) if it differs from resolved value.
  if (text.name && text.name !== resolved.value) {
    others['origin'] = text.name;
  }

  return { resolved, others };
}
