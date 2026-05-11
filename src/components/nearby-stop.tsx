import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import {
  getFilteredTimetableEntriesState,
  getTimetableEntriesState,
} from '../domain/transit/timetable-utils';
import { useInfoLevel } from '../hooks/use-info-level';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { TimetableEntriesState } from '../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { NearbyStopFlatView } from './nearby-stop-flat-view';
import { NearbyStopGroupedView } from './nearby-stop-grouped-view';
import { StopInfo } from './stop-info';
import { StopActionButtons } from './stop-action-buttons';
import { VerboseNearbyStopSummary } from './verbose/verbose-nearby-stop-summary';

export interface NearbyStopProps {
  data: StopWithContext;
  /**
   * Per-stop pre-`globalFilter` `TimetableEntriesState`. Computed once
   * in `app.tsx` from `routeTypesFilteredNearbyStopTimes` (= settings
   * filter applied, `globalFilter` not yet) and threaded down through
   * `BottomSheet` / `BottomSheetStops`. Combined with the repo's
   * full-day `stopServiceState` and the filtered `stopTimes` state to
   * pick the correct empty-fallback message (no-service / service-ended
   * / filter-hidden).
   */
  timetableEntriesState: TimetableEntriesState;
  isSelected: boolean;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Active stop time view pattern ID. */
  viewId: string;
  /** Whether this stop is in the anchor (bookmark) list. */
  isAnchor: boolean;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for this stop. */
  onToggleAnchor: (stopId: string) => void;
  /** Optional callback for opening trip inspection from a stop ID. */
  onOpenTripInspectionByStopId?: (stopId: string) => void;
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function NearbyStop({
  data: { stop, routeTypes, stopTimes, stopServiceState, agencies, routes, distance, stats, geo },
  timetableEntriesState,
  isSelected,
  now,
  mapCenter,
  infoLevel,
  dataLangs,
  viewId,
  isAnchor,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
  onOpenTripInspectionByStopId,
  onInspectTrip,
}: NearbyStopProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  // Show route_type emoji on each stop time row when the stop serves
  // multiple route_types (so the user can distinguish bus vs tram etc.).
  // verbose: always show. detailed and below: only when multiple types.
  const hasMultipleRouteTypes = routeTypes.length > 1;
  const showRouteTypeIconForAllStopTimes = info.isVerboseEnabled || hasMultipleRouteTypes;

  // Multi-operator stops are rare in the current dataset, so the agency
  // badge would be redundant noise on single-operator stops (the operator
  // is implied by the stop itself). Only surface the agency badge when
  // there is something to disambiguate.
  const showAgency = info.isVerboseEnabled || agencies.length > 1;

  const hasUnknownHeadsign = useMemo(
    () => stopTimes.some((e) => getEffectiveHeadsign(e.routeDirection) === ''),
    [stopTimes],
  );

  // Unified display state for this stop, combining three levels:
  //   - `stopServiceState`: full-day state from the repo (all-day scope).
  //   - `upcomingEntriesState`: pre-filter upcoming entries state (from the
  //     Map built in BottomSheet before any user filter is applied).
  //   - `getTimetableEntriesState(stopTimes)`: post-filter state of what
  //     is actually being rendered right now.
  //
  // Used by the fallback branch below to pick between noService /
  // serviceEnded / allFilteredOut when `stopTimes` is empty.
  const filteredState = useMemo(
    () =>
      getFilteredTimetableEntriesState(
        stopServiceState,
        timetableEntriesState,
        getTimetableEntriesState([...stopTimes]),
      ),
    [stopServiceState, timetableEntriesState, stopTimes],
  );

  const stopHeader = (
    <>
      {showVerbose && (
        <VerboseNearbyStopSummary
          stopTimes={stopTimes}
          stopServiceState={stopServiceState}
          isSelected={isSelected}
          isAnchor={isAnchor}
          viewId={viewId}
        />
      )}
      <div className="m-0 mb-1.5 flex items-stretch gap-1">
        <StopInfo
          stop={stop}
          showAgencies={true}
          showRouteTypes={true}
          routeTypes={routeTypes}
          agencies={agencies}
          distance={distance}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          stopServiceState={stopServiceState}
          routes={routes}
          showRoutes={true}
          stats={stats}
          geo={geo}
          agencyBadgeSize={'sm'}
          routeBadgeSize={'xs'}
        />
        <StopActionButtons
          stopId={stop.stop_id}
          isAnchor={isAnchor}
          layout={'vertical'}
          onToggleAnchor={onToggleAnchor}
          onShowStopTimetable={onShowStopTimetable}
          onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
          showAnchorButton
          showStopTimetableButton
          showTripInspectionButton={false}
        />
      </div>

      {hasUnknownHeadsign && (
        <p className="m-0 mb-1 text-[11px] text-amber-600 dark:text-amber-400">
          {t('stop.dataQuality.noDestination')}
        </p>
      )}
    </>
  );

  // Render the stop times area. Each view (`'stop'` / grouped / future)
  // owns its own preprocessing (sort, group, slice), so only the active
  // view's work runs per render. Adding a new view = one new case here
  // plus a dedicated view component.
  const renderStopTimes = () => {
    if (stopTimes.length < 1) {
      // Empty fallback picks the right message for the three empty states:
      //   - 'no-service': repo has no timetable data for this stop at all.
      //   - 'service-ended': repo has data but the upcoming window is
      //     already empty pre-filter — late-night / service ended for today.
      //   - 'filter-hidden': pre-filter upcoming had entries but the user's
      //     UI filters removed everything visible. The service has NOT
      //     ended; we must not say it has.
      // ('boardable' / 'drop-off-only' only occur with non-empty stop times.)
      return (
        <p className="m-0 text-xs text-[#9e9e9e] dark:text-gray-500">
          {t(
            filteredState === 'no-service'
              ? 'stop.serviceState.noService'
              : filteredState === 'service-ended'
                ? 'stop.serviceState.serviceEnded'
                : 'stop.timetable.allFilteredOut',
          )}
        </p>
      );
    }
    if (viewId === 'stop') {
      return (
        <NearbyStopFlatView
          stopTimes={stopTimes}
          now={now}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          agencies={agencies}
          showRouteTypeIcon={showRouteTypeIconForAllStopTimes}
          showAgency={showAgency}
          onInspectTrip={onInspectTrip}
        />
      );
    }
    if (viewId === 'route-headsign') {
      return (
        <NearbyStopGroupedView
          stopId={stop.stop_id}
          stopTimes={stopTimes}
          now={now}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          agencies={agencies}
          showRouteTypeIcon={showRouteTypeIconForAllStopTimes}
          showAgency={showAgency}
          onShowTimetable={onShowTimetable}
          onInspectTrip={onInspectTrip}
        />
      );
    }
    // Unrecognised viewId — the bottom-sheet header disables every view
    // not handled here, so reaching this branch indicates an upstream
    // configuration bug rather than a state the user can normally hit.
    return null;
  };

  return (
    <div
      data-stop-id={stop.stop_id}
      className={`mb-2 cursor-pointer rounded-lg px-3 pt-2.5 pb-3 last:mb-0 ${isSelected ? 'border-info/40 bg-info/10 border' : 'bg-[#f5f7fa] dark:bg-gray-800'}`}
      onClick={() => onStopSelected(stop.stop_id)}
    >
      {stopHeader}
      {renderStopTimes()}
    </div>
  );
}
