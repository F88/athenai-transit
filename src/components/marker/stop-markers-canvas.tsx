import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency, RouteType, Stop } from '../../types/app/transit';
import type { ContextualTimetableEntry, StopWithContext } from '../../types/app/transit-composed';
import { getRouteTypeColor } from '../../lib/leaflet-helpers';
import { primaryRouteType } from '../../domain/transit/route-type-color';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StopMarkersCanvas');
import { MARKER_STYLES } from '../../config/marker-styles';
import { StopSummary } from './stop-summary';

/**
 * Track markers with lazy tooltip binding to prevent duplicate listeners during incremental updates.
 *
 * **Risk**: If marker.off('mouseover', ...) is added in the future, registered markers will not be
 * re-bound (WeakSet retains the entry). Current code does not call off(), so no issue in practice.
 */
const tooltipBoundMarkers = new WeakSet<L.CircleMarker>();

interface StopMarkersCanvasProps {
  stops: Stop[];
  selectedStopId: string | null;
  routeTypeMap: Map<string, RouteType[]>;
  nearbyDepartures?: Map<string, ContextualTimetableEntry[]>;
  time?: Date;
  infoLevel: InfoLevel;
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures?: (stopId: string) => Promise<StopWithContext | null>;
  /** Whether to show tooltip on hover/select. Defaults to true. */
  showTooltip?: boolean;
  /** Shared Canvas renderer. When multiple Canvas instances coexist (e.g.
   *  nearby + far), sharing a single renderer avoids stacking multiple
   *  <canvas> elements that block each other's pointer events. */
  renderer: L.Canvas;
  /** When true, use incremental add/remove instead of full rebuild.
   *  Avoids flicker when `stops` changes frequently (e.g. far stops on pan).
   *  Marker z-ordering is not guaranteed in this mode. Defaults to false. */
  incremental?: boolean;
  /** Map of stop ID to agencies operating at each stop. */
  agenciesMap?: Map<string, Agency[]>;
  /** When true, disables dimming of non-selected stops. Selected stop highlight is preserved. */
  disableDimming?: boolean;
}

/**
 * Build HTML content for a stop summary (used by both tooltip and popup).
 *
 * Uses {@link StopSummary} via `renderToStaticMarkup` so the
 * display logic is shared with standard-mode tooltips.
 *
 * @param stop - The stop to display.
 * @param departures - Pre-fetched departure data, if available.
 * @param now - Current time for relative display.
 * @returns HTML string.
 */
function buildSummaryHtml(
  stop: Stop,
  routeTypes: RouteType[],
  agencies: Agency[],
  entries: ContextualTimetableEntry[] | undefined,
  now: Date | undefined,
  infoLevel: InfoLevel,
): string {
  return renderToStaticMarkup(
    <StopSummary
      stop={stop}
      routeTypes={routeTypes}
      agencies={agencies}
      entries={entries}
      now={now}
      infoLevel={infoLevel}
    />,
  );
}

/**
 * Render all stop markers using Leaflet's Canvas renderer imperatively.
 *
 * Uses `L.canvas()` renderer and `L.circleMarker()` directly via the
 * Leaflet API, bypassing react-leaflet's component abstraction which
 * does not reliably support Canvas renderer click events.
 *
 * Leaflet's Canvas renderer handles viewport culling automatically via
 * its `padding` option (`CircleMarker._empty()` / `Canvas._draw()`).
 */
export function StopMarkersCanvas({
  stops,
  selectedStopId,
  routeTypeMap,
  nearbyDepartures,
  time: now,
  infoLevel,
  onStopSelected,
  onFetchDepartures,
  showTooltip = true,
  renderer,
  incremental = false,
  agenciesMap,
  disableDimming = false,
}: StopMarkersCanvasProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const selectedTooltipRef = useRef<L.Tooltip | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Stable refs for callbacks and tooltip data so useEffect doesn't re-run on
  // identity changes, and lazy mouseover listeners always read the latest values.
  const onStopSelectedRef = useRef(onStopSelected);
  const onFetchDeparturesRef = useRef(onFetchDepartures);
  const tooltipDataRef = useRef({
    routeTypeMap,
    nearbyDepartures,
    now,
    infoLevel,
    agenciesMap,
    selectedStopId,
  });

  useEffect(() => {
    onStopSelectedRef.current = onStopSelected;
    onFetchDeparturesRef.current = onFetchDepartures;
    tooltipDataRef.current = {
      routeTypeMap,
      nearbyDepartures,
      now,
      infoLevel,
      agenciesMap,
      selectedStopId,
    };
  });

  useEffect(() => {
    const markerOpts = {
      selectedStopId,
      routeTypeMap,
      renderer,
      showTooltip,
      disableDimming,
      onStopSelectedRef,
      onFetchDeparturesRef,
      tooltipDataRef,
    };
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
    const group = layerGroupRef.current;

    const removeSelectedTooltip = () => {
      if (selectedTooltipRef.current) {
        map.removeLayer(selectedTooltipRef.current);
        selectedTooltipRef.current = null;
      }
    };

    // Early return when no stops to render
    if (stops.length === 0) {
      removeSelectedTooltip();
      if (markersRef.current.size > 0) {
        group.clearLayers();
        markersRef.current.clear();
      }
      return;
    }

    removeSelectedTooltip();

    const t0 = performance.now();

    if (incremental) {
      // Incremental: add new, remove gone, update existing styles
      const currentIds = new Set(stops.map((s) => s.stop_id));

      for (const [id, marker] of markersRef.current) {
        if (!currentIds.has(id)) {
          group.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }

      for (const stop of stops) {
        const existing = markersRef.current.get(stop.stop_id);
        if (existing) {
          updateMarkerStyle(existing, stop, markerOpts);
        } else {
          const marker = createMarker(stop, markerOpts);
          marker.addTo(group);
          markersRef.current.set(stop.stop_id, marker);
        }
      }

      const elapsed = Math.round(performance.now() - t0);
      logger.debug(`incremental: ${stops.length} stops in ${elapsed}ms`);
    } else {
      // Full rebuild: clear all and recreate
      group.clearLayers();
      markersRef.current.clear();

      for (const stop of stops) {
        const marker = createMarker(stop, markerOpts);
        marker.addTo(group);
        markersRef.current.set(stop.stop_id, marker);
      }

      const elapsed = Math.round(performance.now() - t0);
      logger.debug(`rebuild: ${stops.length} stops in ${elapsed}ms`);
    }

    // Show permanent tooltip for selected stop when tooltip display is enabled.
    // Unlike hover tooltips, this does not require `now` — StopSummary renders
    // stop name and agencies even without time data (matching DOM mode behavior).
    if (showTooltip && selectedStopId) {
      const selectedStop = stops.find((s) => s.stop_id === selectedStopId);
      if (selectedStop) {
        const entries = nearbyDepartures?.get(selectedStopId);
        const tooltip = L.tooltip({
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'w-max max-w-80 whitespace-normal',
        })
          .setLatLng([selectedStop.stop_lat, selectedStop.stop_lon])
          .setContent(
            buildSummaryHtml(
              selectedStop,
              routeTypeMap.get(selectedStopId) ?? [3],
              agenciesMap?.get(selectedStopId) ?? [],
              entries,
              now,
              infoLevel,
            ),
          );
        tooltip.addTo(map);
        selectedTooltipRef.current = tooltip;
      }
    }

    return () => {
      removeSelectedTooltip();
    };
  }, [
    map,
    renderer,
    stops,
    selectedStopId,
    routeTypeMap,
    nearbyDepartures,
    agenciesMap,
    now,
    infoLevel,
    showTooltip,
    incremental,
    disableDimming,
  ]);

  // Clean up layer group on unmount
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      markers.clear();
    };
  }, [map]);

  return null;
}

/** Ref holding the latest tooltip data, updated every render. */
type TooltipDataRef = React.RefObject<{
  routeTypeMap: Map<string, RouteType[]>;
  nearbyDepartures?: Map<string, ContextualTimetableEntry[]>;
  now?: Date;
  infoLevel: InfoLevel;
  agenciesMap?: Map<string, Agency[]>;
  selectedStopId: string | null;
}>;

/** Creates a CircleMarker with style, tooltip, and click handler. */
function createMarker(
  stop: Stop,
  opts: {
    selectedStopId: string | null;
    routeTypeMap: Map<string, RouteType[]>;
    renderer: L.Canvas;
    showTooltip: boolean;
    disableDimming?: boolean;
    onStopSelectedRef: React.RefObject<(stop: Stop) => void>;
    onFetchDeparturesRef: React.RefObject<
      ((stopId: string) => Promise<StopWithContext | null>) | undefined
    >;
    tooltipDataRef: TooltipDataRef;
  },
): L.CircleMarker {
  const isSelected = stop.stop_id === opts.selectedStopId;
  const routeTypes = opts.routeTypeMap.get(stop.stop_id) ?? [3 as RouteType];
  const color = getRouteTypeColor(primaryRouteType(routeTypes));
  const dimmed = !opts.disableDimming && !!opts.selectedStopId && !isSelected;

  const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
    renderer: opts.renderer,
    interactive: true,
    bubblingMouseEvents: false,
    radius: isSelected ? MARKER_STYLES.selectedRadius : MARKER_STYLES.normalRadius,
    fillColor: color,
    fillOpacity: dimmed ? MARKER_STYLES.dimmedOpacity : MARKER_STYLES.fillOpacity,
    color: isSelected ? MARKER_STYLES.selectedColor : MARKER_STYLES.normalColor,
    weight: isSelected ? MARKER_STYLES.selectedWeight : MARKER_STYLES.normalWeight,
    opacity: dimmed ? MARKER_STYLES.dimmedOpacity : 1,
  });

  // Lazy tooltip generation: bind only on mouseover to avoid HTML rendering overhead
  if (opts.showTooltip) {
    bindTooltipLazyListener(marker, stop, opts.tooltipDataRef);
  }

  marker.on('click', () => {
    logger.debug('click', stop.stop_id, stop.stop_name);
    opts.onStopSelectedRef.current(stop);
    if (opts.onFetchDeparturesRef.current) {
      void opts.onFetchDeparturesRef.current(stop.stop_id);
    }
  });

  return marker;
}

/** Updates an existing CircleMarker's style without recreating it.
 *
 * Tooltip content is NOT regenerated here. The lazy mouseover listener
 * reads the latest data from {@link TooltipDataRef} on each hover,
 * so stale tooltip content is resolved by unbinding + re-hover.
 */
function updateMarkerStyle(
  marker: L.CircleMarker,
  stop: Stop,
  opts: {
    selectedStopId: string | null;
    routeTypeMap: Map<string, RouteType[]>;
    showTooltip: boolean;
    disableDimming?: boolean;
    tooltipDataRef: TooltipDataRef;
  },
): void {
  const isSelected = stop.stop_id === opts.selectedStopId;
  const routeTypes = opts.routeTypeMap.get(stop.stop_id) ?? [3 as RouteType];
  const color = getRouteTypeColor(primaryRouteType(routeTypes));
  const dimmed = !opts.disableDimming && !!opts.selectedStopId && !isSelected;

  marker.setRadius(isSelected ? MARKER_STYLES.selectedRadius : MARKER_STYLES.normalRadius);
  marker.setStyle({
    fillColor: color,
    fillOpacity: dimmed ? MARKER_STYLES.dimmedOpacity : MARKER_STYLES.fillOpacity,
    color: isSelected ? MARKER_STYLES.selectedColor : MARKER_STYLES.normalColor,
    weight: isSelected ? MARKER_STYLES.selectedWeight : MARKER_STYLES.normalWeight,
    opacity: dimmed ? MARKER_STYLES.dimmedOpacity : 1,
  });

  // Lazy tooltip: register listener if not yet bound (WeakSet guards duplicates).
  // Listener reads latest data from tooltipDataRef on each hover.
  if (opts.showTooltip) {
    bindTooltipLazyListener(marker, stop, opts.tooltipDataRef);
  }

  // Unbind stale tooltip when deps change (refreshes content on next hover)
  if (opts.showTooltip && marker.getTooltip()) {
    marker.unbindTooltip();
  }
}

/**
 * Attach mouseover listener to bind tooltip on demand, exactly once per marker.
 * Prevents duplicate listener registration during incremental updates.
 *
 * The listener reads the latest data from `tooltipDataRef` on each hover,
 * so tooltip content always reflects current props even after incremental updates.
 *
 * @internal
 */
function bindTooltipLazyListener(
  marker: L.CircleMarker,
  stop: Stop,
  tooltipDataRef: TooltipDataRef,
): void {
  if (tooltipBoundMarkers.has(marker)) {
    return; // Already bound, skip to prevent duplicate listeners
  }
  tooltipBoundMarkers.add(marker);

  marker.on('mouseover', () => {
    if (marker.getTooltip()) {
      return; // Tooltip already bound, skip
    }
    const data = tooltipDataRef.current;
    // Selected stop has a dedicated permanent tooltip on the map;
    // skip hover tooltip to avoid duplication.
    if (data.selectedStopId === stop.stop_id) {
      return;
    }
    const routeTypes = data.routeTypeMap.get(stop.stop_id) ?? [3 as RouteType];
    marker.bindTooltip(
      buildSummaryHtml(
        stop,
        routeTypes,
        data.agenciesMap?.get(stop.stop_id) ?? [],
        data.nearbyDepartures?.get(stop.stop_id),
        data.now,
        data.infoLevel,
      ),
      { direction: 'top', offset: [0, -8] },
    );
  });
}
