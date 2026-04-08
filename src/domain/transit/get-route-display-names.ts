import type { Route } from '../../types/app/transit';
import type { ResolvedDisplayNames } from './get-display-names';
import { resolveDisplayNamesWithTranslatableText } from './i18n/resolve-display-names-with-translatable-text';

/**
 * Route name source type.
 *
 * - `'short'` — route_short_name and route_short_names
 * - `'long'` — route_long_name and route_long_names
 */
export type RouteSource = 'short' | 'long';

/**
 * Result of {@link getRouteDisplayNames}.
 */
export interface RouteDisplayNames {
  /** Effective route name resolved by `prefer` strategy. */
  resolved: ResolvedDisplayNames;
  /** Which source was used for `resolved`. */
  resolvedSource: RouteSource;
  /** route_short_name resolved for the requested language chain. */
  shortName: ResolvedDisplayNames;
  /** route_long_name resolved for the requested language chain. */
  longName: ResolvedDisplayNames;
}

/**
 * Compute display names for a route based on preference.
 *
 * Resolves `route_short_name` and `route_long_name` independently via
 * {@link resolveDisplayNamesWithTranslatableText}, then selects the effective
 * one based on `prefer`. Each source keeps its own `subNames`; they are never mixed.
 *
 * GTFS data populates these fields differently by transit type:
 *   - Bus: `route_short_name` only (e.g. "都01")
 *   - Train: `route_long_name` only (e.g. "大江戸線")
 *   - Some: both (e.g. short="E", long="大江戸線")
 *
 * @param route - The route to compute names for.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary display resolution.
 * @param agencyLangs - Agency languages for subNames sort priority.
 * @param prefer - Which route source to use as primary. Defaults to `'short'`.
 * @returns Effective route display names, plus individual short/long resolved names.
 *
 * @example
 * ```ts
 * // Bus: short only
 * getRouteDisplayNames(busRoute, [], ['ja']);
 * // { resolved: { name: "都01", subNames: [] }, resolvedSource: 'short', ... }
 *
 * // Train: long only
 * getRouteDisplayNames(trainRoute, [], ['ja']);
 * // { resolved: { name: "大江戸線", subNames: [] }, resolvedSource: 'long', ... }
 *
 * // Both names, prefer short
 * getRouteDisplayNames(bothRoute, [], ['ja']);
 * // { resolved: { name: "E", subNames: [] }, resolvedSource: 'short', ... }
 *
 * // Both names, prefer long
 * getRouteDisplayNames(bothRoute, [], ['ja'], 'long');
 * // { resolved: { name: "大江戸線", subNames: [] }, resolvedSource: 'long', ... }
 * ```
 */
export function getRouteDisplayNames(
  route: Readonly<Route>,
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
  prefer: RouteSource = 'short',
): RouteDisplayNames {
  const shortName = resolveDisplayNamesWithTranslatableText(
    { name: route.route_short_name, names: route.route_short_names },
    preferredDisplayLangs,
    agencyLangs,
  );
  const longName = resolveDisplayNamesWithTranslatableText(
    { name: route.route_long_name, names: route.route_long_names },
    preferredDisplayLangs,
    agencyLangs,
  );

  let resolved: ResolvedDisplayNames;
  let resolvedSource: RouteSource;

  if (prefer === 'long') {
    if (longName.name) {
      resolved = longName;
      resolvedSource = 'long';
    } else if (shortName.name) {
      resolved = shortName;
      resolvedSource = 'short';
    } else {
      resolved = { name: route.route_id, subNames: [] };
      resolvedSource = 'long';
    }
  } else {
    if (shortName.name) {
      resolved = shortName;
      resolvedSource = 'short';
    } else if (longName.name) {
      resolved = longName;
      resolvedSource = 'long';
    } else {
      resolved = { name: route.route_id, subNames: [] };
      resolvedSource = 'short';
    }
  }

  return { resolved, resolvedSource, shortName, longName };
}
