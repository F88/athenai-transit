import type { TimetableEntry } from '@/types/app/transit-composed';
import { getHeadsignDisplayNames } from './name-resolver/get-headsign-display-names';
import { isDropOffOnly } from './timetable-utils';
import type { Agency } from '@/types/app/transit';
import { resolveAgencyLang } from '@/config/transit-defaults';
import { createLogger } from '../../lib/logger';

const logger = createLogger('TimetableStats');

/**
 * Aggregated statistics computed from a list of {@link TimetableEntry}.
 *
 * Each count answers a single question on a single axis. Counts on
 * different axes are independent, so summing them is meaningless
 * (e.g. one entry can be counted in both `originCount` and
 * `boardableCount`).
 *
 * Axes:
 * - **A (pattern position)**: `originCount` / `terminalCount` / `passingCount`.
 *   `originCount` and `terminalCount` are NOT mutually exclusive — a
 *   single-stop pattern (= `totalStops === 1`) increments both. `passingCount`
 *   is strictly mid-route (= `!isOrigin && !isTerminal`).
 * - **B (boarding)**: `boardableCount` / `nonBoardableCount` /
 *   `dropOffOnlyCount` / `noDropOffCount`. The boardable / non-boardable
 *   pair partitions all entries (sum equals `totalCount`).
 *   `dropOffOnlyCount` (= explicit `pickup_type === 1`) and `noDropOffCount`
 *   (= explicit `drop_off_type === 1`) are independent GTFS signals.
 * - **C (route direction)**: unique counts of `route_id`, resolved
 *   headsign (= the user-facing string from {@link getHeadsignDisplayNames}),
 *   `(route, headsign)` pairs, observed `direction` values, plus the
 *   number of entries whose `stopHeadsign` is set.
 * - **D (trip locator)**: unique counts of `patternId`, `serviceId`,
 *   and `(patternId, serviceId, tripIndex)` triples. `uniqueTripCount`
 *   can be lower than `totalCount` for 6-shape / circular patterns
 *   where the same trip visits the same stop more than once.
 *
 * @see computeTimetableEntryStats
 */
export interface TimetableEntryStats {
  /** Total number of entries (= input length). */
  totalCount: number;

  // A axis: pattern position
  /** Entries where this stop is the trip's origin (= `isOrigin === true`). */
  originCount: number;
  /** Entries where this stop is the trip's terminal (= `isTerminal === true`). */
  terminalCount: number;
  /** Entries where this stop is mid-route (= `!isOrigin && !isTerminal`). */
  passingCount: number;

  // B axis: boarding availability
  /** Entries where boarding is available (= `!isDropOffOnly`). */
  boardableCount: number;
  /** Entries where boarding is NOT available (= `isDropOffOnly`). */
  nonBoardableCount: number;
  /** Entries with explicit `pickup_type === 1` (= GTFS "drop-off only"). */
  dropOffOnlyCount: number;
  /** Entries with explicit `drop_off_type === 1` (= alighting unavailable). */
  noDropOffCount: number;

  // C axis: route direction
  /** Number of unique `route_id` values across the entries. */
  routeCount: number;
  /** Number of unique `direction` values observed (`undefined` is one value). */
  directionCount: number;
  tripHeadsignCount: number;
  stopHeadsignCount: number;

  // D axis: trip locator
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
  let dropOffOnlyCount = 0;
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

    if (entry.patternPosition.isOrigin) {
      originCount++;
    }
    if (entry.patternPosition.isTerminal) {
      terminalCount++;
    }
    if (!entry.patternPosition.isOrigin && !entry.patternPosition.isTerminal) {
      passingCount++;
    }

    if (isDropOffOnly(entry)) {
      nonBoardableCount++;
    } else {
      boardableCount++;
    }
    if (entry.boarding.pickupType === 1) {
      dropOffOnlyCount++;
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

  logger.debug('tripsHeadsigns', [...tripsHeadsigns]);
  logger.debug('stopHeadsigns', [...stopHeadsigns]);

  return {
    totalCount: entries.length,
    originCount,
    terminalCount,
    passingCount,
    boardableCount,
    nonBoardableCount,
    dropOffOnlyCount,
    noDropOffCount,
    routeCount: routeIds.size,
    directionCount: directions.size,
    tripHeadsignCount: tripsHeadsigns.size,
    stopHeadsignCount: stopHeadsigns.size,
    patternCount: patternIds.size,
    serviceCount: serviceIds.size,
    uniqueTripCount: trips.size,
  };
}
