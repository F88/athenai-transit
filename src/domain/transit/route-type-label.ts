/**
 * Return a single-character abbreviation for the given GTFS route_type.
 *
 * Used for compact display where space is limited (e.g. simple-mode
 * stop icons, edge markers).
 *
 * @param routeType - GTFS route_type value.
 * @returns Single-character label string.
 */
export function routeTypeLabel(routeType: number): string {
  switch (routeType) {
    case 0:
      return 'T';
    case 1:
      return 'M';
    case 3:
      return 'B';
    default:
      return '駅';
  }
}
