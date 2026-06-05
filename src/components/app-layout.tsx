import { useEffect, useRef, useState } from 'react';

import { DEFAULT_VIEW_ID } from '@/domain/transit/stop-time-views';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { createLogger } from '@/lib/logger';
import type { StopBrowserSharedState } from '@/types/app/stop-browser';

import type { LayoutProps } from '@/components/layout-props';
import { MapBottomSheetLayout } from '@/components/map-bottom-sheet-layout';
import { MultiPaneLayout } from '@/components/multi-pane-layout';

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
}: Omit<LayoutProps, 'stopBrowserState' | 'onStopBrowserStateChange'>) {
  const layoutMode = useLayoutMode();
  const Layout = layoutMode === 'multi-pane' ? MultiPaneLayout : MapBottomSheetLayout;

  // StopBrowser state shared across layout surfaces, held above the layout swap
  // so it survives switching between the multi-pane and bottom-sheet surfaces.
  const [stopBrowserState, setStopBrowserState] = useState<StopBrowserSharedState>(() => ({
    viewId: DEFAULT_VIEW_ID,
    hiddenRouteTypes: new Set(),
    hiddenAgencyIds: new Set(),
  }));

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
      stopBrowserState={stopBrowserState}
      onStopBrowserStateChange={setStopBrowserState}
    />
  );
}
