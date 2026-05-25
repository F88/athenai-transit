import { useEffect, useRef } from 'react';
import { MapBottomSheetLayout } from './map-bottom-sheet-layout';
import { MultiPaneLayout } from './multi-pane-layout';
import type { LayoutProps } from './layout-props';
import { useLayoutMode } from '../hooks/use-layout-mode';
import { createLogger } from '../lib/logger';

const logger = createLogger('AppLayout');

/**
 * Top-level overlay-layout selector.
 *
 * MapView is hoisted to App root and rendered there — never inside any
 * layout — so this component only picks the overlay surface for the
 * current {@link useLayoutMode}: `MapBottomSheetLayout` for `'simple'`
 * mode (small screens) or `MultiPaneLayout` for `'multi-pane'` mode
 * (large screens).
 *
 * Switching layout modes unmounts one overlay and mounts the other,
 * but the hoisted MapView is unaffected: Leaflet is not re-initialised
 * and the map's centre / zoom / tile state are preserved across the
 * boundary.
 */
export function AppLayout({
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
}: LayoutProps) {
  const layoutMode = useLayoutMode();
  const Layout = layoutMode === 'multi-pane' ? MultiPaneLayout : MapBottomSheetLayout;

  // Log actual mode switches only. The ref holds the previous value so
  // the initial mount is skipped — a switch triggers a remount of the
  // active overlay, which is worth tracing.
  const prevLayoutModeRef = useRef(layoutMode);
  useEffect(() => {
    if (prevLayoutModeRef.current !== layoutMode) {
      logger.info(`layout mode switched: ${prevLayoutModeRef.current} -> ${layoutMode}`);
      prevLayoutModeRef.current = layoutMode;
    }
  }, [layoutMode]);

  return (
    <Layout
      bottomSheetProps={bottomSheetProps}
      globalFilter={globalFilter}
      nearbyStopsCounts={nearbyStopsCounts}
      filteredNearbyStopsCounts={filteredNearbyStopsCounts}
    />
  );
}
