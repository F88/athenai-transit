import type { BottomSheetProps } from './bottom-sheet';
import { StopBrowser } from './stop-browser';

/**
 * Props for {@link StopPanel}: the stop-browsing content props — i.e.
 * {@link BottomSheetProps} without the bottom-sheet-only shell controls
 * (collapsed/expanded height, expand state).
 */
export type StopPanelProps = Omit<
  BottomSheetProps,
  'collapsedHeightClassName' | 'expandedHeightClassName' | 'expanded' | 'onExpandedChange'
>;

/**
 * Panel shell for the multi-pane layout: a plain surface that fills its
 * `ResizablePanel` and hosts a {@link StopBrowser}. No grab handle and
 * no drag-to-expand — pane sizing is owned by the resizable pane group.
 */
export function StopPanel({
  stopTimes,
  timetableEntriesStateByStopId,
  selectedStopId,
  hasNearbyLoaded,
  stopsRadius,
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
  onOpenTripInspectionByStopId,
  onInspectTrip,
}: StopPanelProps) {
  return (
    <div className="z-1000 flex h-full w-full flex-col overflow-hidden bg-white py-2 dark:bg-gray-900">
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
        onStopSelected={onStopSelected}
        onShowTimetable={onShowTimetable}
        onShowStopTimetable={onShowStopTimetable}
        onToggleAnchor={onToggleAnchor}
        onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
        onInspectTrip={onInspectTrip}
      />
    </div>
  );
}
