import type { TranslatableText } from '../../../types/app/transit-composed';
import type { ResolvedDisplayNames } from '../name-resolver/get-display-names';
import { buildNamesByLangPriority } from './build-names-by-lang-priority';
import { resolveTranslatableText } from './resolve-translatable-text';

/**
 * Resolve a single {@link TranslatableText} into a primary display name
 * and filtered alternative names for UI rendering.
 *
 * This wrapper performs 3 steps:
 * 1. Resolve the primary display name with
 *    {@link resolveTranslatableText}.
 * 2. Build ordered candidate sub-names from the remaining keyed names
 *    with {@link buildNamesByLangPriority}.
 * 3. Remove any candidate whose value matches the resolved primary
 *    name.
 *
 * Suitable for entities with a single translatable field (e.g. stop
 * name).
 *
 * `preferredDisplayLangs` is an ordered fallback chain for resolving the
 * primary display name. Entries are tried from first to last, and the
 * first matching language is used.
 *
 * `subNamePriorityLangs` is an ordered language priority list for
 * sorting `subNames`. Earlier entries have higher priority.
 *
 * `subNames` are built from `resolveTranslatableText(...).others`.
 * `buildNamesByLangPriority` determines candidate order and value
 * deduplication. This wrapper then applies the final filter:
 * values equal to the resolved primary name are excluded from the
 * returned `subNames`.
 *
 * For entities with multiple translatable fields (e.g. headsign with
 * trip/stop, route with short/long), callers should use
 * {@link resolveTranslatableText} directly for each field and build
 * the display result themselves.
 *
 * @param data - The translatable source data to resolve.
 * @param preferredDisplayLangs - Ordered language fallback chain used to resolve the primary name.
 * The array is evaluated from first to last, and the first matching
 * language is selected.
 * @param subNamePriorityLangs - Ordered language priority list used to sort `subNames`.
 * Earlier entries have higher priority in the final sub-name ordering.
 * @returns Primary name and filtered alternative names.
 *
 * @example
 * ```ts
 * resolveDisplayNamesWithTranslatableText(
 *   { name: 'A', names: { en: 'A-en', de: 'A-de' } }, ['en'], ['ja'],
 * );
 * // { name: 'A-en', subNames: ['A', 'A-de'] }
 *
 * resolveDisplayNamesWithTranslatableText(
 *   { name: 'A', names: { en: 'A', fr: 'B' } }, ['en'], ['fr'],
 * );
 * // { name: 'A', subNames: ['B'] }
 * ```
 */
export function resolveDisplayNamesWithTranslatableText(
  data: Readonly<TranslatableText>,
  preferredDisplayLangs: readonly string[],
  subNamePriorityLangs: readonly string[],
): ResolvedDisplayNames {
  // Resolve primary name with language fallback
  const { resolved, others } = resolveTranslatableText(data, preferredDisplayLangs);
  // Build ordered candidate subNames from the remaining keyed names
  const subNames = buildNamesByLangPriority(others, subNamePriorityLangs);
  // Exclude subNames that are identical to the resolved primary name
  const filteredSubNames = subNames.filter((value) => value !== resolved.value);

  return { name: resolved.value, subNames: filteredSubNames };
}
