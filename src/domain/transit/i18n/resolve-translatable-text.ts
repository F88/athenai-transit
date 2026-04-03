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
   * - When `lang` is omitted, not found, or `text.names` is empty:
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
  const translation = text.names[lang];
  const resolved =
    translation != null ? { lang, value: translation } : { lang: 'origin', value: text.name };

  // 'origin' is reserved for text.name. Spread text.names first,
  // then overwrite with text.name to ensure origin always wins.
  const all: Record<string, string> = { ...text.names, origin: text.name };
  const others: Record<string, string> = {};
  for (const [key, value] of Object.entries(all)) {
    if (value && value !== resolved.value) {
      others[key] = value;
    }
  }

  return { resolved, others };
}
