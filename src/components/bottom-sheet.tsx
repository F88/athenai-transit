import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types/app/map';
import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, AppRouteTypeValue, TimetableEntriesState } from '../types/app/transit';
import type { GlobalFilter } from '../types/app/global-filter';
import type { StopsCounts } from '../types/app/stop';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { collectPresentAgencies } from '../domain/transit/collect-present-agencies';
import { collectPresentRouteTypes } from '../domain/transit/collect-present-route-types';
import { computeStopsCounts } from '../domain/transit/compute-stops-counts';
import { filterByAgency, filterByRouteType } from '../domain/transit/timetable-filter';
import { STOP_TIMES_VIEWS, DEFAULT_VIEW_ID } from '../domain/transit/stop-time-views';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import { APP_ROUTE_TYPES } from '../config/route-types';
import { cn } from '../lib/utils';
import { BottomSheetHeader } from './bottom-sheet-header';
import { BottomSheetStops } from './bottom-sheet-stops';

type ExpandedStateAction = boolean | ((prevExpanded: boolean) => boolean);

const DRAG_THRESHOLD = 50;

/** Auto-enable "show operating stops only" filter at 22:00 in service day minutes. */
const LATE_NIGHT_THRESHOLD_MINUTES = 22 * 60;

/** Route type display order matching StopTypeFilterPanel. */
const ROUTE_TYPE_PRIORITY: Readonly<Record<number, number>> = {
  3: 0,
  11: 1,
  1: 2,
  0: 3,
  2: 4,
  12: 5,
  4: 6,
  5: 7,
  6: 8,
  7: 9,
};

const ROUTE_TYPE_ORDER: AppRouteTypeValue[] = [...APP_ROUTE_TYPES.map(({ value }) => value)].sort(
  (a, b) =>
    (ROUTE_TYPE_PRIORITY[a] ?? Number.POSITIVE_INFINITY) -
    (ROUTE_TYPE_PRIORITY[b] ?? Number.POSITIVE_INFINITY),
);

export interface BottomSheetProps {
  /**
   * Stops to render. Already narrowed by the app-wide filters
   * (`globalFilter` + `enabledRouteTypes`); BottomSheet only applies
   * its own surface-local filters (operating-only / agency / route_type).
   */
  stopTimes: StopWithContext[];
  /**
   * Pre-filtered `TimetableEntriesState` per stop, keyed by `stop_id`.
   * Computed in `app.tsx` against the `globalFilter`-pre-trim base so
   * NearbyStop can distinguish `'filter-hidden'` from `'no-service'`.
   */
  timetableEntriesStateByStopId: ReadonlyMap<string, TimetableEntriesState>;
  selectedStopId: string | null;
  isNearbyLoading: boolean;
  hasNearbyLoaded: boolean;
  dataConfig: DataConfig;
  time: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  /** App-wide filter state shared across surfaces. */
  globalFilter: GlobalFilter;
  /**
   * Pre-`globalFilter` `NearbyStopsCounts` computed in `app.tsx` from the
   * settings-filter-applied stop list. Used by BottomSheetHeader to display
   * counts that stay stable as the user toggles `globalFilter` pills.
   */
  nearbyStopsCounts: StopsCounts;
  /**
   * Post-`globalFilter`, pre-BottomSheet-local-filter counts computed in
   * `app.tsx`. Threaded to BottomSheetHeader for UI that needs the
   * app-filtered base before operating/agency/route_type trimming.
   */
  filteredNearbyStopsCounts: StopsCounts;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string, routeTypes: AppRouteTypeValue[]) => void;
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
  /** Collapsed-state height class applied to the sheet root. */
  collapsedHeightClassName?: string;
  /** Expanded-state height class applied to the sheet root. */
  expandedHeightClassName?: string;
  /** Controlled expanded state. */
  expanded?: boolean;
  /** Controlled expanded state setter. */
  onExpandedChange?: (expanded: ExpandedStateAction) => void;
}

export function BottomSheet({
  stopTimes,
  timetableEntriesStateByStopId,
  selectedStopId,
  isNearbyLoading: _isNearbyLoading,
  hasNearbyLoaded,
  dataConfig,
  time: now,
  mapCenter,
  infoLevel,
  dataLangs,
  anchorIds,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
  onInspectTrip,
  collapsedHeightClassName = 'h-[40dvh]',
  expandedHeightClassName = 'h-[70dvh]',
  expanded: expandedProp,
  onExpandedChange,
}: BottomSheetProps) {
  const { showOriginOnly, showBoardableOnly, onToggleShowOriginOnly, onToggleShowBoardableOnly } =
    globalFilter;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
  const expanded = expandedProp ?? uncontrolledExpanded;
  const setExpanded = useCallback(
    (nextExpanded: ExpandedStateAction) => {
      if (onExpandedChange) {
        onExpandedChange(nextExpanded);
        return;
      }
      setUncontrolledExpanded(nextExpanded);
    },
    [onExpandedChange],
  );
  const [viewId, setViewId] = useState(DEFAULT_VIEW_ID);
  const isLateNight = getServiceDayMinutes(now) >= LATE_NIGHT_THRESHOLD_MINUTES;
  // User can toggle manually; null means "use auto (isLateNight)".
  const [showOperatingStopsOnlyOverride, setShowOperatingStopsOnlyOverride] = useState<
    boolean | null
  >(null);
  const showOperatingStopsOnly = showOperatingStopsOnlyOverride ?? isLateNight;
  const [hiddenRouteTypes, setHiddenRouteTypes] = useState<Set<number>>(() => new Set());
  const [hiddenAgencyIds, setHiddenAgencyIds] = useState<Set<string>>(() => new Set());
  const selectedView = STOP_TIMES_VIEWS.find((v) => v.id === viewId);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Route types present in the current nearby stops.
  const presentRouteTypes = useMemo(
    () => collectPresentRouteTypes(stopTimes, ROUTE_TYPE_ORDER),
    [stopTimes],
  );

  const presentAgencies = useMemo(() => collectPresentAgencies(stopTimes), [stopTimes]);

  const toggleRouteType = useCallback((rt: number) => {
    setHiddenRouteTypes((prev) => {
      const next = new Set(prev);
      if (next.has(rt)) {
        next.delete(rt);
      } else {
        next.add(rt);
      }
      return next;
    });
  }, []);

  const toggleAgency = useCallback((agency: Agency) => {
    setHiddenAgencyIds((prev) => {
      const next = new Set(prev);
      if (next.has(agency.agency_id)) {
        next.delete(agency.agency_id);
      } else {
        next.add(agency.agency_id);
      }
      return next;
    });
  }, []);

  // Two-stage local filter pipeline. The app-wide origin / boardable
  // filter (= `globalFilter`) is already applied upstream in `app.tsx`
  // — by the time `stopTimes` arrives here, those entries have already
  // been narrowed and empty stops dropped. BottomSheet only applies its
  // own surface-local filters below.
  //
  // Stage 1 — drop stops with no upcoming entries (operating-only
  // toggle). Acts on the upstream-filtered `stopTimes`, so when entry
  // pills are active the operating filter narrows "what is left after
  // the user's intent narrowing".
  const filteredStopTimes = useMemo(() => {
    if (!showOperatingStopsOnly) {
      return stopTimes;
    }
    return stopTimes.filter((swc) => swc.stopTimes.length > 0);
  }, [stopTimes, showOperatingStopsOnly]);

  // Stage 2 — trim each surviving stop's inner stopTimes by agency /
  // route_type filters. This never drops stops: a stop whose stopTimes
  // are all removed stays visible and shows the "allFilteredOut"
  // fallback message. This decouples "which stops are in the list"
  // from "what is shown inside each stop".
  const trimmedStopTimes = useMemo(() => {
    if (hiddenAgencyIds.size === 0 && hiddenRouteTypes.size === 0) {
      return filteredStopTimes;
    }
    return filteredStopTimes.map((swc) => {
      let trimmed = swc.stopTimes;
      if (hiddenAgencyIds.size > 0) {
        trimmed = filterByAgency(trimmed, hiddenAgencyIds);
      }
      if (hiddenRouteTypes.size > 0) {
        trimmed = filterByRouteType(trimmed, hiddenRouteTypes);
      }
      return trimmed === swc.stopTimes ? swc : { ...swc, stopTimes: trimmed };
    });
  }, [filteredStopTimes, hiddenAgencyIds, hiddenRouteTypes]);

  const trimmedStopTimesCounts: StopsCounts = useMemo(
    () => computeStopsCounts(trimmedStopTimes),
    [trimmedStopTimes],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      if (Math.abs(deltaY) < DRAG_THRESHOLD) {
        return;
      }

      if (deltaY < 0) {
        setExpanded(true);
      } else {
        setExpanded(false);
      }
    },
    [setExpanded],
  );

  const stopIdsKey = useMemo(() => stopTimes.map((d) => d.stop.stop_id).join(','), [stopTimes]);

  // Scroll behavior when the stop list composition or selection changes:
  // - Selected stop exists in the list → scroll to that stop (by DOM position, not array index)
  // - Selected stop is absent or null  → reset scroll to the top of the list
  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    if (selectedStopId) {
      const el = contentRef.current.querySelector(`[data-stop-id="${selectedStopId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    contentRef.current.scrollTop = 0;
  }, [selectedStopId, stopIdsKey]);

  const handleStopSelected = useCallback(
    (stopId: string) => {
      setExpanded(false);
      onStopSelected(stopId);
    },
    [onStopSelected, setExpanded],
  );

  return (
    <div
      className={cn(
        'fixed right-0 bottom-0 left-0 z-1000 flex touch-none flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.15)] transition-[height] duration-300 ease-in-out dark:bg-gray-900',
        expanded ? expandedHeightClassName : collapsedHeightClassName,
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex shrink-0 cursor-grab justify-center py-2 pb-1"
        onClick={() => setExpanded((prevExpanded) => !prevExpanded)}
      >
        <div className="h-1 w-9 rounded-sm bg-[#bdbdbd] dark:bg-gray-600" />
      </div>

      <BottomSheetHeader
        hasNearbyLoaded={hasNearbyLoaded}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        counts={trimmedStopTimesCounts}
        dataConfig={dataConfig}
        dataLangs={dataLangs}
        showOperatingStopsOnly={showOperatingStopsOnly}
        showOriginOnly={showOriginOnly}
        showBoardableOnly={showBoardableOnly}
        viewId={viewId}
        selectedView={selectedView}
        infoLevel={infoLevel}
        presentRouteTypes={presentRouteTypes}
        hiddenRouteTypes={hiddenRouteTypes}
        presentAgencies={presentAgencies}
        hiddenAgencyIds={hiddenAgencyIds}
        onToggleShowOperatingStopsOnly={() =>
          setShowOperatingStopsOnlyOverride((v) => !(v ?? isLateNight))
        }
        onToggleShowOriginOnly={onToggleShowOriginOnly}
        onToggleShowBoardableOnly={onToggleShowBoardableOnly}
        onViewChange={setViewId}
        onToggleRouteType={toggleRouteType}
        onToggleAgency={toggleAgency}
      />
      <BottomSheetStops
        stopTimes={trimmedStopTimes}
        timetableEntriesStateByStopId={timetableEntriesStateByStopId}
        selectedStopId={selectedStopId}
        now={now}
        mapCenter={mapCenter}
        infoLevel={infoLevel}
        dataLangs={dataLangs}
        viewId={viewId}
        contentRef={contentRef}
        anchorIds={anchorIds}
        onStopSelected={handleStopSelected}
        onShowTimetable={onShowTimetable}
        onShowStopTimetable={onShowStopTimetable}
        onToggleAnchor={onToggleAnchor}
        onInspectTrip={onInspectTrip}
      />
    </div>
  );
}
