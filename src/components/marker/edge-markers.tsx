import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { EdgeMarker } from '../../types/app/map';
import type { InfoLevel } from '../../types/app/settings';
import type { EffectiveRenderMode } from '../../utils/render-mode';
import type { Agency, RouteType, Stop } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';
import { buildEdgeMarkers } from '../../lib/edge-marker';
import { getSafeAreaInsets } from '../../lib/safe-area';
import { EdgeMarkersDom } from './edge-markers-dom';
import { EdgeMarkersCanvas } from './edge-markers-canvas';

interface EdgeMarkersSwitchProps {
  map: L.Map;
  stops: Stop[];
  routeTypeMap: Map<string, RouteType[]>;
  agenciesMap?: Map<string, Agency[]>;
  now: Date;
  infoLevel: InfoLevel;
  renderMode: EffectiveRenderMode;
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures: (stopId: string) => Promise<StopWithContext | null>;
}

/**
 * Calculates and renders edge markers for off-screen nearby stops.
 *
 * Listens to Leaflet map events (move/zoom/resize) directly and determines
 * which stops are outside the viewport, rendering directional arrows at
 * screen edges for those stops.
 */
export function EdgeMarkersSwitch({
  map,
  stops,
  routeTypeMap,
  agenciesMap,
  now,
  infoLevel,
  renderMode,
  onStopSelected,
  onFetchDepartures,
}: EdgeMarkersSwitchProps) {
  const [markers, setMarkers] = useState<EdgeMarker[]>(() =>
    buildEdgeMarkers(map, stops, routeTypeMap, getSafeAreaInsets().top, 0),
  );

  useEffect(() => {
    const recalculate = () => {
      setMarkers(buildEdgeMarkers(map, stops, routeTypeMap, getSafeAreaInsets().top, 0));
    };
    // Recalculate when deps change (stops/routeTypeMap update)
    recalculate();
    map.on('move', recalculate);
    map.on('zoom', recalculate);
    map.on('resize', recalculate);
    return () => {
      map.off('move', recalculate);
      map.off('zoom', recalculate);
      map.off('resize', recalculate);
    };
  }, [map, stops, routeTypeMap]);

  // Measure actual container height via ref + ResizeObserver.
  // On iOS Safari, window.innerHeight includes the address bar height,
  // which differs from the actual map container height (60dvh).
  // This causes bottom edge markers to receive wrong alignment and get clipped.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // blockSize equals height in horizontal writing mode
        if (entry.contentBoxSize?.[0]) {
          setContainerHeight(entry.contentBoxSize[0].blockSize);
        } else {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Always show distance — the arrow indicates direction, distance is the primary info
  const showDistance = true;

  // Always render wrapper so ResizeObserver stays registered even when markers are empty.
  // Without this, containerHeight would remain stale (window.innerHeight) if markers
  // first appear after the initial mount.
  return (
    <div ref={wrapperRef} className="pointer-events-none absolute inset-0 z-500 overflow-hidden">
      {markers.length > 0 &&
        (renderMode === 'lightweight' ? (
          <EdgeMarkersCanvas
            markers={markers}
            showDistance={showDistance}
            mapContainer={map.getContainer()}
            infoLevel={infoLevel}
            agenciesMap={agenciesMap}
            onStopSelected={onStopSelected}
            containerHeight={containerHeight}
          />
        ) : (
          <EdgeMarkersDom
            markers={markers}
            now={now}
            infoLevel={infoLevel}
            showDistance={showDistance}
            agenciesMap={agenciesMap}
            onStopSelected={onStopSelected}
            onFetchDepartures={onFetchDepartures}
            containerHeight={containerHeight}
          />
        ))}
    </div>
  );
}
