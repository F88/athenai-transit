import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { createInfoLevel } from '../../utils/create-info-level';
import { translateRouteName } from './i18n/translate-route-name';

/**
 * Result of {@link getRouteDisplayNames}.
 */
export interface RouteDisplayNames {
  /** Primary display name resolved by `prefer` strategy. */
  name: string;
  /**
   * Alternative names (translations) to show below the primary name.
   * Empty array when infoLevel is below "normal" or no alternatives exist.
   * Semantically equivalent to {@link StopDisplayNames.subNames}.
   *
   * Currently always empty — will be populated when `route_names`
   * (translations.txt) is added to the {@link Route} type.
   */
  subNames: string[];
  /** `route_short_name`, translated if available. Empty string when not present. */
  shortName: string;
  /** `route_long_name`, translated for the requested language. Empty string when not present. */
  longName: string;
}

/**
 * Compute display names for a route based on info level and preference.
 *
 * Resolves a primary `name` from `route_short_name` and `route_long_name`
 * based on the `prefer` strategy. `subNames` will contain multilingual
 * alternatives when `route_names` translations are available (currently empty).
 *
 * GTFS data populates these fields differently by transit type:
 *   - Bus: `route_short_name` only (e.g. "都01")
 *   - Train: `route_long_name` only (e.g. "大江戸線")
 *   - Some: both (e.g. short="E", long="大江戸線")
 *
 * @param route - The route to compute names for.
 * @param infoLevel - Current info verbosity level.
 * @param prefer - Which name to use as primary. Defaults to `'short'`.
 * @param lang - Optional language key for i18n translation of long name.
 * @returns Primary name, sub-names, and raw translated values.
 *
 * @example
 * ```ts
 * // Bus: short only
 * getRouteDisplayNames(busRoute, 'normal');
 * // { name: "都01", subNames: [], shortName: "都01", longName: "" }
 *
 * // Train: long only
 * getRouteDisplayNames(trainRoute, 'normal');
 * // { name: "大江戸線", subNames: [], shortName: "", longName: "大江戸線" }
 *
 * // Both names, prefer short
 * getRouteDisplayNames(bothRoute, 'normal');
 * // { name: "E", subNames: [], shortName: "E", longName: "大江戸線" }
 *
 * // Both names, prefer long
 * getRouteDisplayNames(bothRoute, 'normal', 'long');
 * // { name: "大江戸線", subNames: [], shortName: "E", longName: "大江戸線" }
 * ```
 */
export function getRouteDisplayNames(
  route: Route,
  infoLevel: InfoLevel,
  prefer: 'short' | 'long' = 'short',
  lang?: string,
): RouteDisplayNames {
  const translated = translateRouteName(route, lang);
  const { shortName, longName } = translated;

  // Resolve primary name based on prefer strategy.
  // Falls back to the other field, then route_id as last resort.
  const name =
    prefer === 'long'
      ? longName || shortName || route.route_id
      : shortName || longName || route.route_id;

  const info = createInfoLevel(infoLevel);

  // subNames: multilingual alternatives, only at normal+.
  // Currently always empty — will be populated when route_names
  // (translations.txt) is added to the Route type.
  const subNames: string[] = [];
  void info; // Will be used for subNames filtering when translations are available

  return { name, subNames, shortName, longName };
}
