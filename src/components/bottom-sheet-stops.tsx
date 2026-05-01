import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useScrollFades } from '@/hooks/use-scroll-fades';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { AppRouteTypeValue, TimetableEntriesState } from '../types/app/transit';
import type { StopWithContext, TripInspectionTarget } from '../types/app/transit-composed';
import { ScrollFadeEdge } from './shared/scroll-fade-edge';
import { NearbyStop, type NearbyStopProps } from './nearby-stop';

/** Number of stops to render immediately without lazy loading. */
const EAGER_RENDER_COUNT = 6;

interface BottomSheetStopsProps {
  stopTimes: StopWithContext[];
  /**
   * Map from stop_id to the service state of the stop's upcoming entries
   * as returned by the repo, BEFORE any UI-level filter. Computed once
   * by {@link BottomSheet} from the unfiltered `stopTimes` and
   * passed down so each {@link NearbyStop} can tell "late-night service
   * ended" apart from "filter-hidden" when its filtered stop times are
   * empty.
   */
  stopServiceState: ReadonlyMap<string, TimetableEntriesState>;
  selectedStopId: string | null;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  viewId: string;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string, routeTypes: AppRouteTypeValue[]) => void;
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function BottomSheetStops({
  stopTimes,
  stopServiceState,
  selectedStopId,
  now,
  mapCenter,
  infoLevel,
  dataLangs,
  viewId,
  contentRef,
  anchorIds,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
  onInspectTrip,
}: BottomSheetStopsProps) {
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollFade = useScrollFades(contentRef, stopIdsKey);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      <div className="grid grid-cols-1 content-start gap-0 px-4 pb-0 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3">
        {stopTimes.map((swc, i) => {
          const props: NearbyStopProps = {
            data: swc,
            // Fallback to 'no-service' if the Map is missing this stop_id
            // (shouldn't happen — the Map and this `stopTimes` prop are
            // both derived from the same upstream stops list — but stay
            // defensive in case of race conditions during rerender).
            timetableEntriesState: stopServiceState.get(swc.stop.stop_id) ?? 'no-service',
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
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
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
