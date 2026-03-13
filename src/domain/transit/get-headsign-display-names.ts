import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { createInfoLevel } from '../../utils/create-info-level';
import { translateHeadsign } from './i18n/translate-headsign';

/**
 * Result of {@link getHeadsignDisplayNames}.
 */
export interface HeadsignDisplayNames {
  /** Primary display name resolved for the requested language. */
  name: string;
  /**
   * Alternative names (translations) to show below the primary name.
   * Empty array when infoLevel is below "normal" or no alternatives exist.
   *
   * Currently always empty — will be populated when `translateHeadsign`
   * is implemented and headsign translations are added to the data pipeline.
   */
  subNames: string[];
}

/**
 * Compute display names for a headsign based on info level and language.
 *
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
 * @param headsign - Raw headsign string from timetable data.
 * @param route - Route used for fallback name resolution.
 * @param infoLevel - Current info verbosity level.
 * @param lang - Optional language key for i18n translation (future).
 * @returns Primary name and sub-names.
 *
 * @example
 * ```ts
 * getHeadsignDisplayNames('新宿駅西口', route, 'normal');
 * // { name: '新宿駅西口', subNames: [] }
 *
 * getHeadsignDisplayNames('', busRoute, 'normal');
 * // { name: '', subNames: [] }  — caller decides fallback
 * ```
 */
export function getHeadsignDisplayNames(
  headsign: string,
  route: Route,
  infoLevel: InfoLevel,
  lang?: string,
): HeadsignDisplayNames {
  const name = translateHeadsign(headsign, lang);

  const info = createInfoLevel(infoLevel);

  // subNames: multilingual alternatives, only at normal+.
  // Currently always empty — will be populated when headsign
  // translations (translations.txt field_name=trip_headsign)
  // are processed by the pipeline.
  const subNames: string[] = [];
  void info; // Will be used for subNames filtering when translations are available
  void route; // Will be used for headsign translation lookup when available

  return { name, subNames };
}
