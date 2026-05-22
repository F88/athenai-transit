import { useEffect, useRef } from 'react';
import { MapBottomSheetLayout } from './map-bottom-sheet-layout';
import { MultiPaneLayout } from './multi-pane-layout';
import type { LayoutProps } from './layout-props';
import { useLayoutMode } from '../hooks/use-layout-mode';
import { createLogger } from '../lib/logger';

const logger = createLogger('AppLayout');

/**
 * Top-level layout selector.
 *
 * Renders the layout component for the current {@link useLayoutMode}:
 * `MapBottomSheetLayout` for `'simple'` mode (small screens), or
 * `MultiPaneLayout` for `'multi-pane'` mode (large screens).
 *
 * Switching modes unmounts one layout and mounts the other, so the map
 * and bottom sheet are remounted. This cost is accepted by design: it
 * only happens when the viewport crosses the wide breakpoint — a rare
 * event on real devices (phones stay simple, desktops stay multi-pane).
 */
export function AppLayout({
  mapViewProps,
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  mapOverlay,
}: LayoutProps) {
  const layoutMode = useLayoutMode();
  const Layout = layoutMode === 'multi-pane' ? MultiPaneLayout : MapBottomSheetLayout;

  // Log actual mode switches only. The ref holds the previous value so
  // the initial mount is skipped — a switch triggers a full remount of
  // the active layout (map + bottom sheet), which is worth tracing.
  const prevLayoutModeRef = useRef(layoutMode);
  useEffect(() => {
    if (prevLayoutModeRef.current !== layoutMode) {
      logger.info(`layout mode switched: ${prevLayoutModeRef.current} -> ${layoutMode}`);
      prevLayoutModeRef.current = layoutMode;
    }
  }, [layoutMode]);

  return (
    <Layout
      mapViewProps={mapViewProps}
      bottomSheetProps={bottomSheetProps}
      globalFilter={globalFilter}
      nearbyStopsCounts={nearbyStopsCounts}
      filteredNearbyStopsCounts={filteredNearbyStopsCounts}
      mapOverlay={mapOverlay}
    />
  );
}
