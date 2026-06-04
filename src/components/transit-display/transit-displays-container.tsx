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
  NEARBY_RADIUS_M,
  transitDisplayMaxEntriesFor,
  type TransitDisplayRouteGrouping,
} from '@/domain/transit/transit-info-display/build-transit-display-data';

export interface TransitDisplaysContainerProps {
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

  const displays = useMemo(() => {
    // Under development: trying out routeGrouping variants here. Keep the
    // commented-out alternatives below -- do not delete them.

    const transitDisplayRouteGrouping: TransitDisplayRouteGrouping = {
      // kind: 'none',
      kind: 'route',
    };
    // const transitDisplayRouteGrouping: TransitDisplayRouteGrouping = {
    //   kind: 'custom',
    //   groups: [
    //     [...ROUTE_TYPE_DISPLAY_ORDER], // as none
    //     ...ROUTE_TYPE_DISPLAY_ORDER.map((t) => [t]), // as route
    //     // ...(Object.values(ROUTE_TYPE_CATEGORY_GROUPS) as AppRouteTypeValue[][]), // as route type category
    //   ],
    // };
    return buildTransitDisplayDataSet(stopTimes, dataLangs, NEARBY_RADIUS_M, {
      maxEntries: transitDisplayMaxEntriesFor(infoLevel),
      routeGrouping: transitDisplayRouteGrouping,
    });
  }, [stopTimes, dataLangs, infoLevel]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      <TransitDisplays
        displays={displays}
        emptyMessage={t('stop.timetable.allFilteredOut')}
        now={now}
        mapCenter={mapCenter}
        infoLevel={infoLevel}
        size={size}
        onStopSelected={onStopSelected}
        onInspectTrip={onInspectTrip}
      />
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
    </div>
  );
}
