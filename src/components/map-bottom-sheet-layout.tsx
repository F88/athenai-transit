import { BottomSheet } from './bottom-sheet';
import type { LayoutProps } from './layout-props';
import { useSetMapSlotElement } from '../hooks/use-map-slot';

/**
 * Simple-mode overlay layout for small viewports.
 *
 * Renders two siblings:
 * 1. A **map slot** div fixed to the top 60dvh of the App root. Its
 *    only role is to declare to `MapViewContainer` where the visible
 *    map should be positioned; the hoisted MapView (App-root) tracks
 *    this slot's bounding rect and sizes its Leaflet container to
 *    match.
 * 2. The {@link BottomSheet} pinned to the bottom 40dvh (collapsed)
 *    / 70dvh (expanded) via `position: fixed`. It overlays the
 *    hoisted MapView from below, exactly as before the hoist.
 *
 * The slot div is `pointer-events: none` so map interactions in the
 * top 60dvh fall through to the MapView behind it.
 */
export function MapBottomSheetLayout({
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  stopBrowserState,
  onStopBrowserStateChange,
}: LayoutProps) {
  const setMapSlot = useSetMapSlotElement();
  return (
    <>
      <div
        ref={setMapSlot}
        className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh]"
        aria-hidden
      />
      <BottomSheet
        {...bottomSheetProps}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        stopBrowserState={stopBrowserState}
        onStopBrowserStateChange={onStopBrowserStateChange}
      />
    </>
  );
}
