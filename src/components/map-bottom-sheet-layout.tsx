import { useEffect, useState } from 'react';
import { BottomSheet } from './bottom-sheet';
import { MapView } from './map/map-view';
import type { LayoutProps } from './layout-props';
import { useViewportHeight } from '../hooks/use-viewport-height';
import { resolveMapBottomSheetLayoutPreset } from '../utils/map-bottom-sheet-layout-preset';
import { createLogger } from '../lib/logger';

const logger = createLogger('MapBottomSheetLayout');

/**
 * Simple-mode layout for small viewports: the map stacked above a
 * bottom sheet that the user can drag between collapsed and expanded
 * heights.
 */
export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: LayoutProps) {
  const [expanded, setExpanded] = useState(false);
  const viewportHeight = useViewportHeight();
  const layoutPreset = resolveMapBottomSheetLayoutPreset(viewportHeight);

  useEffect(() => {
    if (logger.isEnabled('debug')) {
      logger.debug(
        `viewportHeight=${viewportHeight}, collapsedMap=${layoutPreset.collapsedMapHeightClassName}, expandedMap=${layoutPreset.expandedMapHeightClassName}, collapsedSheet=${layoutPreset.collapsedSheetHeightClassName}, expandedSheet=${layoutPreset.expandedSheetHeightClassName}`,
      );
    }
  }, [layoutPreset, viewportHeight]);

  return (
    <>
      <div className="relative">
        <MapView
          {...mapViewProps}
          heightClassName={
            expanded
              ? layoutPreset.expandedMapHeightClassName
              : layoutPreset.collapsedMapHeightClassName
          }
        />
        {mapOverlay}
      </div>
      <BottomSheet
        {...bottomSheetProps}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeightClassName={layoutPreset.collapsedSheetHeightClassName}
        expandedHeightClassName={layoutPreset.expandedSheetHeightClassName}
      />
    </>
  );
}
