import type { TimetableEntry } from '@/types/app/transit-composed';
import { getHeadsignDisplayNames } from './name-resolver/get-headsign-display-names';
import { isBoardableForPassenger } from './timetable-entry-for-passenger';
import type { Agency } from '@/types/app/transit';
import { resolveAgencyLang } from '@/config/transit-defaults';
// import { createLogger } from '../../lib/logger';

// const logger = createLogger('TimetableStats');

/**
 * Aggregated statistics computed from a list of {@link TimetableEntry}.
 *
 * Counts are grouped into sub-objects by axis. Each axis answers a
 * single kind of question; counts on different axes are independent, so
 * summing across them is meaningless (e.g. one entry can be counted in
 * both `position.originCount` and `passenger.boardableCount`).
 *
 * The grouping keeps two semantic layers from being mixed under one
 * heading (Issue #162): faithful counts read straight from the source
 * (`position`, `signal`) vs interpreted counts that combine the signal
 * with the pattern position for the passenger (`passenger`).
 *
 * - **`position`** (faithful, pattern role): `originCount` /
 *   `terminalCount` / `passingCount`. `originCount` and `terminalCount`
 *   are NOT mutually exclusive — a single-stop pattern (= `totalStops
 *   === 1`) increments both. `passingCount` is strictly mid-route
 *   (= `!isFirstStop && !isLastStop`).
 * - **`signal`** (faithful, raw GTFS pickup/drop-off): `noPickupCount`
 *   (= explicit `pickup_type === 1`) and `noDropOffCount` (= explicit
 *   `drop_off_type === 1`) are independent GTFS signals.
 * - **`passenger`** (interpreted, value for passenger): `boardableCount`
 *   / `nonBoardableCount`, judged by {@link isBoardableForPassenger}.
 *   The pair partitions all entries (sum equals `totalCount`).
 * - **`routeDirection`** (identity): unique counts of `route_id`,
 *   observed `direction` values, resolved trip/stop headsigns (the
 *   user-facing strings from {@link getHeadsignDisplayNames}).
 * - **`tripLocator`** (identity): unique counts of `patternId`,
 *   `serviceId`, and `(patternId, serviceId, tripIndex)` triples.
 *   `uniqueTripCount` can be lower than `totalCount` for 6-shape /
 *   circular patterns where the same trip visits the same stop twice.
 *
 * @see computeTimetableEntryStats
 */
export interface TimetableEntryStats {
  /** Total number of entries (= input length). */
  totalCount: number;

  /** Faithful: pattern role of the stop event. */
  position: {
    /** Entries where this stop is the trip's origin (= `isFirstStop === true`). */
    originCount: number;
    /** Entries where this stop is the trip's terminal (= `isLastStop === true`). */
    terminalCount: number;
    /** Entries where this stop is mid-route (= `!isFirstStop && !isLastStop`). */
    passingCount: number;
  };

  /** Faithful: raw GTFS pickup / drop-off signals. */
  signal: {
    /** Entries with explicit `pickup_type === 1` (no pickup available). */
    noPickupCount: number;
    /** Entries with explicit `drop_off_type === 1` (no drop-off available). */
    noDropOffCount: number;
  };

  /** Interpreted: value for the passenger. */
  passenger: {
    /** Entries where boarding is available (= `isBoardableForPassenger`). */
    boardableCount: number;
    /** Entries where boarding is NOT available (= `!isBoardableForPassenger`). */
    nonBoardableCount: number;
  };

  /** Identity: route / direction / headsign uniqueness. */
  routeDirection: {
    /** Number of unique `route_id` values across the entries. */
    routeCount: number;
    /** Number of unique `direction` values observed (`undefined` is one value). */
    directionCount: number;
    tripHeadsignCount: number;
    stopHeadsignCount: number;
  };

  /** Identity: trip locator uniqueness. */
  tripLocator: {
    /** Number of unique `patternId` values. */
    patternCount: number;
    /** Number of unique `serviceId` values. */
    serviceCount: number;
    /**
     * Number of unique `(patternId, serviceId, tripIndex)` triples.
     * Differs from `totalCount` when 6-shape / circular patterns place
     * the same trip at the same stop multiple times.
     */
    uniqueTripCount: number;
  };
}

/**
 * Compute aggregated statistics for a list of {@link TimetableEntry}.
 *
 * Single pass over the input; O(n) time, O(unique values) space for the
 * "unique" counts.
 *
 * Returns all-zero stats for an empty input.
 *
 * `headsignCount` and `routeHeadsignCount` are aggregated from the
 * resolved (= user-facing) headsign string produced by
 * {@link getHeadsignDisplayNames}, so the same `preferredDisplayLangs`,
 * `agencyLangs`, and `prefer` arguments are forwarded.
 *
 * @param entries - The entries to analyze.
 * @param agencies - Agency languages used for sub-name priority within the resolver.
 * @param preferredDisplayLangs - Ordered language fallback chain for the resolved headsign.
 * @returns Aggregated stats. See {@link TimetableEntryStats} for axis details.
 */
export function computeTimetableEntryStats(
  entries: TimetableEntry[],
  agencies: readonly Agency[],
  preferredDisplayLangs: readonly string[],
): TimetableEntryStats {
  let originCount = 0;
  let terminalCount = 0;
  let passingCount = 0;
  let boardableCount = 0;
  let nonBoardableCount = 0;
  let noPickupCount = 0;
  let noDropOffCount = 0;

  const routeIds = new Set<string>();
  const tripsHeadsigns = new Set<string>();
  const stopHeadsigns = new Set<string>();
  const directions = new Set<string>();
  const patternIds = new Set<string>();
  const serviceIds = new Set<string>();
  const trips = new Set<string>();

  for (const entry of entries) {
    const agencyLangs = resolveAgencyLang(agencies, entry.routeDirection.route.agency_id);

    if (entry.patternPosition.isFirstStop) {
      originCount++;
    }
    if (entry.patternPosition.isLastStop) {
      terminalCount++;
    }
    if (!entry.patternPosition.isFirstStop && !entry.patternPosition.isLastStop) {
      passingCount++;
    }

    if (isBoardableForPassenger(entry)) {
      boardableCount++;
    } else {
      nonBoardableCount++;
    }
    if (entry.boarding.pickupType === 1) {
      noPickupCount++;
    }
    if (entry.boarding.dropOffType === 1) {
      noDropOffCount++;
    }

    const routeId = entry.routeDirection.route.route_id;
    routeIds.add(routeId);

    const tripHeadsign = getHeadsignDisplayNames(
      entry.routeDirection,
      preferredDisplayLangs,
      agencyLangs,
      'trip',
    ).resolved.name;
    tripsHeadsigns.add(tripHeadsign);

    const stopHeadsign = getHeadsignDisplayNames(
      entry.routeDirection,
      preferredDisplayLangs,
      agencyLangs,
      'stop',
    ).resolved.name;
    stopHeadsigns.add(stopHeadsign);

    // console.debug({ stopHeadsign, tripHeadsign });

    directions.add(String(entry.routeDirection.direction));

    const tl = entry.tripLocator;
    patternIds.add(tl.patternId);
    serviceIds.add(tl.serviceId);
    trips.add(`${tl.patternId}|${tl.serviceId}|${tl.tripIndex}`);
  }

  // if (logger.isEnabled('debug')) {
  //   logger.debug('tripsHeadsigns', [...tripsHeadsigns]);
  //   logger.debug('stopHeadsigns', [...stopHeadsigns]);
  // }

  return {
    totalCount: entries.length,
    position: {
      originCount,
      terminalCount,
      passingCount,
    },
    signal: {
      noPickupCount,
      noDropOffCount,
    },
    passenger: {
      boardableCount,
      nonBoardableCount,
    },
    routeDirection: {
      routeCount: routeIds.size,
      directionCount: directions.size,
      tripHeadsignCount: tripsHeadsigns.size,
      stopHeadsignCount: stopHeadsigns.size,
    },
    tripLocator: {
      patternCount: patternIds.size,
      serviceCount: serviceIds.size,
      uniqueTripCount: trips.size,
    },
  };
}
