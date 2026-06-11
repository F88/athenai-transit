import type { StopsCounts } from '../../types/app/stop';
import type { TimetableEntriesState } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';

import { computeStopsCounts } from './compute-stops-counts';
import {
  applyStopEventAttributeTogglesToStops,
  omitStopsWithoutStopTimes,
} from './timetable-filter';
import { getTimetableEntriesState } from './timetable-service-state';

/**
 * Inputs to {@link deriveFilteredNearbyStops}.
 */
export interface DeriveFilteredNearbyStopsInput {
  /** Latest fetched stop-time list for nearby stops. */
  nearbyStopTimes: readonly StopWithContext[];
  /**
   * Route-type filter from user settings (`visibleStopTypes`).
   * A stop is kept when any of its `routeTypes` is in this set.
   */
  enabledRouteTypes: ReadonlySet<number>;
  /** App-wide toggle: keep only entries that are an origin trip. */
  showOriginOnly: boolean;
  /** App-wide toggle: keep only boardable entries. */
  showBoardableOnly: boolean;
  /**
   * Effective empty-stop omit policy. Already merged from the user's
   * explicit override, the late-night default, and the
   * `showOriginOnly` / `showBoardableOnly` "force" rule by the caller.
   */
  omitEmptyStops: boolean;
}

/**
 * Result of {@link deriveFilteredNearbyStops}. All fields are fresh
 * objects on every call; wrap the call in `useMemo` at the call site
 * so unchanged inputs produce stable references for downstream memos.
 */
export interface DeriveFilteredNearbyStopsResult {
  /**
   * Final visible list: route-type filter + origin/boardable filter +
   * empty-stop omit policy applied. Rendered to MapView and the
   * bottom sheet.
   */
  filtered: StopWithContext[];
  /**
   * Per-stop `TimetableEntriesState` snapshot taken from the
   * pre-globalFilter list (route-type filter only). The pre-filter
   * base is intentional -- it lets consumers distinguish
   * `filter-hidden` (entries existed pre-globalFilter, removed by
   * user toggles) from `no-service` (no entries at all). Computing
   * this against the post-globalFilter list would collapse those two
   * states.
   */
  timetableEntriesStateByStopId: Map<string, TimetableEntriesState>;
  /**
   * Counts BEFORE the app-wide origin / boardable / empty filters
   * (route-type filter applied only). Used by chrome that surfaces
   * "total stops matching settings at this zoom".
   */
  rawCounts: StopsCounts;
  /**
   * Counts AFTER all filters are applied. Used by chrome that
   * surfaces "stops currently displayed".
   */
  filteredCounts: StopsCounts;
}

/**
 * Pure selector that derives the final visible nearby-stop state from
 * `nearbyStopTimes` + user settings + app-wide filter toggles.
 * Replaces a chain of `useMemo` blocks previously inlined in
 * `app.tsx`. Steps, in order:
 *
 * 1. route-type filter (user settings)
 * 2. `TimetableEntriesState` snapshot of the pre-globalFilter list
 * 3. origin / boardable filter (app-wide globalFilter)
 * 4. empty-stop omit policy (late-night default / explicit override /
 *    forced when origin or boardable is on)
 * 5. counts at the pre-filter and post-filter stages
 *
 * The function returns a fresh object on every call; identity stability
 * is the caller's responsibility (wrap in `useMemo`).
 */
export function deriveFilteredNearbyStops(
  input: DeriveFilteredNearbyStopsInput,
): DeriveFilteredNearbyStopsResult {
  const { nearbyStopTimes, enabledRouteTypes, showOriginOnly, showBoardableOnly, omitEmptyStops } =
    input;

  const routeTypesFiltered = nearbyStopTimes.filter((swc) =>
    swc.routeTypes.some((rt) => enabledRouteTypes.has(rt)),
  );

  const timetableEntriesStateByStopId = new Map<string, TimetableEntriesState>();
  for (const swc of routeTypesFiltered) {
    timetableEntriesStateByStopId.set(swc.stop.stop_id, getTimetableEntriesState(swc.stopTimes));
  }

  const stopEventAttributesApplied = applyStopEventAttributeTogglesToStops(routeTypesFiltered, {
    showOriginOnly,
    showBoardableOnly,
  });

  const filtered = omitEmptyStops
    ? omitStopsWithoutStopTimes(stopEventAttributesApplied)
    : stopEventAttributesApplied;

  const rawCounts = computeStopsCounts(routeTypesFiltered);
  const filteredCounts = computeStopsCounts(filtered);

  return { filtered, timetableEntriesStateByStopId, rawCounts, filteredCounts };
}
