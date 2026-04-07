import type { Stop } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import type { ResolvedDisplayNames } from './get-display-names';
import { resolveDisplayNamesWithTranslatableText } from './i18n/resolve-display-names-with-translatable-text';

/**
 * Compute the display names for a stop.
 *
 * Delegates to {@link resolveDisplayNamesWithTranslatableText} for
 * language resolution and subNames sorting/deduplication. This is the
 * simplest reference implementation of the pattern — a single
 * translatable field with fallback chain support.
 *
 * @param stop - The stop to compute names for.
 * @param lang - Language fallback chain for primary name resolution.
 * @param agencyLang - Agency languages used as sub-name sort priority.
 * @returns Primary name and filtered sub-names.
 *
 * @example
 * ```ts
 * const { name, subNames } = getStopDisplayNames(stop);
 * // name: "曙橋"
 * // subNames: ["あけぼのばし", "Akebonobashi"]
 *
 * const { name } = getStopDisplayNames(stop, 'en');
 * // name: "Akebonobashi"
 * ```
 */
export function getStopDisplayNames(
  stop: Stop,
  lang?: string | readonly string[],
  agencyLang: readonly string[] = DEFAULT_AGENCY_LANG,
): ResolvedDisplayNames {
  // Normalize the primary-name fallback chain for the shared resolver.
  const preferredDisplayLangs = lang == null ? [] : typeof lang === 'string' ? [lang] : lang;
  // Stop subNames follow agency language priority when ordering candidates.
  const subNamePriorityLangs = agencyLang;
  const resolved = resolveDisplayNamesWithTranslatableText(
    { name: stop.stop_name, names: stop.stop_names },
    preferredDisplayLangs,
    subNamePriorityLangs,
  );
  return resolved;
}
