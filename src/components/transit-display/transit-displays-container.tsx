import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

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

  // Per-view coverage radius (the value this view's boards are filtered within
  // and the map's highlight circle is drawn at). The view's setting is the
  // default; the user can override it per view via the in-board radius selector.
  // Ephemeral: kept per viewId in memory, so a reload reverts to the default.
  // Container-owned views always have settings; the fallback is defensive only.
  const [coverageRadiusByView, setCoverageRadiusByView] = useState<
    Partial<Record<StopTimeViewId, number>>
  >({});
  const defaultRadiusMeters =
    transitDisplayViewSettings(viewId)?.defaultCoverageRadius ?? NEARBY_RADIUS_M;
  const coverageRadiusMeters = coverageRadiusByView[viewId] ?? defaultRadiusMeters;
  // Selectable options for this view (per-view). Falls back to just the default
  // radius for a view without explicit settings -- defensive, board views always
  // have them.
  const coverageRadiusOptions = transitDisplayViewSettings(viewId)?.coverageRadiusOptions ?? [
    defaultRadiusMeters,
  ];
  const handleCoverageRadiusChange = useCallback(
    (next: number) => {
      setCoverageRadiusByView((prev) => ({ ...prev, [viewId]: next }));
    },
    [viewId],
  );

  // Distance filter: stops within `radiusMeters` of the center. Memoized so its
  // reference is stable while stopTimes / radius are unchanged -- otherwise the
  // transitDisplayData useMemo below (which depends on it) would rebuild every render.
  const nearbyStops = useMemo(
    () => filterStopsWithinDistance(stopTimes, coverageRadiusMeters),
    [stopTimes, coverageRadiusMeters],
  );

  const transitDisplayStatus = useMemo(
    () => ({ radius: coverageRadiusMeters, state: resolveTransitDisplayState(nearbyStops) }),
    [nearbyStops, coverageRadiusMeters],
  );

  // Log only when the status value (radius / state) changes, not every render.
  useEffect(() => {
    logger.debug(
      `TransitDisplayStatus: radius=${transitDisplayStatus.radius}, state=${transitDisplayStatus.state}`,
    );
  }, [transitDisplayStatus.radius, transitDisplayStatus.state]);

  // Draw the active view's coverage radius as a highlight circle on the hoisted
  // map via the shared store. Anchored to the fetched-stops center
  // (`mapCenter`); the radius is the effective (possibly user-selected) value
  // the boards are filtered by and the color comes from the view settings, so
  // circle and boards agree. The cleanup clears it, so leaving this view (or
  // unmounting to a non-board view) removes the circle.
  useEffect(() => {
    const settings = transitDisplayViewSettings(viewId);
    if (mapCenter != null && settings != null) {
      setHighlightedCircles([
        {
          center: mapCenter,
          radius: coverageRadiusMeters,
          color: settings.highlightCircleColor,
        },
      ]);
      setShowDistanceRings(false);
    }
    return () => {
      clearHighlightedCircles();
      setShowDistanceRings(true);
    };
  }, [
    mapCenter,
    viewId,
    coverageRadiusMeters,
    setHighlightedCircles,
    clearHighlightedCircles,
    setShowDistanceRings,
  ]);

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
    return buildBoardsForPolicy(nearbyStops, coverageRadiusMeters, policy, infoLevel);
  }, [viewId, nearbyStops, coverageRadiusMeters, infoLevel, transitDisplayStatus.state]);

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
                coverageRadiusOptions={coverageRadiusOptions}
                selectedCoverageRadius={coverageRadiusMeters}
                onCoverageRadiusChange={handleCoverageRadiusChange}
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
                enableRouteFilter={false}
                coverageRadiusOptions={coverageRadiusOptions}
                selectedCoverageRadius={coverageRadiusMeters}
                onCoverageRadiusChange={handleCoverageRadiusChange}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
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
                enableRouteFilter={true}
                coverageRadiusOptions={coverageRadiusOptions}
                selectedCoverageRadius={coverageRadiusMeters}
                onCoverageRadiusChange={handleCoverageRadiusChange}
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
