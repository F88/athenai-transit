import type { Stop } from '../../../types/app/transit';
import type { ResolvedDisplayNames } from './get-display-names';
import { resolveDisplayNamesWithTranslatableText } from '../i18n/resolve-display-names-with-translatable-text';

/**
 * Compute the display names for a stop.
 *
 * Delegates to {@link resolveDisplayNamesWithTranslatableText} for
 * language resolution and subNames sorting/deduplication. This is the
 * simplest reference implementation of the pattern — a single
 * translatable field with fallback chain support.
 *
 * @param stop - The stop to compute names for.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary name resolution.
 * @param agencyLangs - Agency languages used as sub-name sort priority.
 * @returns Primary name and filtered sub-names.
 *
 * @example
 * ```ts
 * const { name, subNames } = getStopDisplayNames(stop, [], ['ja']);
 * // name: "曙橋"
 * // subNames: ["あけぼのばし", "Akebonobashi"]
 *
 * const { name } = getStopDisplayNames(stop, ['en'], ['ja']);
 * // name: "Akebonobashi"
 * ```
 */
export function getStopDisplayNames(
  stop: Readonly<Stop>,
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
): ResolvedDisplayNames {
  const resolved = resolveDisplayNamesWithTranslatableText(
    { name: stop.stop_name, names: stop.stop_names },
    preferredDisplayLangs,
    agencyLangs,
  );
  return resolved;
}
