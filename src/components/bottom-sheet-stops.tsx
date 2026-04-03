import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { StopWithContext } from '../types/app/transit-composed';
import { NearbyStop, type NearbyStopProps } from './nearby-stop';

/** Number of stops to render immediately without lazy loading. */
const EAGER_RENDER_COUNT = 6;

interface BottomSheetStopsProps {
  filteredDepartures: StopWithContext[];
  selectedStopId: string | null;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  lang: string;
  viewId: string;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Set of stop IDs currently in the anchor list. */
  anchorIds: Set<string>;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for a stop. */
  onToggleAnchor: (stopId: string) => void;
}

export function BottomSheetStops({
  filteredDepartures,
  selectedStopId,
  now,
  mapCenter,
  infoLevel,
  lang,
  viewId,
  contentRef,
  anchorIds,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
}: BottomSheetStopsProps) {
  return (
    <div
      className="grid flex-1 grid-cols-1 content-start gap-0 overflow-y-auto px-4 pb-0 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3"
      ref={contentRef}
    >
      {filteredDepartures.map((swc, i) => {
        const props: NearbyStopProps = {
          data: swc,
          isSelected: selectedStopId === swc.stop.stop_id,
          now,
          mapCenter,
          infoLevel,
          lang,
          viewId,
          isAnchor: anchorIds.has(swc.stop.stop_id),
          onStopSelected,
          onShowTimetable,
          onShowStopTimetable,
          onToggleAnchor,
        };
        // Eager render: first N stops, or the selected stop (so scroll-to-selected works)
        return i < EAGER_RENDER_COUNT || props.isSelected ? (
          <NearbyStop key={swc.stop.stop_id} {...props} />
        ) : (
          <LazyNearbyStop key={swc.stop.stop_id} scrollRoot={contentRef} {...props} />
        );
      })}
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
