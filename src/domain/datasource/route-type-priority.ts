import type { AppRouteTypeValue } from '../../types/app/transit';

/**
 * Display-order priority of GTFS route_type values used by the data-source
 * settings dialog.
 *
 * Lower index = higher priority. The dialog renders one section per entry
 * (in the order given here), listing every source group whose
 * {@link import('../../types/app/source-group').SourceGroup.routeTypes routeTypes}
 * field contains that value. Groups with multiple route_types therefore
 * appear in every matching section.
 *
 * Order rationale (user-chosen): bus is the most common mode in this app's
 * data, so it leads. The remaining values are ordered to roughly cluster
 * ground-rail (tram/rail/subway) before water (ferry) and niche surface
 * modes (cable tram, gondola, funicular, trolleybus, monorail).
 */
export const ROUTE_TYPE_PRIORITY: readonly AppRouteTypeValue[] = [
  3, // Bus
  0, // Tram
  2, // Rail
  1, // Subway
  4, // Ferry
  5, // Cable tram
  6, // Gondola
  7, // Funicular
  11, // Trolleybus
  12, // Monorail
] as const;

/**
 * Sentinel section key used when a source group has no route_type that
 * appears in {@link ROUTE_TYPE_PRIORITY}. The dialog renders an "other"
 * bucket at the end so such groups remain visible.
 */
export const ROUTE_TYPE_OTHER = 'other' as const;

/**
 * Section key for the data-source settings dialog. Either one of the
 * priority-ranked GTFS values, or the {@link ROUTE_TYPE_OTHER} sentinel.
 */
export type RouteTypeSectionKey = AppRouteTypeValue | typeof ROUTE_TYPE_OTHER;
