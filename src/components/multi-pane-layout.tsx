import { StopPanel } from './stop-panel';
import { MapView } from './map/map-view';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import type { LayoutProps } from './layout-props';
import { useMultiPaneOrientation } from '../hooks/use-multi-pane-orientation';
import { MULTI_PANE_PANEL_SIZE } from '../utils/map-bottom-sheet-layout-preset';

/**
 * Multi-pane-mode layout for wide viewports: the stop panel and the map
 * sit as two resizable panes split by a draggable handle.
 *
 * The split orientation follows the viewport aspect (see
 * {@link useMultiPaneOrientation}): a landscape viewport splits
 * left/right with the panel on the left; a portrait viewport splits
 * top/bottom with the map on top.
 *
 * Each `ResizablePanel` carries a stable React `key` and `id`. On an
 * orientation flip (device rotation) the JSX child order swaps, but
 * React matches by `key` and `react-resizable-panels` matches by `id`,
 * so both panel instances are preserved — the inner `MapView` stays
 * mounted and Leaflet is not re-initialised. The `ResizablePanelGroup`
 * itself is not keyed by orientation; the library handles the
 * `orientation` prop change in place.
 */
export function MultiPaneLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: LayoutProps) {
  const orientation = useMultiPaneOrientation();
  const panelSize = MULTI_PANE_PANEL_SIZE[orientation];

  const sheetPane = (
    <ResizablePanel
      key="sheet"
      id="sheet"
      defaultSize={panelSize.defaultSize}
      minSize={panelSize.minSize}
      maxSize={panelSize.maxSize}
    >
      <StopPanel
        {...bottomSheetProps}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
      />
    </ResizablePanel>
  );

  const mapPane = (
    <ResizablePanel key="map" id="map">
      <div className="relative h-full w-full">
        <MapView {...mapViewProps} heightClassName="h-full" />
        {mapOverlay}
      </div>
    </ResizablePanel>
  );

  if (orientation === 'horizontal') {
    return (
      <ResizablePanelGroup orientation="horizontal" className="h-dvh w-full">
        {sheetPane}
        <ResizableHandle withHandle />
        {mapPane}
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup orientation="vertical" className="h-dvh w-full">
      {mapPane}
      <ResizableHandle withHandle />
      {sheetPane}
    </ResizablePanelGroup>
  );
}
