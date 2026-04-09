import { APP_ROUTE_TYPES } from '../config/route-types';

const UNKNOWN_ROUTE_TYPE_EMOJI = '🛸';

const ROUTE_TYPE_EMOJIS_BY_VALUE: Readonly<Record<number, string>> = APP_ROUTE_TYPES.reduce<
  Record<number, string>
>((acc, { value, emoji }) => {
  acc[value] = emoji;
  return acc;
}, {});

/**
 * Return an emoji representing the given GTFS route_type.
 *
 * Standard GTFS types: 0: tram, 1: subway, 2: rail, 3: bus, 4: ferry,
 * 5: cable tram, 6: gondola, 7: funicular.
 * Extended GTFS types: 11: trolleybus, 12: monorail.
 * Unknown types return UFO emoji.
 *
 * @param routeType - GTFS route_type value.
 * @returns Emoji for the given route type.
 */
export function routeTypeEmoji(routeType: number): string {
  return ROUTE_TYPE_EMOJIS_BY_VALUE[routeType] ?? UNKNOWN_ROUTE_TYPE_EMOJI;
}

/**
 * Emoji string for multiple route types (e.g. "🚊🚌").
 *
 * @param routeTypes - Array of GTFS route_type values.
 * @returns Concatenated emoji string.
 */
export function routeTypesEmoji(routeTypes: number[]): string {
  return routeTypes.map(routeTypeEmoji).join('');
}
