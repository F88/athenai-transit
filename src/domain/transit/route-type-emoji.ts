/**
 * Return an emoji representing the given GTFS route_type.
 *
 * 0: tram, 1: subway, 2: rail, 3: bus, 4: ferry,
 * 5: cable tram, 6: gondola, 7: funicular
 */
export function routeTypeEmoji(routeType: number): string {
  switch (routeType) {
    case 0:
      return '🚊';
    case 1:
      return '🚇';
    case 2:
      return '🚆';
    case 3:
      return '🚌';
    case 4:
      return '⛴️';
    case 5:
      return '🚋';
    case 6:
      return '🚡';
    case 7:
      return '🚞';
    default:
      return '🛸';
  }
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
