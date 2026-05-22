import type { ReactNode } from 'react';
import type { BottomSheetProps } from './bottom-sheet';
import type { MapViewProps } from './map/map-view';
import type { GlobalFilter } from '../types/app/global-filter';
import type { StopsCounts } from '../types/app/stop';

/**
 * Shared props for a top-level layout component.
 *
 * Both layout-mode implementations — `MapBottomSheetLayout` (simple
 * mode) and `MultiPaneLayout` (multi-pane mode) — accept this exact
 * shape. `AppLayout` picks one via {@link useLayoutMode} and forwards
 * these props unchanged.
 */
export interface LayoutProps {
  mapViewProps: Omit<MapViewProps, 'heightClassName'>;
  bottomSheetProps: Omit<
    BottomSheetProps,
    | 'collapsedHeightClassName'
    | 'expandedHeightClassName'
    | 'expanded'
    | 'onExpandedChange'
    | 'variant'
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
