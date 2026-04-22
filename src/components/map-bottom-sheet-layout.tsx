import { useState, type ReactNode } from 'react';
import { BottomSheet, type BottomSheetProps } from './bottom-sheet';
import { MapView, type MapViewProps } from './map/map-view';

const COLLAPSED_MAP_HEIGHT_CLASS = 'h-[60dvh]';
const EXPANDED_MAP_HEIGHT_CLASS = 'h-[60dvh]';
const COLLAPSED_SHEET_HEIGHT_CLASS = 'h-[40dvh]';
const EXPANDED_SHEET_HEIGHT_CLASS = 'h-[70dvh]';

interface MapBottomSheetLayoutProps {
  mapViewProps: MapViewProps;
  bottomSheetProps: BottomSheetProps;
  mapOverlay?: ReactNode;
}

export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
  mapOverlay,
}: MapBottomSheetLayoutProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="relative">
        <MapView
          {...mapViewProps}
          heightClassName={expanded ? EXPANDED_MAP_HEIGHT_CLASS : COLLAPSED_MAP_HEIGHT_CLASS}
        />
        {mapOverlay}
      </div>
      <BottomSheet
        {...bottomSheetProps}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeightClassName={COLLAPSED_SHEET_HEIGHT_CLASS}
        expandedHeightClassName={EXPANDED_SHEET_HEIGHT_CLASS}
      />
    </>
  );
}
