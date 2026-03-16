import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { InfoLevel, PerfMode, RenderMode, Theme } from '../../types/app/settings';
import type {
  Agency,
  RouteType,
  Stop,
  StopWithContext,
  StopWithMeta,
} from '../../types/app/transit';
import { enableDoubleTapZoom } from '../../lib/double-tap-zoom';
import { smoothMoveTo, toBounds, toCenter } from '../../lib/leaflet-helpers';
import { StopMarkers } from '../marker/stop-markers';
import type { UserLocation } from '../../types/app/map';
import { InfoPanel } from '../panel/info-panel';
import { MapLayerPanel } from '../panel/map-layer-panel';
import { MapNavigationPanel } from '../panel/map-navigation-panel';
import { RenderingPanel } from '../panel/rendering-panel';
import { StopControlPanel } from '../panel/stop-control-panel';
import { StopTypeFilterPanel } from '../panel/stop-type-filter-panel';

import { CLICK_SUPPRESSION_MS, shouldSuppressMapClick } from '../../utils/map-click';
import { createLogger } from '../../utils/logger';
import type { StopHistoryEntry } from '../../domain/transit/stop-history';
import type { SelectionInfo } from '../../domain/transit/route-selection';
import {
  buildDepartureGroupsMap,
  filterVisibleRouteShapes,
} from '../../domain/transit/route-selection';
import { RouteShapePolylines } from './route-shape-polyline';
import { resolveRenderModes } from '../../utils/render-mode';
import { excludeStopsByIds, filterStopsByType } from '../../domain/transit/stop-filter';
import { TILE_SOURCES } from '../../config/tile-sources';
import { EdgeMarkersSwitch } from '../marker/edge-markers';
// import { SelectionIndicator } from './selection-indicator';
import { StopHistory } from '../stop-history';

import { INITIAL_CENTER, INITIAL_ZOOM } from '../../config/map-defaults';
import { DISTANCE_BANDS } from '../../utils/distance-style';
import { SelectionIndicator } from './selection-indicator';

const USER_LOCATION_ICON = L.divIcon({
  className: '',
  html: `<div class="stop-icon-user-location"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const logger = createLogger('MapView');

function MapEventHandler({
  onBoundsChanged,
  onZoomChanged,
  onMapClicked,
  doubleTapDrag,
}: {
  onBoundsChanged: (bounds: Bounds, center: LatLng) => void;
  onZoomChanged: (zoom: number) => void;
  onMapClicked: () => void;
  doubleTapDrag: 'zoom-in' | 'zoom-out';
}) {
  const map = useMap();
  const lastZoomTimeRef = useRef(0);

  useMapEvents({
    moveend: () => {
      logger.verbose('moveend detected');
      onBoundsChanged(toBounds(map), toCenter(map));
    },
    zoomend: () => {
      lastZoomTimeRef.current = Date.now();
      logger.verbose('zoomend detected, timestamp:', lastZoomTimeRef.current);
      onZoomChanged(map.getZoom());
    },
    click: () => {
      if (shouldSuppressMapClick(lastZoomTimeRef.current, Date.now(), CLICK_SUPPRESSION_MS)) {
        logger.verbose('click suppressed (likely pinch-zoom artifact)');
        return;
      }
      logger.verbose('click detected, invoking onMapClicked');
      onMapClicked();
    },
  });

  // Enable double-tap + slide-to-zoom gesture
  useEffect(() => {
    return enableDoubleTapZoom(map, { doubleTapDrag });
  }, [map, doubleTapDrag]);

  // Fire initial bounds and zoom on mount
  useEffect(() => {
    onBoundsChanged(toBounds(map), toCenter(map));
    onZoomChanged(map.getZoom());
  }, [map, onBoundsChanged, onZoomChanged]);

  return null;
}

/** Displays the current zoom level in the bottom-left corner of the map. */
function ZoomDisplay() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return (
    <div className="pointer-events-none absolute bottom-1 left-3 z-1000 rounded bg-black/50 px-2 py-1 font-mono text-base leading-none text-white">
      Z{zoom}
    </div>
  );
}

const DISTANCE_RINGS = DISTANCE_BANDS.map((b) => ({ radius: b.max, color: b.color }));

const ROUTE_SHAPE_OUTLINE_PANE = 'routeShapeOutlinePane';
const ROUTE_SHAPE_OUTLINE_PANE_Z = 340; // below fill pane
const ROUTE_SHAPE_PANE = 'routeShapePane';
const ROUTE_SHAPE_PANE_Z = 350; // below overlayPane (400)

/** Creates custom Leaflet panes for route shapes so they render below stops. */
function RouteShapePanes() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(ROUTE_SHAPE_OUTLINE_PANE)) {
      const outlinePane = map.createPane(ROUTE_SHAPE_OUTLINE_PANE);
      outlinePane.style.zIndex = String(ROUTE_SHAPE_OUTLINE_PANE_Z);
    }
    if (!map.getPane(ROUTE_SHAPE_PANE)) {
      const pane = map.createPane(ROUTE_SHAPE_PANE);
      pane.style.zIndex = String(ROUTE_SHAPE_PANE_Z);
    }
  }, [map]);
  return null;
}

/** Exposes the Leaflet map instance to the parent via callback. */
function MapRef({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

function PanToFocus({ position }: { position: LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      logger.debug('position is null, skipping');
      return;
    }
    logger.debug(`panning to lat=${position.lat}, lng=${position.lng}`);
    smoothMoveTo(map, [position.lat, position.lng], map.getZoom());
  }, [map, position]);

  return null;
}

function DistanceRings() {
  const map = useMap();
  const [center, setCenter] = useState<[number, number]>(() => {
    const c = map.getCenter();
    return [c.lat, c.lng];
  });

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      setCenter([c.lat, c.lng]);
    },
  });

  return (
    <>
      {DISTANCE_RINGS.map(({ radius, color }) => (
        <Circle
          key={radius}
          center={center}
          radius={radius}
          interactive={false}
          pathOptions={{
            color,
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 4,
            opacity: 0.5,
          }}
        />
      ))}
    </>
  );
}

interface MapViewProps {
  /** Stops within the current viewport. Used for simplified marker rendering. */
  inBoundStops: StopWithMeta[];
  /** Stops within the nearby radius. Used for edge markers and detailed display. */
  radiusStops: StopWithMeta[];
  /** Departure info for nearby stops. Displayed in bottom sheet and marker details. */
  nearbyDepartures: StopWithContext[];

  selectedStopId: string | null;
  focusPosition: LatLng | null;
  routeTypeMap: Map<string, RouteType[]>;
  agenciesMap: Map<string, Agency[]>;
  routeShapes: RouteShape[];
  selectionInfo: SelectionInfo | null;
  visibleStopTypes: Set<number>;
  visibleRouteShapes: Set<number>;
  tileIndex: number | null;
  renderMode: RenderMode;
  perfMode: PerfMode;
  infoLevel: InfoLevel;
  time: Date;
  onBoundsChanged: (bounds: Bounds, center: LatLng) => void;
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures: (stopId: string) => Promise<StopWithContext | null>;
  onToggleStopType: (rt: number) => void;
  onToggleBusShapes: () => void;
  onToggleNonBusShapes: () => void;
  onCycleTile: () => void;
  onToggleRenderMode: () => void;
  onTogglePerfMode: () => void;
  onCycleInfoLevel: () => void;
  theme: Theme;
  doubleTapDrag: 'zoom-in' | 'zoom-out';
  onToggleDarkMode: () => void;
  onDeselectStop: () => void;
  onRouteShapeSelected: (routeId: string) => void;
  onSearchClick: () => void;
  onInfoClick: () => void;
  /** Stop selection history entries, most recent first. */
  stopHistory: StopHistoryEntry[];
  /** Called when a history entry is chosen. */
  onHistorySelect: (stop: Stop) => void;
}

export function MapView({
  inBoundStops,
  radiusStops,
  selectedStopId,
  focusPosition,
  nearbyDepartures,
  routeTypeMap,
  agenciesMap,
  routeShapes,
  selectionInfo,
  visibleStopTypes,
  visibleRouteShapes,
  tileIndex,
  renderMode,
  perfMode,
  infoLevel,
  time: now,
  onBoundsChanged,
  onStopSelected,
  onFetchDepartures,
  onToggleStopType,
  onToggleBusShapes,
  onToggleNonBusShapes,
  onCycleTile,
  onToggleRenderMode,
  onTogglePerfMode,
  onCycleInfoLevel,
  theme,
  doubleTapDrag,
  onToggleDarkMode,
  onDeselectStop,
  onRouteShapeSelected,
  onSearchClick,
  onInfoClick,
  stopHistory,
  onHistorySelect,
}: MapViewProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  const { nearby: nearbyRenderMode, far: farRenderMode } = resolveRenderModes(renderMode, zoom);

  // Single shared Canvas renderer for all StopMarkersCanvas instances.
  // Avoids multiple <canvas> elements stacking and blocking pointer events.
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const departureGroupsMap = useMemo(
    () => buildDepartureGroupsMap(nearbyDepartures),
    [nearbyDepartures],
  );

  const selectedRouteIds = selectionInfo?.routeIds ?? null;

  // stop selection: hide unrelated routes (only show routes passing through the stop)
  // route selection: keep all routes visible (selected is highlighted, others are dimmed)
  const hideUnselected = selectionInfo?.type === 'stop';
  const visibleShapes = useMemo(
    () =>
      filterVisibleRouteShapes(routeShapes, visibleRouteShapes, selectedRouteIds, hideUnselected),
    [routeShapes, visibleRouteShapes, selectedRouteIds, hideUnselected],
  );

  const filteredNearbyStops = useMemo(
    () =>
      filterStopsByType(radiusStops, routeTypeMap, visibleStopTypes)
        .sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
        .map((m) => m.stop),
    [radiusStops, routeTypeMap, visibleStopTypes],
  );

  // farStops = inBoundStops excluding radiusStops
  const filteredFarStops = useMemo(() => {
    const nearbyIds = new Set(radiusStops.map((s) => s.stop.stop_id));
    return filterStopsByType(
      excludeStopsByIds(inBoundStops, nearbyIds),
      routeTypeMap,
      visibleStopTypes,
    ).map((m) => m.stop);
  }, [inBoundStops, radiusStops, routeTypeMap, visibleStopTypes]);

  const handleLocated = useCallback((location: UserLocation) => setUserLocation(location), []);

  const handleIndicatorClick = useCallback(() => {
    if (selectionInfo?.type === 'stop' && mapInstance) {
      smoothMoveTo(
        mapInstance,
        [selectionInfo.stop.stop_lat, selectionInfo.stop.stop_lon],
        mapInstance.getZoom(),
      );
    }
  }, [selectionInfo, mapInstance]);

  return (
    <div className="relative h-[60dvh] w-full">
      {/* Invert map tiles in dark mode via CSS filter on the tile pane */}
      {theme === 'dark' && (
        <style>{`.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg); }`}</style>
      )}
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        className="relative z-0 h-full w-full"
        zoomControl={false}
      >
        {tileIndex !== null && (
          <TileLayer
            key={TILE_SOURCES[tileIndex].id}
            url={TILE_SOURCES[tileIndex].url}
            attribution={TILE_SOURCES[tileIndex].attribution}
            minZoom={TILE_SOURCES[tileIndex].minZoom}
            maxNativeZoom={TILE_SOURCES[tileIndex].maxNativeZoom}
          />
        )}
        <MapEventHandler
          onBoundsChanged={onBoundsChanged}
          onZoomChanged={setZoom}
          onMapClicked={onDeselectStop}
          doubleTapDrag={doubleTapDrag}
        />
        <RouteShapePanes />
        <DistanceRings />
        {infoLevel === 'verbose' && <ZoomDisplay />}
        <PanToFocus position={focusPosition} />
        <MapRef onMap={setMapInstance} />
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={userLocation.accuracy}
              interactive={false}
              pathOptions={{
                color: '#4285f4',
                fillColor: '#4285f4',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={USER_LOCATION_ICON}
              interactive={false}
            />
          </>
        )}
        <RouteShapePolylines
          shapes={visibleShapes}
          selectedRouteIds={selectedRouteIds}
          outline={nearbyRenderMode === 'standard'}
          pane={ROUTE_SHAPE_PANE}
          outlinePane={ROUTE_SHAPE_OUTLINE_PANE}
          onRouteShapeSelected={onRouteShapeSelected}
        />
        {/* Nearby: all radiusStops including out-of-view (pre-rendered for
         * instant display on pan). EdgeMarkersSwitch (below MapContainer)
         * handles edge arrows for the same stops. */}
        <StopMarkers
          stops={filteredNearbyStops}
          selectedStopId={selectedStopId}
          routeTypeMap={routeTypeMap}
          nearbyDepartures={departureGroupsMap}
          agenciesMap={agenciesMap}
          showTooltip={true}
          // showTooltip={false}
          time={now}
          infoLevel={infoLevel}
          renderMode={nearbyRenderMode}
          renderer={canvasRenderer}
          onStopSelected={onStopSelected}
          onFetchDepartures={onFetchDepartures}
        />
        {/* Far: inBoundStops excluding radiusStops. Click to select only. */}
        <StopMarkers
          stops={filteredFarStops}
          selectedStopId={selectedStopId}
          routeTypeMap={routeTypeMap}
          agenciesMap={agenciesMap}
          showTooltip={true}
          renderMode={farRenderMode}
          infoLevel={infoLevel}
          renderer={canvasRenderer}
          onStopSelected={onStopSelected}
          incremental={true}
          // incremental={false}
        />
      </MapContainer>
      {mapInstance && (
        <MapNavigationPanel map={mapInstance} infoLevel={infoLevel} onLocated={handleLocated} />
      )}
      {mapInstance && (
        <EdgeMarkersSwitch
          map={mapInstance}
          stops={filteredNearbyStops}
          routeTypeMap={routeTypeMap}
          agenciesMap={agenciesMap}
          now={now}
          infoLevel={infoLevel}
          renderMode={nearbyRenderMode}
          onStopSelected={onStopSelected}
          onFetchDepartures={onFetchDepartures}
        />
      )}
      {/* Right top: map layer controls */}
      <MapLayerPanel
        tileIndex={tileIndex}
        visibleRouteShapes={visibleRouteShapes}
        infoLevel={infoLevel}
        onCycleTile={onCycleTile}
        onToggleBusShapes={onToggleBusShapes}
        onToggleNonBusShapes={onToggleNonBusShapes}
      />
      {/* Left: rendering controls */}
      <RenderingPanel
        renderMode={renderMode}
        perfMode={perfMode}
        infoLevel={infoLevel}
        theme={theme}
        onToggleRenderMode={onToggleRenderMode}
        onTogglePerfMode={onTogglePerfMode}
        onCycleInfoLevel={onCycleInfoLevel}
        onToggleDarkMode={onToggleDarkMode}
      />
      {/* Right bottom: stop type filters (existing MapToggleButton) */}
      <StopTypeFilterPanel
        visibleStopTypes={visibleStopTypes}
        infoLevel={infoLevel}
        onToggleStopType={onToggleStopType}
      />

      <StopControlPanel infoLevel={infoLevel} onSearchClick={onSearchClick} />
      <InfoPanel infoLevel={infoLevel} onInfoClick={onInfoClick} />
      <SelectionIndicator
        info={selectionInfo}
        infoLevel={infoLevel}
        onStopClick={handleIndicatorClick}
      />
      <StopHistory
        history={stopHistory}
        selectedStopId={selectedStopId}
        infoLevel={infoLevel}
        onSelect={onHistorySelect}
      />
    </div>
  );
}
