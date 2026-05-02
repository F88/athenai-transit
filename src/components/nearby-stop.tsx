import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { groupByRouteHeadsign } from '../domain/transit/group-timetable-entries';
import {
  getFilteredTimetableEntriesState,
  getTimetableEntriesState,
} from '../domain/transit/timetable-utils';
import { useInfoLevel } from '../hooks/use-info-level';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { TimetableEntriesState } from '../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { StopInfo } from './stop-info';
import { StopActionButtons } from './stop-action-buttons';
import { StopTimeItem } from './stop-time-item';
import { StopTimesItem } from './stop-times-item';
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

  // detailed: show all entries (including terminal/drop-off-only with labels)
  // non-detailed: show only boardable stop times
  // const displayStopTimes = useMemo(
  //   () => (info.isDetailedEnabled ? stopTimes : filterBoardable(stopTimes)),
  //   [info.isDetailedEnabled, stopTimes],
  // );
  const displayStopTimes = stopTimes;

  const grouped = useMemo(
    () => (viewId !== 'stop' ? groupByRouteHeadsign(displayStopTimes) : []),
    [viewId, displayStopTimes],
  );

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

  return (
    <div
      data-stop-id={stop.stop_id}
      className={`mb-2 cursor-pointer rounded-lg px-3 pt-2.5 pb-3 last:mb-0 ${isSelected ? 'border-info/40 bg-info/10 border' : 'bg-[#f5f7fa] dark:bg-gray-800'}`}
      onClick={() => onStopSelected(stop.stop_id)}
    >
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
          agencyBadgeSize={'md'}
          routeBadgeSize={'sm'}
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
      {displayStopTimes.length > 0 ? (
        // Multi-operator stops are rare in the current dataset, so the
        // agency badge would be redundant noise on single-operator stops
        // (the operator is implied by the stop itself). Only surface the
        // agency badge when there is something to disambiguate.
        (() => {
          const showAgency = info.isVerboseEnabled || agencies.length > 1;
          return viewId === 'stop'
            ? displayStopTimes
                .slice(0, 5)
                .map((entry, i) => (
                  <StopTimeItem
                    key={`${entry.routeDirection.route.route_id}__${getEffectiveHeadsign(entry.routeDirection)}__${entry.schedule.departureMinutes}__${i}`}
                    entry={entry}
                    now={now}
                    forceShowRelativeTime={i === 0}
                    showRouteTypeIcon={showRouteTypeIconForAllStopTimes}
                    infoLevel={infoLevel}
                    dataLangs={dataLangs}
                    agency={agencies.find(
                      (a) => a.agency_id === entry.routeDirection.route.agency_id,
                    )}
                    showAgency={showAgency}
                    onInspectTrip={onInspectTrip}
                  />
                ))
            : grouped.map(([key, entries]) => (
                <StopTimesItem
                  key={`${stop.stop_id}__${key}`}
                  entries={entries}
                  now={now}
                  infoLevel={infoLevel}
                  dataLangs={dataLangs}
                  showRouteTypeIcon={showRouteTypeIconForAllStopTimes}
                  agency={agencies.find(
                    (a) => a.agency_id === entries[0].routeDirection.route.agency_id,
                  )}
                  showAgency={showAgency}
                  onShowTimetable={
                    onShowTimetable
                      ? (routeId, headsign) => onShowTimetable(stop.stop_id, routeId, headsign)
                      : undefined
                  }
                  onInspectTrip={onInspectTrip}
                />
              ));
        })()
      ) : (
        // Show the fallback message in the stop times area whenever there
        // are no upcoming entries. When `displayStopTimes.length === 0`,
        // `filteredState` is one of:
        //   - `'no-service'`: repo has no timetable data for this stop at all.
        //   - `'service-ended'`: repo has data but the upcoming window is
        //     already empty pre-filter — late-night / service ended for today.
        //   - `'filter-hidden'`: pre-filter upcoming had entries but the
        //     user's UI filters removed everything visible. The service has
        //     NOT ended; we must not say it has.
        // ('boardable' / 'drop-off-only' only occur with non-empty stop times
        // and are handled by the render branch above.)
        <p className="m-0 text-xs text-[#9e9e9e] dark:text-gray-500">
          {t(
            filteredState === 'no-service'
              ? 'stop.serviceState.noService'
              : filteredState === 'service-ended'
                ? 'stop.serviceState.serviceEnded'
                : 'stop.timetable.allFilteredOut',
          )}
        </p>
      )}
    </div>
  );
}
