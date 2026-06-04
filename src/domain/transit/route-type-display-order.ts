import type { AppRouteTypeValue } from '../../types/app/transit';

/**
 * Single source of truth for the display-priority order of GTFS `route_type`
 * values across the app. Lower index = higher priority.
 *
 * Intended consumers (to be wired up): the data-source settings dialog section
 * order, the StopBrowser header's route-type filter chips, and the transit-info
 * display grouping (one display per route type).
 *
 * Covers every {@link AppRouteTypeValue} so consumers that filter by this order
 * never drop a present route type.
 */
export const ROUTE_TYPE_DISPLAY_ORDER: readonly AppRouteTypeValue[] = [
  3, // Bus
  11, // Trolleybus
  0, // Tram
  2, // Rail
  1, // Subway
  12, // Monorail
  4, // Ferry
  5, // Cable tram
  6, // Gondola
  7, // Funicular
  -1, // Unknown
];
