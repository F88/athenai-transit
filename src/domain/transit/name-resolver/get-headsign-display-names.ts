import type { RouteDirection } from '../../../types/app/transit-composed';
import type { ResolvedDisplayNames } from '../get-display-names';
import { resolveDisplayNamesWithTranslatableText } from '../i18n/resolve-display-names-with-translatable-text';

/**
 * Headsign source type.
 *
 * - `'stop'` — stop_headsign (GTFS default; overrides trip_headsign).
 * - `'trip'` — trip_headsign; falls back to stop_headsign.
 */
export type HeadsignSource = 'stop' | 'trip';

/**
 * Result of {@link getHeadsignDisplayNames}.
 */
export interface HeadsignDisplayNames {
  /** Effective headsign resolved by `prefer` strategy. */
  resolved: ResolvedDisplayNames;
  /** Which source was used for `resolved`. */
  resolvedSource: HeadsignSource;
  /** trip_headsign resolved for the requested language. */
  tripName: ResolvedDisplayNames;
  /** stop_headsign resolved for the requested language. Undefined when not provided. */
  stopName?: ResolvedDisplayNames;
}

/**
 * Compute display names for headsigns based on preference.
 *
 * Resolves trip_headsign and stop_headsign independently via
 * {@link resolveDisplayNamesWithTranslatableText}, then selects
 * the effective one based on `prefer`. Each headsign's `subNames`
 * are resolved from its own translations — they are never mixed.
 *
 * @param routeDirection - Route direction context containing headsigns.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary display resolution.
 * @param agencyLangs - Agency languages for subNames sort priority.
 * @param prefer - Which headsign to use as effective. Defaults to `'stop'`
 *   (per GTFS spec: stop_headsign overrides trip_headsign).
 * @returns Effective headsign, plus individual trip/stop resolved names.
 */
export function getHeadsignDisplayNames(
  routeDirection: Readonly<RouteDirection>,
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
  prefer: HeadsignSource = 'stop',
): HeadsignDisplayNames {
  const tripName = resolveDisplayNamesWithTranslatableText(
    routeDirection.tripHeadsign,
    preferredDisplayLangs,
    agencyLangs,
  );
  const stopName = routeDirection.stopHeadsign
    ? resolveDisplayNamesWithTranslatableText(
        routeDirection.stopHeadsign,
        preferredDisplayLangs,
        agencyLangs,
      )
    : undefined;

  let resolved: ResolvedDisplayNames;
  let resolvedSource: HeadsignSource;

  if (prefer === 'trip') {
    if (tripName.name) {
      resolved = tripName;
      resolvedSource = 'trip';
    } else if (stopName) {
      resolved = stopName;
      resolvedSource = 'stop';
    } else {
      resolved = tripName;
      resolvedSource = 'trip';
    }
  } else {
    // Truthy check (not nullish): the pipeline never produces empty `name`
    // with non-empty translations, so empty `name` means "absent".
    // This keeps parity with getEffectiveHeadsign which uses `||`.
    if (stopName?.name) {
      resolved = stopName;
      resolvedSource = 'stop';
    } else {
      resolved = tripName;
      resolvedSource = 'trip';
    }
  }

  return { resolved, resolvedSource, tripName, stopName };
}

/**
 * Resolve the display name corresponding to a selected raw headsign key.
 *
 * `selectedHeadsign` is typically the raw value used for grouping or filtering
 * (for example, {@link getEffectiveHeadsign}). This function preserves that
 * selection semantics by matching the raw key against `stop_headsign` and
 * `trip_headsign`, then returning the display-resolved name for the matched
 * source.
 *
 * When both raw values are equal, `stop_headsign` is preferred to keep parity
 * with GTFS effective headsign behavior.
 *
 * @param routeDirection - Route direction context containing headsigns.
 * @param selectedHeadsign - Raw headsign key already selected by the caller.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary display resolution.
 * @param agencyLangs - Agency languages for subNames sort priority.
 * @returns The display-resolved name for the matching source, or the raw headsign when no source matches.
 */
export function getSelectedHeadsignDisplayName(
  routeDirection: Readonly<RouteDirection>,
  selectedHeadsign: string,
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
): string {
  const names = getHeadsignDisplayNames(routeDirection, preferredDisplayLangs, agencyLangs, 'stop');

  if (routeDirection.stopHeadsign?.name === selectedHeadsign) {
    return names.stopName?.name || selectedHeadsign;
  }

  if (routeDirection.tripHeadsign.name === selectedHeadsign) {
    return names.tripName.name || selectedHeadsign;
  }

  return selectedHeadsign;
}
