import { useEffect, useState, type ReactNode } from 'react';
import { BottomSheet, type BottomSheetProps } from './bottom-sheet';
import { MapView, type MapViewProps } from './map/map-view';
import { useViewportHeight } from '../hooks/use-viewport-height';
import { resolveMapBottomSheetLayoutPreset } from '../utils/map-bottom-sheet-layout-preset';
import { createLogger } from '../lib/logger';
import type { GlobalFilter } from '../types/app/global-filter';
import type { StopsCounts } from '../types/app/stop';

const logger = createLogger('MapBottomSheetLayout');

interface MapBottomSheetLayoutProps {
  mapViewProps: Omit<MapViewProps, 'heightClassName'>;
  bottomSheetProps: Omit<
    BottomSheetProps,
    | 'collapsedHeightClassName'
    | 'expandedHeightClassName'
    | 'expanded'
    | 'onExpandedChange'
    | 'globalFilter'
    | 'nearbyStopsCounts'
    | 'filteredNearbyStopsCounts'
  >;
  /** App-wide filter state shared with BottomSheet (and forthcoming MapView etc.). */
  globalFilter: GlobalFilter;
  /**
   * Pre-`globalFilter` `NearbyStopsCounts` computed in `app.tsx` from the
   * settings-filter-applied stop list. Threaded through to BottomSheet /
   * BottomSheetHeader so filter pills can read counts that don't fluctuate
   * with `globalFilter` toggles.
   */
  nearbyStopsCounts: StopsCounts;
  /** Post-`globalFilter`, pre-BottomSheet-local-filter counts from `app.tsx`. */
  filteredNearbyStopsCounts: StopsCounts;
  mapOverlay?: ReactNode;
}

export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: MapBottomSheetLayoutProps) {
  const [expanded, setExpanded] = useState(false);
  const viewportHeight = useViewportHeight();
  const layoutPreset = resolveMapBottomSheetLayoutPreset(viewportHeight);

  useEffect(() => {
    logger.debug(
      `viewportHeight=${viewportHeight}, collapsedMap=${layoutPreset.collapsedMapHeightClassName}, expandedMap=${layoutPreset.expandedMapHeightClassName}, collapsedSheet=${layoutPreset.collapsedSheetHeightClassName}, expandedSheet=${layoutPreset.expandedSheetHeightClassName}`,
    );
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
