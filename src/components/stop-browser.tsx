import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { APP_ROUTE_TYPES } from '../config/route-types';
import { collectPresentAgencies } from '../domain/transit/collect-present-agencies';
import { collectPresentRouteTypes } from '../domain/transit/collect-present-route-types';
import { computeStopsCounts } from '../domain/transit/compute-stops-counts';
import {
  DEFAULT_VIEW_ID,
  STOP_TIMES_VIEWS,
  type StopTimeViewId,
} from '../domain/transit/stop-time-views';
import { filterByAgency, filterByRouteType } from '../domain/transit/timetable-filter';
import { useElementRect } from '../hooks/use-element-rect';
import type { GlobalFilter } from '../types/app/global-filter';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { StopsCounts } from '../types/app/stop';
import type { Agency, AppRouteTypeValue, TimetableEntriesState } from '../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { resolveContainerDisplaySize } from './shared/display-size';
import { StopBrowserHeader } from './stop-browser-header';
import { StopGrid } from './stop-grid';
import { TransitDisplaysContainer } from './transit-display/transit-displays';

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

export interface StopBrowserProps {
  /**
   * Stops to render. Already narrowed by the app-wide filters
   * (`globalFilter` + `enabledRouteTypes`); StopBrowser only applies
   * its own surface-local filters (agency / route_type).
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
  /** Radius (metres) within which the displayed stops were collected; shown in the header summary. */
  stopsRadius: number;
  /**
   * Reference "now" for relative departure times (the surface's
   * `relativeTimeNow`, forwarded under the rendering-subtree's `now`
   * convention); pinnable, so the countdown freezes when pinned.
   */
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  /** App-wide filter state shared across surfaces. */
  globalFilter: GlobalFilter;
  /**
   * Pre-`globalFilter` `NearbyStopsCounts` from `app.tsx`. Used by the
   * header to display counts that stay stable as `globalFilter` pills
   * toggle.
   */
  nearbyStopsCounts: StopsCounts;
  /** Post-`globalFilter`, pre-surface-local-filter counts from `app.tsx`. */
  filteredNearbyStopsCounts: StopsCounts;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string) => void;
  /** Optional callback for opening trip inspection from a stop ID. */
  onOpenTripInspectionByStopId?: (stopId: string) => void;
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * The nearby-stop browsing surface: a filter / summary header above a
 * scrollable grid of stop cards.
 *
 * Shell-agnostic — hosted inside a `BottomSheet` (mobile) or a
 * multi-pane `ResizablePanel`. Owns the surface-local filter state
 * (view / agency / route_type) and trims each stop's stopTimes
 * accordingly; app-wide filters are already applied upstream in
 * `app.tsx`.
 */
export function StopBrowser({
  stopTimes,
  timetableEntriesStateByStopId,
  selectedStopId,
  // Intentionally unused (`_` prefix): by current spec the stop list does
  // not render a re-fetch loading state. Kept rather than removed -- it is
  // a meaningful loading-state signal that may be surfaced later. Held here
  // (the shared StopBrowser) so both BottomSheet and StopPanel forward it.
  isNearbyLoading: _isNearbyLoading,
  hasNearbyLoaded,
  stopsRadius,
  now,
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
  onOpenTripInspectionByStopId,
  onInspectTrip,
}: StopBrowserProps) {
  const {
    showOriginOnly,
    showBoardableOnly,
    omitEmptyStops,
    isOmitEmptyStopsForced,
    onToggleShowOriginOnly,
    onToggleShowBoardableOnly,
    onToggleOmitEmptyStops,
  } = globalFilter;
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const rootRect = useElementRect(rootElement);
  const [viewId, setViewId] = useState<StopTimeViewId>(DEFAULT_VIEW_ID);
  const [hiddenRouteTypes, setHiddenRouteTypes] = useState<Set<number>>(() => new Set());
  const [hiddenAgencyIds, setHiddenAgencyIds] = useState<Set<string>>(() => new Set());
  const selectedView = STOP_TIMES_VIEWS.find((v) => v.id === viewId);
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

  // App-wide origin / boardable filters and the empty-stop omission
  // policy are already applied upstream in `app.tsx`. Here we apply only
  // the surface-local agency / route_type filters: trim each surviving
  // stop's inner stopTimes. This never drops stops — a stop whose
  // stopTimes are all removed stays visible with the "allFilteredOut"
  // fallback message, decoupling "which stops are listed" from "what is
  // shown inside each stop".
  const trimmedStopTimes = useMemo(() => {
    if (hiddenAgencyIds.size === 0 && hiddenRouteTypes.size === 0) {
      return stopTimes;
    }
    return stopTimes.map((swc) => {
      let trimmed = swc.stopTimes;
      if (hiddenAgencyIds.size > 0) {
        trimmed = filterByAgency(trimmed, hiddenAgencyIds);
      }
      if (hiddenRouteTypes.size > 0) {
        trimmed = filterByRouteType(trimmed, hiddenRouteTypes);
      }
      return trimmed === swc.stopTimes ? swc : { ...swc, stopTimes: trimmed };
    });
  }, [stopTimes, hiddenAgencyIds, hiddenRouteTypes]);

  const trimmedStopTimesCounts: StopsCounts = useMemo(
    () => computeStopsCounts(trimmedStopTimes),
    [trimmedStopTimes],
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

  const headerSize = resolveContainerDisplaySize(rootRect?.width ?? 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={setRootElement}>
      <StopBrowserHeader
        hasNearbyLoaded={hasNearbyLoaded}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        counts={trimmedStopTimesCounts}
        stopsRadius={stopsRadius}
        dataLangs={dataLangs}
        omitEmptyStops={omitEmptyStops}
        isOmitEmptyStopsForced={isOmitEmptyStopsForced}
        showOriginOnly={showOriginOnly}
        showBoardableOnly={showBoardableOnly}
        viewId={viewId}
        selectedView={selectedView}
        infoLevel={infoLevel}
        size={headerSize}
        presentRouteTypes={presentRouteTypes}
        hiddenRouteTypes={hiddenRouteTypes}
        presentAgencies={presentAgencies}
        hiddenAgencyIds={hiddenAgencyIds}
        onToggleOmitEmptyStops={onToggleOmitEmptyStops}
        onToggleShowOriginOnly={onToggleShowOriginOnly}
        onToggleShowBoardableOnly={onToggleShowBoardableOnly}
        onViewChange={setViewId}
        onToggleRouteType={toggleRouteType}
        onToggleAgency={toggleAgency}
      />
      {viewId === 'transit-display' ? (
        <TransitDisplaysContainer
          stopTimes={trimmedStopTimes}
          dataLangs={dataLangs}
          contentRef={contentRef}
        />
      ) : (
        <StopGrid
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
          onStopSelected={onStopSelected}
          onShowTimetable={onShowTimetable}
          onShowStopTimetable={onShowStopTimetable}
          onToggleAnchor={onToggleAnchor}
          onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
          onInspectTrip={onInspectTrip}
        />
      )}
    </div>
  );
}
