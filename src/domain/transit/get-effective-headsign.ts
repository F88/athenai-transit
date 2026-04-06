import type { RouteDirection } from '../../types/app/transit-composed';

/**
 * Get the effective headsign string from a RouteDirection.
 *
 * Per GTFS spec, `stop_headsign` overrides `trip_headsign` when present.
 * This is the non-display equivalent of the `name` field returned by
 * {@link getHeadsignDisplayNames} — a raw string without language
 * resolution, intended for grouping keys, filter comparisons,
 * React keys, and callback arguments.
 *
 * Uses `||` (not `??`) intentionally: the pipeline never produces
 * `TranslatableText` with an empty `name` and non-empty `names`,
 * so empty `name` always means "absent" and should fall through.
 * This keeps parity with {@link getHeadsignDisplayNames} which
 * uses the same truthy check (`stopName?.name`) for its prefer
 * resolution.
 *
 * @param routeDirection - Route direction context.
 * @returns The effective headsign string. May be empty when both
 *   trip_headsign and stop_headsign are absent.
 */
export function getEffectiveHeadsign(routeDirection: RouteDirection): string {
  return routeDirection.stopHeadsign?.name || routeDirection.tripHeadsign.name;
}
