import type { StopTimeViewId } from '@/domain/transit/stop-time-views';

/**
 * StopBrowser state shared across the layout surfaces (multi-pane / bottom-sheet).
 * Held in AppLayout above the layout swap so it survives switching surfaces.
 * Group such cross-surface StopBrowser state here: adding another value is one
 * field on this type, not another prop threaded through every layer.
 */
export interface StopBrowserSharedState {
  /** Which stop-times view (tab) the StopBrowser shows. */
  viewId: StopTimeViewId;
  /** Surface-local route_type filter: route types hidden in the StopBrowser. */
  hiddenRouteTypes: Set<number>;
  /** Surface-local agency filter: agency IDs hidden in the StopBrowser. */
  hiddenAgencyIds: Set<string>;
}
