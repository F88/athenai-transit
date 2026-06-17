import { useEffect, useMemo, type RefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { StopWithContext, TripInspectionTarget } from '@/types/app/transit-composed';

import { createLogger } from '@/lib/logger';

import { useMapOverlayControls } from '@/hooks/use-map-overlay';
import { useScrollOverflow } from '@/hooks/use-scroll-overflow';

import { filterStopsWithinDistance } from '@/domain/transit/stop-meta-filter';
import type { StopTimeViewId } from '@/domain/transit/stop-time-views';
import { resolveTransitDisplayState } from '@/domain/transit/transit-info-display/transit-display-ui';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { ScrollToTopButton } from '@/components/shared/scroll-to-top-button';
import {
  buildBoardsForPolicy,
  transitDisplayViewSettings,
  VIEW_POLICY,
} from '@/components/transit-display/transit-display-view-policy';
import { SplitFlapTransitDisplays } from '@/components/transit-display/split-flap-transit-display';
import { TransitDisplayDashboard } from '@/components/transit-display/transit-display-dashboard';

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
  const { setHighlightedCircles, clearHighlightedCircles, setShowDistanceRings } =
    useMapOverlayControls();
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollOverflow = useScrollOverflow(contentRef, stopIdsKey);

  // Per-view nearby radius (the value this view's boards are filtered within
  // and the map's highlight circle is drawn at). Container-owned views always
  // have settings; the fallback is defensive only.
  const radiusMeters = transitDisplayViewSettings(viewId)?.nearbyRadiusMeters ?? NEARBY_RADIUS_M;

  // Distance filter: stops within `radiusMeters` of the center. Memoized so its
  // reference is stable while stopTimes / radius are unchanged -- otherwise the
  // transitDisplayData useMemo below (which depends on it) would rebuild every render.
  const nearbyStops = useMemo(
    () => filterStopsWithinDistance(stopTimes, radiusMeters),
    [stopTimes, radiusMeters],
  );

  const transitDisplayStatus = useMemo(
    () => ({ radius: radiusMeters, state: resolveTransitDisplayState(nearbyStops) }),
    [nearbyStops, radiusMeters],
  );

  // Log only when the status value (radius / state) changes, not every render.
  useEffect(() => {
    logger.debug(
      `TransitDisplayStatus: radius=${transitDisplayStatus.radius}, state=${transitDisplayStatus.state}`,
    );
  }, [transitDisplayStatus.radius, transitDisplayStatus.state]);

  // Draw the active view's nearby radius as a highlight circle on the hoisted
  // map via the shared store. Anchored to the fetched-stops center
  // (`mapCenter`); radius + color come from the same per-view settings the
  // boards are filtered by, so circle and boards agree. The cleanup clears it,
  // so leaving this view (or unmounting to a non-board view) removes the circle.
  useEffect(() => {
    const settings = transitDisplayViewSettings(viewId);
    if (mapCenter != null && settings != null) {
      setHighlightedCircles([
        {
          center: mapCenter,
          radius: settings.nearbyRadiusMeters,
          color: settings.highlightCircleColor,
        },
      ]);
      // setShowDistanceRings(false);
    }
    return () => {
      clearHighlightedCircles();
      setShowDistanceRings(true);
    };
  }, [mapCenter, viewId, setHighlightedCircles, clearHighlightedCircles, setShowDistanceRings]);

  // Build only the active view's boards. Each view carries its own radius (= its
  // own `nearbyStops`), so a view switch recomputes here -- cheap for the small
  // in-radius dataset and avoids building the inactive policy every render.
  const transitDisplayData = useMemo(() => {
    if (transitDisplayStatus.state !== 'ready') {
      return [];
    }
    const policy = VIEW_POLICY[viewId];
    if (!policy) {
      return [];
    }
    return buildBoardsForPolicy(nearbyStops, radiusMeters, policy, infoLevel);
  }, [viewId, nearbyStops, radiusMeters, infoLevel, transitDisplayStatus.state]);

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
              <SplitFlapTransitDisplays
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
              <TransitDisplayDashboard
                dataWithMeta={transitDisplayData}
                status={transitDisplayStatus}
                dataLangs={dataLangs}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
                enableRouteFilter={false}
              />
            );
          case 'route':
            return (
              <TransitDisplayDashboard
                dataWithMeta={transitDisplayData}
                status={transitDisplayStatus}
                dataLangs={dataLangs}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
                enableRouteFilter={true}
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
