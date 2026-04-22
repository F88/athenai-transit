import { useEffect, useState, type ReactNode } from 'react';
import { BottomSheet, type BottomSheetProps } from './bottom-sheet';
import { MapView, type MapViewProps } from './map/map-view';
import { useViewportHeight } from '../hooks/use-viewport-height';
import { resolveMapBottomSheetLayoutPreset } from '../utils/map-bottom-sheet-layout-preset';
import { createLogger } from '../lib/logger';

const logger = createLogger('MapBottomSheetLayout');

interface MapBottomSheetLayoutProps {
  mapViewProps: Omit<MapViewProps, 'heightClassName'>;
  bottomSheetProps: Omit<
    BottomSheetProps,
    'collapsedHeightClassName' | 'expandedHeightClassName' | 'expanded' | 'onExpandedChange'
  >;
  mapOverlay?: ReactNode;
}

export function MapBottomSheetLayout({
  mapViewProps,
  bottomSheetProps,
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
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeightClassName={layoutPreset.collapsedSheetHeightClassName}
        expandedHeightClassName={layoutPreset.expandedSheetHeightClassName}
      />
    </>
  );
}
