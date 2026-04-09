import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types/app/map';
import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, AppRouteTypeValue } from '../types/app/transit';
import type { StopWithContext } from '../types/app/transit-composed';
import { collectPresentAgencies, filterStopsByAgency } from '../domain/transit/agency-filter';
import { DEPARTURE_VIEWS, DEFAULT_VIEW_ID } from '../domain/transit/departure-views';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import { APP_ROUTE_TYPES } from '../config/route-types';
import { useInfoLevel } from '../hooks/use-info-level';
import { BottomSheetHeader } from './bottom-sheet-header';
import { BottomSheetStops } from './bottom-sheet-stops';

const DRAG_THRESHOLD = 50;

/** Auto-enable "active only" filter at 22:00 in service day minutes. */
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

const ROUTE_TYPE_ORDER: number[] = [...APP_ROUTE_TYPES.map(({ value }) => value)].sort(
  (a, b) =>
    (ROUTE_TYPE_PRIORITY[a] ?? Number.POSITIVE_INFINITY) -
    (ROUTE_TYPE_PRIORITY[b] ?? Number.POSITIVE_INFINITY),
);

export interface NearbyStopsCounts {
  /** Total number of nearby stops before any filtering. */
  total: number;
  /** Stops with at least one upcoming departure. */
  active: number;
  /** Stops remaining after all filters (activeOnly, routeType, agency). */
  filtered: number;
}

interface BottomSheetProps {
  nearbyDepartures: StopWithContext[];
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
  nearbyDepartures,
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
  const [activeOnlyOverride, setActiveOnlyOverride] = useState<boolean | null>(null);
  const activeOnly = activeOnlyOverride ?? isLateNight;
  const [hiddenRouteTypes, setHiddenRouteTypes] = useState<Set<number>>(() => new Set());
  const [hiddenAgencyIds, setHiddenAgencyIds] = useState<Set<string>>(() => new Set());
  const info = useInfoLevel(infoLevel);
  const selectedView = DEPARTURE_VIEWS.find((v) => v.id === viewId);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Route types present in the current nearby stops.
  const presentRouteTypes = useMemo(() => {
    const types = new Set<number>();
    for (const swc of nearbyDepartures) {
      for (const rt of swc.routeTypes) {
        types.add(rt);
      }
    }
    const routeOrderSet = new Set(ROUTE_TYPE_ORDER);
    const known = ROUTE_TYPE_ORDER.filter((rt) => types.has(rt));
    const extras = [...types].filter((rt) => !routeOrderSet.has(rt)).sort((a, b) => a - b);
    return [...known, ...extras];
  }, [nearbyDepartures]);

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

  const presentAgencies = useMemo(
    () => collectPresentAgencies(nearbyDepartures),
    [nearbyDepartures],
  );

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

  const filteredDepartures = useMemo(() => {
    let result = nearbyDepartures;
    if (activeOnly) {
      result = result.filter((swc) => swc.departures.length > 0);
    }
    // Drop-off-only stop filtering is intentionally disabled (isSimpleEnabled is always true).
    // StopMarkers always show all stops on the map, so hiding them from NearbyStop
    // would be inconsistent. Drop-off-only stops display a "降車専用" badge instead.
    // See Issue #64 for future handling of drop-off-only + end-of-service states.
    if (!info.isSimpleEnabled) {
      result = result.filter((swc) => swc.isBoardableOnServiceDay || swc.departures.length === 0);
    }
    if (hiddenRouteTypes.size > 0) {
      result = result.filter((swc) => !swc.routeTypes.every((rt) => hiddenRouteTypes.has(rt)));
    }
    if (hiddenAgencyIds.size > 0 && presentAgencies.length > 1) {
      result = filterStopsByAgency(result, hiddenAgencyIds);
    }
    return result;
  }, [
    nearbyDepartures,
    activeOnly,
    info.isSimpleEnabled,
    hiddenRouteTypes,
    hiddenAgencyIds,
    presentAgencies,
  ]);

  const counts: NearbyStopsCounts = useMemo(
    () => ({
      total: nearbyDepartures.length,
      active: nearbyDepartures.filter((swc) => swc.departures.length > 0).length,
      filtered: filteredDepartures.length,
    }),
    [nearbyDepartures, filteredDepartures],
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

  // Stable key that changes only when the stop list composition changes,
  // not on every time-tick refresh of departure data.
  const stopIdsKey = useMemo(
    () => nearbyDepartures.map((d) => d.stop.stop_id).join(','),
    [nearbyDepartures],
  );

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
        activeOnly={activeOnly}
        viewId={viewId}
        selectedView={selectedView}
        infoLevel={infoLevel}
        presentRouteTypes={presentRouteTypes}
        hiddenRouteTypes={hiddenRouteTypes}
        presentAgencies={presentAgencies}
        hiddenAgencyIds={hiddenAgencyIds}
        onToggleActiveOnly={() => setActiveOnlyOverride((v) => !(v ?? isLateNight))}
        onViewChange={setViewId}
        onToggleRouteType={toggleRouteType}
        onToggleAgency={toggleAgency}
      />
      <BottomSheetStops
        filteredDepartures={filteredDepartures}
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
