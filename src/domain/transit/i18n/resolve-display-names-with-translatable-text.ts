import type { TranslatableText } from '../../../types/app/transit-composed';
import type { ResolvedDisplayNames } from '../get-display-names';
import { sortLangKeysByPriority } from './lang-priority';
import { resolveTranslatableText } from './resolve-translatable-text';

/**
 * Resolve a single {@link TranslatableText} into a primary display name
 * and deduplicated alternative names for UI rendering.
 *
 * Combines language resolution ({@link resolveTranslatableText}) and
 * display formatting into one call. Suitable for entities with a
 * single translatable field (e.g. stop name).
 *
 * `subNames` are sorted by {@link sortLangKeysByPriority} using
 * `agencyLang` as the preferred languages, then deduplicated.
 *
 * For entities with multiple translatable fields (e.g. headsign with
 * trip/stop, route with short/long), callers should use
 * {@link resolveTranslatableText} directly for each field and build
 * the display result themselves.
 *
 * @param text - The translatable text to resolve.
 * @param lang - Language key to resolve the primary name for.
 * @param agencyLang - Agency languages for subNames sort priority.
 * @returns Primary name and deduplicated alternative names.
 *
 * @example
 * ```ts
 * resolveDisplayNamesWithTranslatableText(
 *   { name: 'A', names: { en: 'A-en', de: 'A-de' } }, 'en', ['ja'],
 * );
 * // { name: 'A-en', subNames: ['A', 'A-de'] }
 * ```
 */
export function resolveDisplayNamesWithTranslatableText(
  text: TranslatableText,
  lang: string,
  agencyLang: readonly string[],
): ResolvedDisplayNames {
  const { resolved, others } = resolveTranslatableText(text, lang);
  const subNames = [
    ...new Set(sortLangKeysByPriority(Object.keys(others), agencyLang).map((k) => others[k])),
  ];
  return { name: resolved.value, subNames };
}
