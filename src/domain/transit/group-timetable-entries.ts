import type { TimetableEntry } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from './get-effective-headsign';

/**
 * Group timetable entries by route_id + effective headsign.
 *
 * Used by the T2 (Route+Headsign) view to display departures grouped
 * by route and direction. Entries within each group retain their
 * original order (assumed to be sorted by departure time).
 *
 * The key is `route_id\0headsign` — the null byte separator avoids
 * collisions between route_id and headsign values.
 *
 * @param entries - Timetable entries, typically sorted by departure time.
 * @returns Groups as an array of [key, entries] tuples, sorted by the
 *          earliest departure time in each group.
 */
export function groupByRouteHeadsign<T extends TimetableEntry>(entries: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();

  for (const entry of entries) {
    const key = `${entry.routeDirection.route.route_id}\0${getEffectiveHeadsign(entry.routeDirection)}`;
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
    }
    group.push(entry);
  }

  // Sort groups by earliest departure time
  const result = [...map.entries()];
  result.sort((a, b) => {
    const aMin = a[1][0]?.schedule.departureMinutes ?? 0;
    const bMin = b[1][0]?.schedule.departureMinutes ?? 0;
    return aMin - bMin;
  });

  return result;
}
