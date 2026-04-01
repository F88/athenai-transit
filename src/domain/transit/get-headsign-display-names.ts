import type { InfoLevel } from '../../types/app/settings';
import type { RouteDirection } from '../../types/app/transit-composed';
import { createInfoLevel } from '../../utils/create-info-level';
import { translateHeadsign } from './i18n/translate-headsign';

/**
 * Result of {@link getHeadsignDisplayNames}.
 */
export interface HeadsignDisplayNames {
  /** Primary display name resolved for the requested language. */
  name: string;
  /**
   * Alternative names (readings, translations) to show below the primary name.
   * Empty array when infoLevel is below "normal" or no alternatives exist.
   * Values only — language keys are stripped for display simplicity.
   */
  subNames: string[];
}

/**
 * Compute display names for a headsign based on info level and language.
 *
 * GTFS `trip_headsign` is a single string field with no short/long variants.
 * Some GTFS sources (e.g. Keio Bus) omit it entirely.
 *
 * This resolver does NOT fall back to route names — `name` can be empty.
 * Callers that need a non-empty label (e.g. timetable filter buttons where
 * no RouteBadge is shown) should fall back to route names themselves:
 *
 * ```ts
 * result.name || route.route_short_name || route.route_long_name || route.route_id
 * ```
 *
 * Callers that already display a RouteBadge can conditionally render:
 *
 * ```ts
 * {result.name && <span>{result.name}</span>}
 * ```
 *
 * Sub-names are extracted from `routeDirection.headsign_names` (GTFS
 * translations.txt for trip_headsign). Values that match the primary
 * name are excluded. Sub-names are shown at "normal" level and above.
 *
 * @param routeDirection - Route direction context containing headsign
 *   and headsign_names translations.
 * @param infoLevel - Current info verbosity level.
 * @param lang - Optional language key for primary name resolution (future).
 * @returns Primary name and sub-names.
 *
 * @example
 * ```ts
 * getHeadsignDisplayNames(routeDirection, 'normal');
 * // { name: '新橋駅前', subNames: ['しんばしえきまえ', 'Shimbashi Sta.'] }
 *
 * getHeadsignDisplayNames(emptyHeadsignDirection, 'normal');
 * // { name: '', subNames: [] }  — caller decides fallback
 * ```
 */
export function getHeadsignDisplayNames(
  routeDirection: RouteDirection,
  infoLevel: InfoLevel,
  lang?: string,
): HeadsignDisplayNames {
  const name = translateHeadsign(routeDirection.headsign, routeDirection.headsign_names, lang);
  const info = createInfoLevel(infoLevel);

  if (!info.isNormalEnabled) {
    return { name, subNames: [] };
  }

  // Collect alternative names from headsign_names translations,
  // excluding the primary name to avoid showing the same text twice.
  // Follows the same pattern as getStopDisplayNames.
  const subNames = [
    ...new Set(
      Object.values(routeDirection.headsign_names).filter((value) => value && value !== name),
    ),
  ];

  return { name, subNames };
}
