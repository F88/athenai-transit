import type { Dispatch, SetStateAction } from 'react';
import type { BottomSheetProps } from './bottom-sheet';
import type { GlobalFilter } from '../types/app/global-filter';
import type { StopsCounts } from '../types/app/stop';
import type { StopBrowserSharedState } from '../types/app/stop-browser';

/**
 * Shared props for a top-level overlay layout component.
 *
 * Since MapView is hoisted to App root and rendered there (always
 * mounted, never re-created on mode / orientation transitions), the
 * overlay layouts only manage the stop-browser surface — `mapViewProps`
 * and `mapOverlay` are intentionally absent from this interface.
 */
export interface LayoutProps {
  bottomSheetProps: Omit<
    BottomSheetProps,
    | 'collapsedHeightClassName'
    | 'expandedHeightClassName'
    | 'expanded'
    | 'onExpandedChange'
    | 'globalFilter'
    | 'nearbyStopsCounts'
    | 'filteredNearbyStopsCounts'
    | 'stopBrowserState'
    | 'onStopBrowserStateChange'
  >;
  /**
   * App-wide filter state shared with the active stop-browser surface —
   * `BottomSheet` in simple mode and `StopPanel` in multi-pane mode.
   * MapView itself receives its filter state via its own hoisted prop
   * channel from `app.tsx`, not via this interface.
   */
  globalFilter: GlobalFilter;
  /**
   * Pre-`globalFilter` `NearbyStopsCounts` computed in `app.tsx` from the
   * settings-filter-applied stop list. Threaded through to BottomSheet /
   * StopBrowserHeader so filter pills can read counts that don't fluctuate
   * with `globalFilter` toggles.
   */
  nearbyStopsCounts: StopsCounts;
  /** Post-`globalFilter`, pre-BottomSheet-local-filter counts from `app.tsx`. */
  filteredNearbyStopsCounts: StopsCounts;
  /**
   * StopBrowser state shared across surfaces, owned by `AppLayout` (held above
   * the layout swap so the view tab and surface-local filters survive switching
   * surfaces). Forwarded to the active surface alongside the App-owned
   * `globalFilter`.
   */
  stopBrowserState: StopBrowserSharedState;
  /** Updater for {@link stopBrowserState} (accepts a value or an updater fn). */
  onStopBrowserStateChange: Dispatch<SetStateAction<StopBrowserSharedState>>;
}
