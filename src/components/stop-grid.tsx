import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { FilteredTimetableEntriesState } from '@/types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '@/types/app/transit-composed';

import { useScrollOverflow } from '@/hooks/use-scroll-overflow';

import type { StopTimeViewId } from '@/domain/transit/stop-time-views';

import { NearbyStop, type NearbyStopProps } from '@/components/nearby-stop';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import { ScrollToTopButton } from '@/components/shared/scroll-to-top-button';

/** Number of stops to render immediately without lazy loading. */
const EAGER_RENDER_COUNT = 6;

interface StopGridProps {
  stopTimes: StopWithContext[];
  /**
   * Map from stop_id to the resolved per-stop display state
   * ({@link FilteredTimetableEntriesState}), computed once in `StopBrowser`.
   * Forwarded to each {@link NearbyStop} as its `filteredState`.
   */
  filteredStateByStopId: ReadonlyMap<string, FilteredTimetableEntriesState>;
  selectedStopId: string | null;
  now: Date;
  mapCenter: LatLng | null;
  /** Display size (drives row text size); resolved from container width like the header. */
  size: ExtendedDisplaySize;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  viewId: StopTimeViewId;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string) => void;
  /** Optional callback for opening trip inspection from a stop ID. */
  onOpenTripInspectionByStopId?: (stopId: string) => void;
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function StopGrid({
  stopTimes,
  filteredStateByStopId,
  selectedStopId,
  now,
  mapCenter,
  size,
  infoLevel,
  dataLangs,
  viewId,
  contentRef,
  anchorIds,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
  onOpenTripInspectionByStopId,
  onInspectTrip,
}: StopGridProps) {
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollOverflow = useScrollOverflow(contentRef, stopIdsKey);

  return (
    <div
      className="@container relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollOverflow.update}
    >
      {scrollOverflow.hasContentAbove && <ScrollFadeEdge position="top" />}
      {/*
       * Column count keys off the scroll container's own width (container
       * query), not the viewport — so the grid stays comfortable whether
       * this list fills a full-width mobile bottom sheet or the narrower
       * wide-layout side panel.
       */}
      <div className="grid grid-cols-1 content-start gap-0 px-4 pb-0 @xl:grid-cols-2 @xl:gap-x-4 @5xl:grid-cols-3">
        {stopTimes.map((swc, i) => {
          const props: NearbyStopProps = {
            data: swc,
            // Fallback to 'no-service' if the Map is missing this stop_id
            // (shouldn't happen — the Map and this `stopTimes` prop are
            // both derived from the same upstream stops list — but stay
            // defensive in case of race conditions during rerender).
            filteredState: filteredStateByStopId.get(swc.stop.stop_id) ?? 'no-service',
            isSelected: selectedStopId === swc.stop.stop_id,
            now,
            mapCenter,
            infoLevel,
            dataLangs,
            viewId,
            isAnchor: anchorIds.has(swc.stop.stop_id),
            onStopSelected,
            onShowTimetable,
            onShowStopTimetable,
            onToggleAnchor,
            onOpenTripInspectionByStopId,
            onInspectTrip,
          };
          // Eager render: first N stops, or the selected stop (so scroll-to-selected works)
          return i < EAGER_RENDER_COUNT || props.isSelected ? (
            <NearbyStop key={swc.stop.stop_id} {...props} />
          ) : (
            <LazyNearbyStop key={swc.stop.stop_id} scrollRoot={contentRef} {...props} />
          );
        })}
      </div>
      {scrollOverflow.hasContentBelow && <ScrollFadeEdge position="bottom" />}
      <ScrollToTopButton
        visible={scrollOverflow.hasContentAbove}
        size={size}
        targetRef={contentRef}
      />
    </div>
  );
}

/**
 * Renders NearbyStop only when the placeholder enters the viewport.
 * Once visible, stays mounted (no unmount on scroll-away).
 */
function LazyNearbyStop(props: NearbyStopProps & { scrollRoot: RefObject<HTMLDivElement | null> }) {
  const { scrollRoot, ...nearbyStopProps } = props;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current, rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  if (isVisible) {
    return <NearbyStop {...nearbyStopProps} />;
  }

  // Placeholder with approximate height to prevent scroll jump
  return <div ref={ref} className="mb-2 h-32 rounded-lg bg-[#f5f7fa] dark:bg-gray-800" />;
}
