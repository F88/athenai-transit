import type { RouteDirection } from '../../types/app/transit-composed';
import type { ResolvedDisplayNames } from './get-display-names';
import { resolveDisplayNamesWithTranslatableText } from './i18n/resolve-display-names-with-translatable-text';

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
 * @param prefer - Which headsign to use as effective. Defaults to `'stop'`
 *   (per GTFS spec: stop_headsign overrides trip_headsign).
 * @param lang - Language key to resolve for.
 * @param agencyLang - Agency languages for subNames sort priority.
 * @returns Effective headsign, plus individual trip/stop resolved names.
 */
export function getHeadsignDisplayNames(
  routeDirection: RouteDirection,
  prefer: HeadsignSource = 'stop',
  lang: string,
  agencyLang: readonly string[],
): HeadsignDisplayNames {
  const tripName = resolveDisplayNamesWithTranslatableText(
    routeDirection.tripHeadsign,
    lang,
    agencyLang,
  );
  const stopName = routeDirection.stopHeadsign
    ? resolveDisplayNamesWithTranslatableText(routeDirection.stopHeadsign, lang, agencyLang)
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
