import type { AppRouteTypeValue } from '@/types/app/transit';
import type {
  RouteDirection,
  StopServiceType,
  StopWithMeta,
  TripLocator,
  TripStopTime,
} from '@/types/app/transit-composed';
import type { TimetableGroupV2Json } from '@/types/data/transit-v2-json';

import type { PatternTimetableEntry } from '../types';

/** Lookups supplied by the repository. */
export interface BuildTripStopTimesLookups {
  getStopMeta: (stopId: string) => StopWithMeta | undefined;
  getStopRouteTypes: (stopId: string) => AppRouteTypeValue[];
  resolveRouteDirection: (stopIndex: number) => RouteDirection;
}

/**
 * Build the per-stop schedule rows for a single trip (locator) by walking
 * the pattern's timetable entries.
 *
 * Output shape and order:
 * - The returned array preserves the iteration order of
 *   `timetableEntries`, which is grouped by source stopId rather than by
 *   pattern position. To obtain a valid stop sequence, pass the result
 *   through {@link sortTripStopTimesByStopIndex}
 *   (see `./sort-trip-stop-times`).
 * - When `timetableEntries` is `undefined` or empty, an empty array is
 *   returned and no lookup callback is invoked.
 *
 * Inclusion rules:
 *   A pattern entry is included in the output only when all of the
 *   following resolve to a defined number:
 *     1. `group.d[locator.serviceId]`
 *     2. `group.d[locator.serviceId][locator.tripIndex]`
 *     3. `group.a[locator.serviceId]`
 *     4. `group.a[locator.serviceId][locator.tripIndex]`
 *
 *   Entries that fail any of these conditions are dropped silently;
 *   their lookups (`getStopMeta`, `getStopRouteTypes`,
 *   `resolveRouteDirection`) are not invoked. Rule (2) also catches
 *   negative, non-integer, and `NaN` `tripIndex` values that bypass a
 *   plain length comparison.
 *
 *   Rules (1) and (2) treat the source-of-truth `d` column;
 *   rules (3) and (4) apply the same strictness to `a`. The v2 contract
 *   states `a` is required and positionally aligned with `d`, but this
 *   function does not assume contract compliance and therefore will not
 *   substitute departure values for missing arrivals.
 *
 * Properties of the output:
 * - The output may be shorter than the pattern's stop count when any
 *   entry is dropped. The `patternPosition.stopIndex` values among the
 *   returned elements are then not contiguous.
 * - The output is self-describing: each element carries
 *   `patternPosition.stopIndex` and `patternPosition.totalStops`, so
 *   callers can detect missing positions by comparing the set of
 *   returned `stopIndex` values against `[0..totalStops - 1]`.
 *
 * Callers must not treat an output array index as interchangeable with
 * a pattern stopIndex.
 */
export function buildTripStopTimes(
  locator: TripLocator,
  totalStops: number,
  timetableEntries: readonly PatternTimetableEntry[] | undefined,
  lookups: BuildTripStopTimesLookups,
): TripStopTime[] {
  const stopTimes: TripStopTime[] = [];
  // No timetable entries for the pattern: nothing to reconstruct.
  if (!timetableEntries) {
    return stopTimes;
  }

  // Walk every (stopId, group) pair belonging to this pattern. Order is
  // not the pattern's stop sequence — the caller sorts later.
  for (const { stopId, group } of timetableEntries) {
    // Pull the departure column for the requested service. Each element
    // d[serviceId][i] is the i-th trip's departure at this stop.
    const departures = group.d[locator.serviceId];

    // Skip when `group.d` has no entry for the requested serviceId
    // (key absent). Without a column there is nothing to index into.
    if (departures === undefined) {
      continue;
    }

    // Skip when `departures[locator.tripIndex]` does not yield a value.
    // Covers out-of-range indices, the empty-array case, and any
    // non-integer / negative / NaN tripIndex that bypasses a length
    // comparison.
    const departureMinutes = departures[locator.tripIndex];
    if (departureMinutes === undefined) {
      continue;
    }

    // Arrival is resolved with the same strictness as departure.
    // Although the v2 contract says `a` exists and is positionally
    // aligned with `d` (ODPT sources copy departure into `a` at the
    // pipeline stage), this code does not assume contract compliance.
    const arrivals = group.a[locator.serviceId];
    if (arrivals === undefined) {
      continue;
    }
    const arrivalMinutes = arrivals[locator.tripIndex];
    if (arrivalMinutes === undefined) {
      continue;
    }

    stopTimes.push(
      buildTripStopTimeFromGroup(
        locator,
        totalStops,
        stopId,
        group,
        departureMinutes,
        arrivalMinutes,
        lookups,
      ),
    );
  }

  return stopTimes;
}

/**
 * Build a single {@link TripStopTime} for the trip identified by `locator`
 * at the (stop, group) pair indicated by `stopId` / `group`.
 *
 * `departureMinutes` / `arrivalMinutes` are resolved from `group.d` /
 * `group.a` by the caller (see {@link buildTripStopTimes}). This function
 * does not re-read those columns and does not validate the passed-in
 * numbers.
 */
export function buildTripStopTimeFromGroup(
  locator: TripLocator,
  totalStops: number,
  stopId: string,
  group: TimetableGroupV2Json,
  departureMinutes: number,
  arrivalMinutes: number,
  lookups: BuildTripStopTimesLookups,
): TripStopTime {
  // Resolve pickup_type. `group.pt` is optional at the source level
  // (e.g. ODPT omits it entirely); within a present `pt`, individual
  // entries may also be missing. Default to 0 (regular) for any of
  // these absences.
  const pickupType: StopServiceType = (group.pt?.[locator.serviceId]?.[locator.tripIndex] ??
    0) as StopServiceType;

  // Resolve drop_off_type with the same shape and default as pickup.
  const dropOffType: StopServiceType = (group.dt?.[locator.serviceId]?.[locator.tripIndex] ??
    0) as StopServiceType;

  // Resolve the per-stop route direction (route + headsigns) from the
  // repository lookup. The lookup is keyed by stopIndex because
  // stop-level headsigns can differ along the same pattern.
  const routeDirection = lookups.resolveRouteDirection(group.si);

  // Derive pattern position from `group.si` and the caller-supplied
  // `totalStops`. `totalStops` stays at the pattern's full length even
  // when sibling rows are dropped upstream, so callers can still report
  // "stop k of N".
  const patternPosition = {
    stopIndex: group.si,
    totalStops,
    isOrigin: group.si === 0,
    isTerminal: group.si === totalStops - 1,
  };

  return {
    stopMeta: lookups.getStopMeta(stopId),
    routeTypes: lookups.getStopRouteTypes(stopId),
    timetableEntry: {
      tripLocator: locator,
      schedule: {
        departureMinutes,
        arrivalMinutes,
      },
      routeDirection,
      boarding: {
        pickupType,
        dropOffType,
      },
      patternPosition,
    },
  };
}
