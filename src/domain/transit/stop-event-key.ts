import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import { formatDateKey } from './calendar-utils';

/**
 * Stable identity key for a single stop event (a trip's call at a stop on a
 * given service date), for use as a React list key.
 *
 * Includes the service date because a `TripLocator` is per-service, not
 * per-day: the same `(patternId, serviceId, tripIndex, stopIndex)` tuple can
 * recur on different service dates within one rendered list (e.g. an overnight
 * interleave), which would otherwise collide as a React key.
 *
 * Uses `JSON.stringify` rather than a delimiter join so the parts stay
 * unambiguous: a `patternId` already embeds `"__"` (`${route_id}__${headsign}`),
 * so a literal separator could let different tuples produce the same string.
 *
 * @param entry - The stop event.
 * @param stopId - Optional owning stop id. Pass it when the list spans multiple
 *   stops (e.g. a transit-display board); omit it for a single stop's rows.
 */
export function buildStopEventKey(entry: ContextualTimetableEntry, stopId?: string): string {
  return JSON.stringify([
    stopId,
    formatDateKey(entry.serviceDate),
    entry.tripLocator.patternId,
    entry.tripLocator.serviceId,
    entry.tripLocator.tripIndex,
    entry.patternPosition.stopIndex,
  ]);
}
