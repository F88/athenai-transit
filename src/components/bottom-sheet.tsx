import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types/app/map';
import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, AppRouteTypeValue, TimetableEntriesState } from '../types/app/transit';
import type { StopWithContext } from '../types/app/transit-composed';
import { collectPresentAgencies } from '../domain/transit/collect-present-agencies';
import { collectPresentRouteTypes } from '../domain/transit/collect-present-route-types';
import { filterByAgency, filterByRouteType } from '../domain/transit/timetable-filter';
import { getTimetableEntriesState } from '../domain/transit/timetable-utils';
import { STOP_TIMES_VIEWS, DEFAULT_VIEW_ID } from '../domain/transit/stop-time-views';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import { APP_ROUTE_TYPES } from '../config/route-types';
import { BottomSheetHeader } from './bottom-sheet-header';
import { BottomSheetStops } from './bottom-sheet-stops';

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

export interface NearbyStopsCounts {
  /** Total number of nearby stops before any filtering. */
  total: number;
  /** Stops with at least one upcoming entry. */
  active: number;
  /** Stops remaining after all filters (showOperatingStopsOnly, routeType, agency). */
  filtered: number;
}

interface BottomSheetProps {
  stopTimes: StopWithContext[];
  selectedStopId: string | null;
  isNearbyLoading: boolean;
  hasNearbyLoaded: boolean;
  dataConfig: DataConfig;
  time: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string, routeTypes: AppRouteTypeValue[]) => void;
}

export function BottomSheet({
  stopTimes,
  selectedStopId,
  isNearbyLoading: _isNearbyLoading,
  hasNearbyLoaded,
  dataConfig,
  time: now,
  mapCenter,
  infoLevel,
  dataLang,
  anchorIds,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
}: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
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

  // Per-stop state of the upcoming entries as returned by the repo,
  // BEFORE any UI-level filter. Used by NearbyStop to distinguish
  // "late-night / service ended" (upcoming already empty pre-filter)
  // from "filter-hidden" (upcoming had entries but the user's active
  // filters removed them all). Depends only on `stopTimes` so
  // it is not recomputed when the user toggles filter pills.
  const upcomingEntriesStates = useMemo(() => {
    const map = new Map<string, TimetableEntriesState>();
    for (const swc of stopTimes) {
      map.set(swc.stop.stop_id, getTimetableEntriesState([...swc.stopTimes]));
    }
    return map;
  }, [stopTimes]);

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

  const filteredStopTimes = useMemo(() => {
    // Order is deliberate:
    //
    // 1. Stop-level filter (showOperatingStopsOnly) runs FIRST on the pre-filter list.
    //    `showOperatingStopsOnly` means "keep only stops that have upcoming entries
    //    today" — a property of the stop itself, independent of what the
    //    user has chosen to hide inside. Running it before the stopTime
    //    filters ensures the check is against pre-filter `stopTimes.length`
    //    and does not conflate with the user's agency/route_type filters.
    //
    // 2. StopTime-level filters (agency / route_type) run AFTER on the
    //    surviving stops. They only mutate each stop's `stopTimes` array
    //    and never drop stops — a stop whose stopTimes are all removed
    //    stays visible and shows the "allFilteredOut" fallback message.
    //    This decouples "which stops are in the list" from "what is shown
    //    inside each stop".
    let result = stopTimes;
    if (showOperatingStopsOnly) {
      result = result.filter((swc) => swc.stopTimes.length > 0);
    }
    if (hiddenAgencyIds.size > 0) {
      result = result.map((swc) => ({
        ...swc,
        stopTimes: filterByAgency(swc.stopTimes, hiddenAgencyIds),
      }));
    }
    if (hiddenRouteTypes.size > 0) {
      result = result.map((swc) => ({
        ...swc,
        stopTimes: filterByRouteType(swc.stopTimes, hiddenRouteTypes),
      }));
    }
    return result;
  }, [stopTimes, showOperatingStopsOnly, hiddenRouteTypes, hiddenAgencyIds]);

  const counts: NearbyStopsCounts = useMemo(
    () => ({
      total: stopTimes.length,
      active: stopTimes.filter((swc) => swc.stopTimes.length > 0).length,
      filtered: filteredStopTimes.length,
    }),
    [stopTimes, filteredStopTimes],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaY) < DRAG_THRESHOLD) {
      return;
    }

    if (deltaY < 0) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, []);

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
    [onStopSelected],
  );

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-1000 flex touch-none flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.15)] transition-[height] duration-300 ease-in-out dark:bg-gray-900 ${expanded ? 'h-[70dvh]' : 'h-[40dvh]'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex shrink-0 cursor-grab justify-center py-2 pb-1"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="h-1 w-9 rounded-sm bg-[#bdbdbd] dark:bg-gray-600" />
      </div>

      <BottomSheetHeader
        hasNearbyLoaded={hasNearbyLoaded}
        counts={counts}
        dataConfig={dataConfig}
        dataLang={dataLang}
        showOperatingStopsOnly={showOperatingStopsOnly}
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
        onViewChange={setViewId}
        onToggleRouteType={toggleRouteType}
        onToggleAgency={toggleAgency}
      />
      <BottomSheetStops
        filteredStopTimes={filteredStopTimes}
        upcomingEntriesStates={upcomingEntriesStates}
        selectedStopId={selectedStopId}
        now={now}
        mapCenter={mapCenter}
        infoLevel={infoLevel}
        dataLang={dataLang}
        viewId={viewId}
        contentRef={contentRef}
        anchorIds={anchorIds}
        onStopSelected={handleStopSelected}
        onShowTimetable={onShowTimetable}
        onShowStopTimetable={onShowStopTimetable}
        onToggleAnchor={onToggleAnchor}
      />
    </div>
  );
}
