import type { InfoLevel } from '../../types/app/settings';
import type { Stop } from '../../types/app/transit';
import { createInfoLevel } from '../../utils/create-info-level';
import type { ResolvedDisplayNames } from './get-display-names';
import { translateStopName } from './i18n/translate-stop-name';

/**
 * Compute the display names for a stop based on info level and language.
 *
 * Consolidates the repeated pattern of:
 * 1. Resolving the primary name for a language
 * 2. Extracting sub-names filtered by infoLevel
 *
 * Sub-names are shown at "normal" level and above. At "simple" level
 * the array is always empty.
 *
 * @param stop - The stop to compute names for.
 * @param infoLevel - Current info verbosity level.
 * @param lang - Optional language key for primary name resolution.
 * @returns Primary name and filtered sub-names.
 *
 * @example
 * ```ts
 * const { name, subNames } = getStopDisplayNames(stop, 'normal');
 * // name: "曙橋"
 * // subNames: ["あけぼのばし", "Akebonobashi"]
 *
 * const { name, subNames } = getStopDisplayNames(stop, 'simple');
 * // name: "曙橋"
 * // subNames: []
 *
 * const { name } = getStopDisplayNames(stop, 'normal', 'en');
 * // name: "Akebonobashi"
 * ```
 */
export function getStopDisplayNames(
  stop: Stop,
  infoLevel: InfoLevel,
  lang?: string | readonly string[],
): ResolvedDisplayNames {
  const name = translateStopName(stop, lang);
  const info = createInfoLevel(infoLevel);

  if (!info.isNormalEnabled) {
    return { name, subNames: [] };
  }

  // Collect alternative names, excluding the resolved primary name
  // to avoid showing the same name twice.
  // When lang is omitted, name === stop_name so this matches the
  // original getSubNames behavior. When lang is specified (e.g. 'en'),
  // stop_name ('曙橋') is kept as a subName since it differs from name.
  const subNames = [
    ...new Set(Object.values(stop.stop_names).filter((value) => value && value !== name)),
  ];

  return { name, subNames };
}
