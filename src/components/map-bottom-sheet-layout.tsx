import { BottomSheet } from './bottom-sheet';
import { MapView } from './map/map-view';
import type { LayoutProps } from './layout-props';

/**
 * Simple-mode layout for small viewports: the map (fixed at 60dvh)
 * stacked above a bottom sheet (40dvh collapsed, expandable to 70dvh).
 * The sheet's collapsed / expanded heights and drag behaviour come
 * from BottomSheet's defaults; nothing here scales with viewport size.
 */
export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: LayoutProps) {
  return (
    <>
      <div className="relative">
        <MapView {...mapViewProps} heightClassName="h-[60dvh]" />
        {mapOverlay}
      </div>
      <BottomSheet
        {...bottomSheetProps}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
      />
    </>
  );
}
