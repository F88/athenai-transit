import { useCallback, useRef, useState } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { TimetableEntriesState } from '../types/app/transit';
import type { GlobalFilter } from '../types/app/global-filter';
import type { StopsCounts } from '../types/app/stop';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { cn } from '../lib/utils';
import { StopBrowser } from './stop-browser';

type ExpandedStateAction = boolean | ((prevExpanded: boolean) => boolean);

const DRAG_THRESHOLD = 50;

export interface BottomSheetProps {
  /**
   * Stops to render. Already narrowed by the app-wide filters
   * (`globalFilter` + `enabledRouteTypes`); the surface-local agency /
   * route_type filters are applied downstream by StopBrowser.
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
  /**
   * Radius (metres) within which the displayed `stopTimes` were
   * collected, shown in the summary's "Xm / Xkm 圏内" label. Sourced
   * from the committed fetch (not the live perf profile) so the label
   * and the stop count change together on a perf-mode toggle.
   */
  stopsRadius: number;
  /**
   * The "now" for relative departure times ("in N min"). Usually the real
   * clock, but the user can pin it (time picker / `?time=`); when pinned
   * the countdown stops.
   */
  relativeTimeNow: Date;
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
   * settings-filter-applied stop list. Used by StopBrowserHeader to display
   * counts that stay stable as the user toggles `globalFilter` pills.
   */
  nearbyStopsCounts: StopsCounts;
  /**
   * Post-`globalFilter`, pre-surface-local-filter counts computed in
   * `app.tsx`. Threaded to StopBrowserHeader for UI that needs the
   * app-filtered base before operating/agency/route_type trimming.
   */
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
  /** Collapsed-state height class applied to the sheet root. */
  collapsedHeightClassName?: string;
  /** Expanded-state height class applied to the sheet root. */
  expandedHeightClassName?: string;
  /** Controlled expanded state. */
  expanded?: boolean;
  /** Controlled expanded state setter. */
  onExpandedChange?: (expanded: ExpandedStateAction) => void;
}

/**
 * Mobile bottom-sheet shell: fixed to the screen bottom with a grab
 * handle and drag-to-expand. Hosts a {@link StopBrowser} as its content.
 *
 * The wide-screen counterpart is `StopPanel`.
 */
export function BottomSheet({
  stopTimes,
  timetableEntriesStateByStopId,
  selectedStopId,
  isNearbyLoading: _isNearbyLoading,
  hasNearbyLoaded,
  stopsRadius,
  relativeTimeNow: now,
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
  collapsedHeightClassName = 'h-[40dvh]',
  expandedHeightClassName = 'h-[70dvh]',
  expanded: expandedProp,
  onExpandedChange,
}: BottomSheetProps) {
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
  const touchStartY = useRef(0);

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

  // Collapse the sheet when a stop is selected. This is a shell concern;
  // StopBrowser receives the wrapped callback and forwards it to the grid.
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
      <StopBrowser
        stopTimes={stopTimes}
        timetableEntriesStateByStopId={timetableEntriesStateByStopId}
        selectedStopId={selectedStopId}
        hasNearbyLoaded={hasNearbyLoaded}
        stopsRadius={stopsRadius}
        now={now}
        mapCenter={mapCenter}
        infoLevel={infoLevel}
        dataLangs={dataLangs}
        anchorIds={anchorIds}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        onStopSelected={handleStopSelected}
        onShowTimetable={onShowTimetable}
        onShowStopTimetable={onShowStopTimetable}
        onToggleAnchor={onToggleAnchor}
        onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
        onInspectTrip={onInspectTrip}
      />
    </div>
  );
}
