import type { DepartureGroup, FlatDeparture } from '../../types/app/transit';

/**
 * Flatten departure groups into a single chronologically sorted list.
 *
 * Used by the T1 (Stop) view to display all departures regardless of
 * route or headsign grouping. References to route, headsign, and
 * departure Date objects are shared (not copied) for memory efficiency.
 *
 * Sort order: departure time (ascending), then route_type (ascending),
 * then route_id (ascending) for deterministic tie-breaking without
 * locale-dependent string comparison.
 *
 * @param groups - Departure groups from a single stop.
 * @returns Flat list sorted by departure time.
 */
export function flattenDepartures(groups: DepartureGroup[]): FlatDeparture[] {
  const result: FlatDeparture[] = [];

  for (const group of groups) {
    for (const departure of group.departures) {
      result.push({
        route: group.route,
        headsign: group.headsign,
        departure,
      });
    }
  }

  result.sort((a, b) => {
    const timeDiff = a.departure.getTime() - b.departure.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    const typeDiff = a.route.route_type - b.route.route_type;
    if (typeDiff !== 0) {
      return typeDiff;
    }

    if (a.route.route_id < b.route.route_id) {
      return -1;
    }
    if (a.route.route_id > b.route.route_id) {
      return 1;
    }
    return 0;
  });

  return result;
}
