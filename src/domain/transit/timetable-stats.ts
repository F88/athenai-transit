import type { StopServiceType, TimetableEntry } from '@/types/app/transit-composed';
import { getHeadsignDisplayNames } from './name-resolver/get-headsign-display-names';
import { isAlightableForPassenger, isBoardableForPassenger } from './timetable-entry-for-passenger';
import type { Agency } from '@/types/app/transit';
import { resolveAgencyLang } from '@/config/transit-defaults';
// import { createLogger } from '../../lib/logger';

// const logger = createLogger('TimetableStats');

/**
 * Aggregated statistics computed from a list of {@link TimetableEntry}.
 *
 * Counts are grouped into sub-objects by axis. Axes are independent, so
 * summing across them is meaningless (one entry can be counted in both
 * `position.originCount` and `passenger.boardableCount`).
 *
 * Two semantic layers are kept apart (Issue #162): faithful counts read
 * straight from the source (`position`, `boarding`) vs interpreted
 * counts that judge the value for the passenger (`passenger`). See each
 * field for per-axis details.
 *
 * @see computeTimetableEntryStats
 */
export interface TimetableEntryStats {
  /** Total number of entries (= input length). */
  totalCount: number;

  /**
   * Faithful: pattern role of the stop event. `originCount` and
   * `terminalCount` are NOT mutually exclusive -- a single-stop pattern
   * increments both.
   */
  position: {
    /** Entries where this stop is the trip's origin (= `isFirstStop === true`). */
    originCount: number;
    /** Entries where this stop is the trip's terminal (= `isLastStop === true`). */
    terminalCount: number;
    /** Entries where this stop is mid-route (= `!isFirstStop && !isLastStop`). */
    passingCount: number;
  };

  /** Faithful: distribution of `TimetableEntry.boarding` values. */
  boarding: {
    /**
     * Count of entries per `boarding.pickupType` value (0=regular,
     * 1=not available, 2=phone agency, 3=coordinate with driver).
     * Faithful distribution; no interpretation.
     */
    pickupTypeCounts: Record<StopServiceType, number>;
    /** Count of entries per `boarding.dropOffType` value (same encoding). */
    dropOffTypeCounts: Record<StopServiceType, number>;
  };

  /**
   * Interpreted: value for the passenger. Each pair
   * (boardable/nonBoardable, alightable/nonAlightable) partitions all
   * entries, so each sums to `totalCount`.
   */
  passenger: {
    /** Entries where boarding is available (= `isBoardableForPassenger`). */
    boardableCount: number;
    /** Entries where boarding is NOT available (= `!isBoardableForPassenger`). */
    nonBoardableCount: number;
    /** Entries where alighting is available (= `isAlightableForPassenger`). */
    alightableCount: number;
    /** Entries where alighting is NOT available (= `!isAlightableForPassenger`). */
    nonAlightableCount: number;
  };

  /** Identity: route / direction / headsign uniqueness. */
  routeDirection: {
    /** Number of unique `route_id` values across the entries. */
    routeCount: number;
    /** Number of unique `direction` values observed (`undefined` is one value). */
    directionCount: number;
    /** Number of unique resolved (user-facing) trip headsigns. */
    tripHeadsignCount: number;
    /** Number of unique resolved (user-facing) stop headsigns. */
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
  // faithful structural axis: stop position (origin/terminal/passing)
  let firstStop = 0;
  let lastStopCount = 0;
  let passingCount = 0;

  // faithful per-value distribution of boarding.pickupType / dropOffType
  // (0/1/2/3); independent of pattern position and of boardable/alightable
  const pickupTypeCounts: Record<StopServiceType, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const dropOffTypeCounts: Record<StopServiceType, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  // interpreted axis: boardability for passenger
  let boardableForPassengerCount = 0;
  let nonBoardableForPassengerCount = 0;
  // alightability for passenger (symmetric to boardability)
  let alightableForPassengerCount = 0;
  let nonAlightableForPassengerCount = 0;

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
      firstStop++;
    }
    if (entry.patternPosition.isLastStop) {
      lastStopCount++;
    }
    if (!entry.patternPosition.isFirstStop && !entry.patternPosition.isLastStop) {
      passingCount++;
    }

    if (isBoardableForPassenger(entry)) {
      boardableForPassengerCount++;
    } else {
      nonBoardableForPassengerCount++;
    }
    if (isAlightableForPassenger(entry)) {
      alightableForPassengerCount++;
    } else {
      nonAlightableForPassengerCount++;
    }
    pickupTypeCounts[entry.boarding.pickupType]++;
    dropOffTypeCounts[entry.boarding.dropOffType]++;

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

    directions.add(String(entry.routeDirection.direction));

    const tl = entry.tripLocator;
    patternIds.add(tl.patternId);
    serviceIds.add(tl.serviceId);
    trips.add(`${tl.patternId}|${tl.serviceId}|${tl.tripIndex}`);
  }

  return {
    totalCount: entries.length,
    position: {
      originCount: firstStop,
      terminalCount: lastStopCount,
      passingCount,
    },
    boarding: {
      pickupTypeCounts,
      dropOffTypeCounts,
    },
    passenger: {
      boardableCount: boardableForPassengerCount,
      nonBoardableCount: nonBoardableForPassengerCount,
      alightableCount: alightableForPassengerCount,
      nonAlightableCount: nonAlightableForPassengerCount,
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
