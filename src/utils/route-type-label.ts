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
    case 2:
      return 'R';
    case 1:
      return 'M';
    case 3:
      return 'B';
    case 4:
      return 'F';
    case 5:
      return 'C';
    case 6:
      return 'G';
    case 7:
      return 'F';
    case 11:
      return 'T';
    case 12:
      return 'M';
    default:
      return '?';
  }
}
