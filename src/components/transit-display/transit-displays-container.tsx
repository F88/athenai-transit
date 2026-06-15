import { useEffect, useMemo, type RefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { StopWithContext, TripInspectionTarget } from '@/types/app/transit-composed';

import { createLogger } from '@/lib/logger';

import { useScrollOverflow } from '@/hooks/use-scroll-overflow';

import { filterStopsWithinDistance } from '@/domain/transit/stop-meta-filter';
import type { StopTimeViewId } from '@/domain/transit/stop-time-views';
import { resolveTransitDisplayState } from '@/domain/transit/transit-info-display/transit-display-ui';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { ScrollToTopButton } from '@/components/shared/scroll-to-top-button';
import {
  buildBoardsForPolicy,
  ROUTE_VIEW_POLICY,
  TRANSIT_DISPLAY_POLICY,
  VIEW_POLICY,
} from '@/components/transit-display/transit-display-view-policy';
import { TransitDisplays } from '@/components/transit-display/transit-displays';
import { TransitDisplays2 } from '@/components/transit-display/transit-displays-2';

const logger = createLogger('TransitDisplaysContainer');

export const NEARBY_RADIUS_M = 100;

export interface TransitDisplaysContainerProps {
  /**
   * Which transit-display view is active: `transit-display` (classic split-flap
   * board) or `transit-display-2` (modern design). Selects the presentation.
   */
  viewId: StopTimeViewId;
  stopTimes: StopWithContext[];
  /** Current wall-clock reference time for relative time display. */
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display size (drives row text size); resolved from container width like the header. */
  size: ExtendedDisplaySize;
  dataLangs: readonly string[];
  contentRef: RefObject<HTMLDivElement | null>;
  /** Select the target stop (fired together with trip inspection on a time tap). */
  onStopSelected: (stopId: string) => void;
  /** Optional callback for opening trip inspection for one concrete stop event. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function TransitDisplaysContainer({
  viewId,
  stopTimes,
  now,
  mapCenter,
  infoLevel,
  size,
  dataLangs,
  contentRef,
  onStopSelected,
  onInspectTrip,
}: TransitDisplaysContainerProps) {
  const { t } = useTranslation();
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollOverflow = useScrollOverflow(contentRef, stopIdsKey);

  // distance filter: stops within radiusMeters of the center. Memoized so its
  // reference is stable while stopTimes are unchanged -- otherwise the
  // transitDisplayData useMemo below (which depends on it) would rebuild every render.
  const nearbyStops = useMemo(
    () => filterStopsWithinDistance(stopTimes, NEARBY_RADIUS_M),
    [stopTimes],
  );

  const transitDisplayStatus = useMemo(
    () => ({ radius: NEARBY_RADIUS_M, state: resolveTransitDisplayState(nearbyStops) }),
    [nearbyStops],
  );

  // Log only when the status value (radius / state) changes, not every render.
  useEffect(() => {
    logger.debug(
      `TransitDisplayStatus: radius=${transitDisplayStatus.radius}, state=${transitDisplayStatus.state}`,
    );
  }, [transitDisplayStatus.radius, transitDisplayStatus.state]);

  // Per-policy memos: data depends only on (nearbyStops, infoLevel, ready
  // state), so switching the view does not invalidate either one. Both are
  // computed eagerly because the per-stop dataset is small (NEARBY_RADIUS_M)
  // and the cost is dominated by the active view's render anyway.
  const memoizedTransitDisplayBoards = useMemo(
    () =>
      transitDisplayStatus.state === 'ready'
        ? buildBoardsForPolicy(nearbyStops, NEARBY_RADIUS_M, TRANSIT_DISPLAY_POLICY, infoLevel)
        : [],
    [nearbyStops, infoLevel, transitDisplayStatus.state],
  );
  const memoizedRouteViewBoards = useMemo(
    () =>
      transitDisplayStatus.state === 'ready'
        ? buildBoardsForPolicy(nearbyStops, NEARBY_RADIUS_M, ROUTE_VIEW_POLICY, infoLevel)
        : [],
    [nearbyStops, infoLevel, transitDisplayStatus.state],
  );

  // Select the memo for the active view via VIEW_POLICY lookup (identity
  // compare on the policy reference -- adding a new view = new memo + new
  // VIEW_POLICY entry + a new branch here, all explicit).
  const transitDisplayData = useMemo(() => {
    const policy = VIEW_POLICY[viewId];
    if (policy === ROUTE_VIEW_POLICY) {
      return memoizedRouteViewBoards;
    }
    if (policy === TRANSIT_DISPLAY_POLICY) {
      return memoizedTransitDisplayBoards;
    }
    return [];
  }, [viewId, memoizedTransitDisplayBoards, memoizedRouteViewBoards]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollOverflow.update}
    >
      {scrollOverflow.hasContentAbove && <ScrollFadeEdge position="top" />}
      {/*
        Each viewId is listed explicitly so new views render through a fresh
        branch instead of falling through a catch-all. Currently:
        - 'transit-display'    -> classic split-flap board
        - 'transit-display-2'  -> modern design board
        - 'route'              -> uses the modern design board for now (will
                                  switch to a dedicated component if needed)
      */}
      {(() => {
        switch (viewId) {
          case 'transit-display':
            return (
              <TransitDisplays
                dataWithMeta={transitDisplayData}
                status={transitDisplayStatus}
                dataLangs={dataLangs}
                emptyMessage={t('stop.timetable.allFilteredOut')}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            );
          case 'transit-display-2':
            return (
              <TransitDisplays2
                dataWithMeta={transitDisplayData}
                status={transitDisplayStatus}
                dataLangs={dataLangs}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            );
          case 'route':
            return (
              <TransitDisplays2
                dataWithMeta={transitDisplayData}
                status={transitDisplayStatus}
                dataLangs={dataLangs}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            );
          default:
            return null;
        }
      })()}
      {scrollOverflow.hasContentBelow && <ScrollFadeEdge position="bottom" />}
      <ScrollToTopButton
        visible={scrollOverflow.hasContentAbove}
        size={size}
        targetRef={contentRef}
      />
    </div>
  );
}
