import { useEffect } from 'react';
import { BottomSheet } from './bottom-sheet';
import { MapView } from './map/map-view';
import type { LayoutProps } from './layout-props';
import { useViewportHeight } from '../hooks/use-viewport-height';
import { resolveMapBottomSheetLayoutPreset } from '../utils/map-bottom-sheet-layout-preset';
import { createLogger } from '../lib/logger';

const logger = createLogger('MapBottomSheetLayout');

/**
 * Simple-mode layout for small viewports: a full-viewport map with a
 * bottom sheet overlaying its lower part. The sheet has collapsed and
 * expanded heights (drag to switch); the map stays at full viewport
 * height behind it.
 */
export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: LayoutProps) {
  const viewportHeight = useViewportHeight();
  const layoutPreset = resolveMapBottomSheetLayoutPreset(viewportHeight);

  useEffect(() => {
    if (logger.isEnabled('debug')) {
      logger.debug(
        `viewportHeight=${viewportHeight}, collapsedSheet=${layoutPreset.collapsedSheetHeightClassName}, expandedSheet=${layoutPreset.expandedSheetHeightClassName}`,
      );
    }
  }, [layoutPreset, viewportHeight]);

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
        collapsedHeightClassName={layoutPreset.collapsedSheetHeightClassName}
        expandedHeightClassName={layoutPreset.expandedSheetHeightClassName}
      />
    </>
  );
}
