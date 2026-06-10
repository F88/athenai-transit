import { useMemo, type RefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { StopWithContext, TripInspectionTarget } from '@/types/app/transit-composed';

import { useScrollFades } from '@/hooks/use-scroll-fades';

import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { TransitDisplays } from '@/components/transit-display/transit-displays';
import {
  buildTransitDisplayDataSet,
  resolveTransitDisplayState,
  sortTransitDisplayDataWithMetaData,
  transitDisplayMaxEntriesFor,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import { ROUTE_TYPE_DISPLAY_ORDER } from '@/domain/transit/route-type-display-order';
import type { StopTimeViewId } from '@/domain/transit/stop-time-views';
import type { AppRouteTypeValue } from '@/types/app/transit';
import { TransitDisplays2 } from './transit-displays-2';
import { filterStopsWithinDistance } from '@/domain/transit/stop-meta-filter';
import { createLogger } from '@/lib/logger';

const logger = createLogger('TransitDisplaysContainer');

export const NEARBY_RADIUS_M = 100;

/**
 * Route types whose boards are NOT split by direction: bus, trolleybus, and
 * ferry. Their `direction_id` is route-local / arbitrary, and at a shared stop
 * many routes converge (ferries especially fan out hub-and-spoke across several
 * pontoons), so a per-direction split would mix unrelated routes; the headsign
 * carries the destination instead. Everything else (rail / subway / tram /
 * monorail / ...) is split, where a line's direction is the meaningful axis.
 */
const NO_SPLIT_ROUTE_TYPES: readonly AppRouteTypeValue[] = [3, 11, 4];

/** Every other route type is split by direction, kept in display order. */
const DIRECTION_SPLIT_ROUTE_TYPES: readonly AppRouteTypeValue[] = ROUTE_TYPE_DISPLAY_ORDER.filter(
  (routeType) => !NO_SPLIT_ROUTE_TYPES.includes(routeType),
);

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
  const scrollFade = useScrollFades(contentRef, stopIdsKey);

  // distance filter: stops within radiusMeters of the center
  const nearbyStops: StopWithContext[] = filterStopsWithinDistance(stopTimes, NEARBY_RADIUS_M);

  const transitDisplayStatus = {
    radius: NEARBY_RADIUS_M,
    state: resolveTransitDisplayState(nearbyStops),
  };
  logger.debug(`TransitDisplayStatus: ${JSON.stringify(transitDisplayStatus)}`);

  const transitDisplayData = useMemo(() => {
    // Build boards only when there is something to show; `no-stops` / `no-service`
    // produce no boards, so skip the work and let TransitDisplays2 render the
    // reason from `transitDisplayStatus`.
    if (transitDisplayStatus.state !== 'ready') {
      return [];
    }

    const maxEntries = transitDisplayMaxEntriesFor(infoLevel);

    // Per-mode direction policy is composed here rather than inside the builder:
    // NO_SPLIT_ROUTE_TYPES keep both directions on one board, everything else
    // splits by direction. The builder takes a single splitByDirection flag, so
    // this is two calls (each scoped to its route types via a custom grouping).
    // buildTransitDisplayDataSet attaches each display's meta but leaves rows raw.
    // The concatenated result is re-ordered into the canonical UI order by
    // sortTransitDisplayDataWithMetaData (so the order is correct
    // regardless of which modes share a stop -- the raw concat is not in display
    // order). Rows stay raw here; TransitDisplays resolves them into UI data.

    const directionUnsplitRaw = buildTransitDisplayDataSet(nearbyStops, NEARBY_RADIUS_M, {
      maxEntries,
      routeGrouping: { kind: 'custom', groups: NO_SPLIT_ROUTE_TYPES.map((t) => [t]) },
      splitByDirection: false,
    });
    const directionSplitRaw = buildTransitDisplayDataSet(nearbyStops, NEARBY_RADIUS_M, {
      maxEntries,
      routeGrouping: { kind: 'custom', groups: DIRECTION_SPLIT_ROUTE_TYPES.map((t) => [t]) },
      splitByDirection: true,
    });

    return sortTransitDisplayDataWithMetaData([
      //
      ...directionUnsplitRaw,
      ...directionSplitRaw,
    ]);
  }, [infoLevel, nearbyStops, transitDisplayStatus.state]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      {/* transit-display: the classic split-flap board. */}
      {/* transit-display-2: the modern design board. */}
      {viewId === 'transit-display' ? (
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
      ) : (
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
      )}
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
    </div>
  );
}
