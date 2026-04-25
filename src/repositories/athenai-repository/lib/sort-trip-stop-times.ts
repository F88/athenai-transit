import type { TripStopTime } from '@/types/app/transit-composed';

/**
 * Sort `stopTimes` in place by ascending
 * `timetableEntry.patternPosition.stopIndex`, mutating the input array.
 * Returns nothing.
 *
 * The result is the canonical stop sequence order for a single trip:
 * the order in which the trip visits stops in its pattern. Apply this
 * after `buildTripStopTimes` (see `./build-trip-stop-times`), which
 * returns rows in source iteration order rather than pattern order.
 *
 * Properties:
 * - Ascending stopIndex order does not imply a contiguous sequence: if
 *   `buildTripStopTimes` dropped any pattern entry, the sorted array
 *   still has gaps in stopIndex.
 * - The sort is stable. If two elements share the same stopIndex (a
 *   contract C1 violation; not expected from valid v2 data), their
 *   original relative order is preserved.
 */
export function sortTripStopTimesByStopIndex(stopTimes: TripStopTime[]): void {
  stopTimes.sort(
    (a, b) =>
      a.timetableEntry.patternPosition.stopIndex - b.timetableEntry.patternPosition.stopIndex,
  );
}
