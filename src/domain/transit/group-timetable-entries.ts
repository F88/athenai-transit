import type { TimetableEntry } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from './get-effective-headsign';

/**
 * Group timetable entries by route_id + effective headsign.
 *
 * Both within-group order and between-group order follow the input —
 * entries are appended to their group in input order, and groups are
 * iterated in first-encounter order. Callers that need a specific
 * presentation (e.g. UI display order, departure order) should pre-sort
 * the input with the appropriate helper from `./sort-timetable-entries`
 * or `./sort-timetable-for-ui` before calling this function.
 *
 * The key is `route_id\0headsign` — the null byte separator avoids
 * collisions between route_id and headsign values.
 *
 * @param entries - Timetable entries in the desired display order.
 * @returns Groups as an array of [key, entries] tuples, in first-encounter
 *          order. Within-group order mirrors the input slice.
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

  return [...map.entries()];
}
