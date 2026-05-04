import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import type { AutoLocateOffReason } from '../../types/app/auto-locate';
import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { InfoLevel, PerfMode, RenderMode, Theme } from '../../types/app/settings';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';
import { DEFAULT_MAX_ZOOM } from '../../config/map-constants';
import { classifyAutoLocateError } from '../../lib/auto-locate-error';
import { enableDoubleTapZoom } from '../../lib/double-tap-zoom';
import { resolveLocateAction } from '../../lib/map-locate';
import { smoothMoveTo, toBounds, toCenter } from '../../lib/leaflet-helpers';
import { StopMarkers } from '../marker/stop-markers';
import type { UserLocation } from '../../types/app/map';
import { MapOverlayPanels } from './map-overlay-panels';

import {
  CLICK_SUPPRESSION_MS,
  shouldSuppressMapClick,
} from '../../domain/map/map-click-suppression';
import { resolveMapMaxZoom } from '../../domain/map/map-max-zoom';
import { createLogger } from '../../lib/logger';
import type { StopHistoryEntry } from '../../domain/transit/stop-history';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { SelectionInfo } from '../../domain/map/selection';
import { buildTimetableEntriesMap } from '../../domain/map/selection';
import { resolveRenderModes } from '../../domain/map/render-mode';
import { RouteShapePolylines } from './route-shape-polyline';
import { TILE_SOURCES } from '../../config/tile-sources';
import { EdgeMarkersSwitch } from '../marker/edge-markers';

import { INITIAL_CENTER, INITIAL_ZOOM } from '../../config/map-defaults';
import { DISTANCE_BANDS } from '../../utils/distance-style';
import { useMapLocateWatch } from '../../hooks/use-map-locate-watch';
import { useMapSelectionLayers } from '../../hooks/use-map-selection-layers';

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
  onUserDragStart,
  doubleTapDrag,
}: {
  onBoundsChanged: (bounds: Bounds, center: LatLng) => void;
  onZoomChanged: (zoom: number) => void;
  onMapClicked: () => void;
  /**
   * Fires when the user starts a manual drag gesture. Programmatic
   * moves (`panTo`, `flyTo`, `setView`) do NOT fire `dragstart`, so
   * this is a 100% reliable signal of user-initiated movement.
   */
  onUserDragStart: () => void;
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
    dragstart: () => {
      logger.verbose('dragstart detected (user gesture)');
      onUserDragStart();
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

function TileSourceMaxZoomController({ tileIndex }: { tileIndex: number | null }) {
  const map = useMap();

  useEffect(() => {
    const maxZoom = resolveMapMaxZoom(tileIndex, TILE_SOURCES, DEFAULT_MAX_ZOOM);
    map.setMaxZoom(maxZoom);

    if (map.getZoom() > maxZoom) {
      map.setZoom(maxZoom);
    }
  }, [map, tileIndex]);

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

export interface MapViewProps {
  /** Stops within the current viewport. Used for simplified marker rendering. */
  inBoundStops: StopWithMeta[];
  /** Stops within the nearby radius. Used for edge markers and detailed display. */
  radiusStops: StopWithMeta[];
  /** Stop times for nearby stops. Displayed in bottom sheet and marker details. */
  stopTimes: StopWithContext[];

  selectedStopId: string | null;
  focusPosition: LatLng | null;
  routeTypeMap: Map<string, AppRouteTypeValue[]>;
  routeShapes: RouteShape[];
  selectionInfo: SelectionInfo | null;
  /** Stops on the selected routes. Rendered as a separate layer on top of dimmed markers. */
  routeStops: StopWithMeta[];
  visibleStopTypes: Set<number>;
  visibleRouteShapes: Set<number>;
  tileIndex: number | null;
  renderMode: RenderMode;
  perfMode: PerfMode;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  time: Date;
  onBoundsChanged: (bounds: Bounds, center: LatLng) => void;
  onStopSelected: (stop: Stop) => void;
  onFetchStopTimes: (stopId: string) => Promise<StopWithContext | null>;
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
  onCycleLang: () => void;
  onDeselectStop: () => void;
  onRouteShapeSelected: (routeId: string) => void;
  /** Resolves the number of trips on a route in the current service day. */
  resolveRouteFreq: (routeId: string) => number | undefined;
  onSearchClick: () => void;
  onInfoClick: () => void;
  /** Stop selection history entries, most recent first. */
  stopHistory: StopHistoryEntry[];
  /** Called when a history entry is chosen. */
  onHistorySelect: (stop: Stop, routeTypes: AppRouteTypeValue[]) => void;
  /** Anchor (bookmarked stop) entries, most recently added first. */
  anchors: AnchorEntry[];
  /** Called when an anchor is chosen from the Portal dropdown. */
  onPortalSelect: (entry: AnchorEntry) => void;
  /**
   * Looks up an anchored stop's current `StopWithMeta` from the
   * repository's full dataset. Forwarded to the Portal dropdown so
   * anchor display names can be resolved against the latest GTFS
   * data at render time, regardless of viewport position.
   */
  lookupAnchorStopMeta: (stopId: string) => StopWithMeta | null;
  /** Height class applied to the outer map container. */
  heightClassName?: string;
  /**
   * Whether continuous current-location tracking is currently enabled.
   * Owned by `app.tsx` so the bounds-change handler can gate its fetch
   * on the same flag without an extra signal channel.
   */
  autoLocateEnabled: boolean;
  /** Turn auto-locate on (= called from the locate button's near-center
   *  branch). */
  onEnableAutoLocate: () => void;
  /** Turn auto-locate off, tagging the call site with a typed reason
   *  for diagnostics. */
  onDisableAutoLocate: (reason: AutoLocateOffReason) => void;
}

export function MapView({
  inBoundStops,
  radiusStops,
  selectedStopId,
  focusPosition,
  stopTimes,
  routeTypeMap,
  routeShapes,
  selectionInfo,
  routeStops,
  visibleStopTypes,
  visibleRouteShapes,
  tileIndex,
  renderMode,
  perfMode,
  infoLevel,
  dataLang,
  time: now,
  onBoundsChanged,
  onStopSelected,
  onFetchStopTimes,
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
  onCycleLang,
  onDeselectStop,
  onRouteShapeSelected,
  resolveRouteFreq,
  onSearchClick,
  onInfoClick,
  stopHistory,
  lookupAnchorStopMeta,
  onHistorySelect,
  anchors,
  onPortalSelect,
  heightClassName,
  autoLocateEnabled,
  onEnableAutoLocate,
  onDisableAutoLocate,
}: MapViewProps) {
  const { t } = useTranslation();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  // Counter that increments every time a fresh geolocation fix arrives
  // (manual locate or auto-tracking watchPosition update). Forwarded
  // to the locate button as `pulseKey` so the button replays a brief
  // ripple animation to acknowledge the event without altering its
  // persistent state.
  const [locateUpdateCount, setLocateUpdateCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { nearby: nearbyRenderMode, far: farRenderMode } = resolveRenderModes(renderMode, zoom);

  // Single shared Canvas renderer for all StopMarkersCanvas instances.
  // Avoids multiple <canvas> elements stacking and blocking pointer events.
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const timetableEntriesMap = useMemo(() => buildTimetableEntriesMap(stopTimes), [stopTimes]);

  // Build agenciesMap from StopWithMeta.agencies (resolved by repo from timetable)
  const agenciesMap = useMemo(() => {
    const map = new Map<string, Agency[]>();
    for (const s of [...inBoundStops, ...radiusStops]) {
      map.set(s.stop.stop_id, s.agencies);
    }
    return map;
  }, [inBoundStops, radiusStops]);

  const {
    selectedRouteIds,
    visibleShapes,
    filteredNearbyStops,
    filteredFarStops,
    routeStopMarkers,
    routeStopsRouteTypeMap,
  } = useMapSelectionLayers({
    inBoundStops,
    radiusStops,
    routeStops,
    routeShapes,
    routeTypeMap,
    visibleStopTypes,
    visibleRouteShapes,
    selectionInfo,
  });

  const handleLocated = useCallback((location: UserLocation) => {
    setUserLocation(location);
    // Bump the counter so the locate button replays its ripple
    // animation. Both manual (`useMapLocate`) and auto (`useMapLocateWatch`)
    // paths end up here, so the button reacts uniformly to any
    // successful position fix.
    setLocateUpdateCount((n) => n + 1);
  }, []);

  // A user-initiated map drag implies the user wants to look at a
  // different area, so auto-tracking should yield. `dragstart` is a
  // pure user-gesture signal in Leaflet (programmatic moves never
  // fire it), making this a strict, race-free disable trigger.
  const handleUserDragStart = useCallback(() => {
    onDisableAutoLocate('manual-drag');
  }, [onDisableAutoLocate]);

  // Continuous geolocation tracking. The classification (= what to do
  // for each error code) lives in `classifyAutoLocateError`; this
  // handler is the side-effect side of that decision (log + toggle off
  // + toast for `'disable'`, log only for `'transient'`).
  //
  // `t` is read through a ref so a language switch does not change
  // `handleTrackingError`'s identity. Otherwise `useMapLocateWatch`'s
  // effect — which has `onError` in its dependency array — would tear
  // down the watch and re-issue `getCurrentPosition` every time the
  // user toggled the language.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const handleTrackingError = useCallback(
    (error: GeolocationPositionError) => {
      const action = classifyAutoLocateError(error);
      logger.warn(action.logMessage);
      if (action.kind === 'disable') {
        onDisableAutoLocate('permission-denied');
        toast.error(tRef.current('geolocation.trackingFailed'));
      }
    },
    [onDisableAutoLocate],
  );
  useMapLocateWatch({
    enabled: autoLocateEnabled,
    onLocated: handleLocated,
    onError: handleTrackingError,
  });

  // Auto-pan the map to follow the user's location while tracking is on.
  // Runs whenever `userLocation` updates (i.e. on each watchPosition tick)
  // and on the transition that turns tracking on so the map re-centers
  // immediately. Zoom is preserved — only the center is moved.
  //
  // Each pan fires `moveend` → `handleBoundsChanged` and a real fetch
  // (no skip path during tracking). Two natural guards keep the fetch
  // count sane: `resolveLocateAction`'s 10 m threshold (used by the
  // manual locate flow and the pinch-zoom yield) and Leaflet's own
  // `panTo` equality check, which suppresses the moveend when the
  // destination is essentially the current center. Together they
  // mean "fetch only when the user has actually moved".
  useEffect(() => {
    if (!autoLocateEnabled || !mapInstance || !userLocation) {
      return;
    }
    mapInstance.panTo([userLocation.lat, userLocation.lng]);
  }, [autoLocateEnabled, mapInstance, userLocation]);

  // Pinch-zoom-aware tracking yield. A pinch centered on the map
  // changes only zoom level (= "I want a different scale at the same
  // place") and should keep tracking on. A pinch off-center shifts
  // the map center away from the user (= "I want to look elsewhere")
  // and should release tracking; without this, the next watchPosition
  // tick would auto-pan back and undo the user's gesture.
  //
  // We reuse `resolveLocateAction` against the current `userLocation`
  // so the same `LOCATE_NEAR_THRESHOLD_METERS` (10 m) that decides
  // "near" for the manual locate also decides whether the post-zoom
  // center is still "on" the user.
  //
  // `userLocation` is read through a ref so the Leaflet zoomend
  // listener is registered once per tracking session — putting
  // `userLocation` in the effect deps would re-subscribe on every
  // watchPosition tick (i.e. potentially every few seconds while
  // tracking), churning the listener unnecessarily.
  const userLocationRef = useRef(userLocation);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);
  useEffect(() => {
    if (!mapInstance || !autoLocateEnabled) {
      return;
    }
    const handleZoomEnd = () => {
      const loc = userLocationRef.current;
      if (!loc) {
        return;
      }
      const action = resolveLocateAction(mapInstance, loc);
      if (action.kind === 'move') {
        onDisableAutoLocate('pinch-zoom-shift');
      }
    };
    mapInstance.on('zoomend', handleZoomEnd);
    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, autoLocateEnabled, onDisableAutoLocate]);

  // Refresh stops at the current map state on the auto-tracking
  // ON → OFF transition. Most of the time the latest auto-pan has
  // already pulled in fresh stops, so this fires a same-center fetch
  // that the debounce coalesces with any subsequent moveend (e.g.
  // when the disable was caused by selecting a stop, which also
  // pans). The case it covers is the watchPosition-error path: if
  // tracking ends because of `PERMISSION_DENIED`, no further moveend
  // is coming, and we still want the bottom sheet to reflect the
  // last-known map center.
  const prevAutoLocateEnabledRef = useRef(autoLocateEnabled);
  useEffect(() => {
    const wasEnabled = prevAutoLocateEnabledRef.current;
    prevAutoLocateEnabledRef.current = autoLocateEnabled;
    if (!wasEnabled || autoLocateEnabled || !mapInstance) {
      return;
    }
    logger.debug('auto-locate disabled: refetching stops at current map state');
    onBoundsChanged(toBounds(mapInstance), toCenter(mapInstance));
  }, [autoLocateEnabled, mapInstance, onBoundsChanged]);

  useEffect(() => {
    if (!mapInstance || !wrapperRef.current) {
      return;
    }

    let frameId = 0;
    const invalidateMapSize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        mapInstance.invalidateSize({ animate: false });
      });
    };

    invalidateMapSize();

    const resizeObserver = new ResizeObserver(() => {
      invalidateMapSize();
    });
    resizeObserver.observe(wrapperRef.current);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [mapInstance]);

  return (
    <div ref={wrapperRef} className={`relative w-full ${heightClassName ?? 'h-[60dvh]'}`}>
      {/* Invert map tiles in dark mode via CSS filter on the tile pane */}
      {theme === 'dark' && (
        <style>{`.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg); }`}</style>
      )}
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        maxZoom={resolveMapMaxZoom(tileIndex, TILE_SOURCES, DEFAULT_MAX_ZOOM)}
        className="relative z-0 h-full w-full"
        zoomControl={false}
      >
        <TileSourceMaxZoomController tileIndex={tileIndex} />
        {tileIndex !== null && (
          <TileLayer
            key={TILE_SOURCES[tileIndex].id}
            url={TILE_SOURCES[tileIndex].url}
            attribution={TILE_SOURCES[tileIndex].attribution}
            minZoom={TILE_SOURCES[tileIndex].minZoom}
            maxNativeZoom={TILE_SOURCES[tileIndex].maxNativeZoom}
            maxZoom={TILE_SOURCES[tileIndex].maxZoom ?? DEFAULT_MAX_ZOOM}
          />
        )}
        <MapEventHandler
          onBoundsChanged={onBoundsChanged}
          onZoomChanged={setZoom}
          onMapClicked={onDeselectStop}
          onUserDragStart={handleUserDragStart}
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
          resolveFreq={resolveRouteFreq}
        />
        {/* Nearby: all radiusStops including out-of-view (pre-rendered for
         * instant display on pan). EdgeMarkersSwitch (below MapContainer)
         * handles edge arrows for the same stops. */}
        {/* {
          (logger.debug(
            `layers: nearby=${filteredNearbyStops.length} (${nearbyRenderMode}), far=${filteredFarStops.length} (${farRenderMode}), routeStops=${routeStopMarkers.length} (${nearbyRenderMode}) [perfMode=${perfMode}, renderMode=${renderMode}]`,
          ),
          null)
        } */}
        <StopMarkers
          stops={filteredNearbyStops}
          selectedStopId={selectedStopId}
          routeTypeMap={routeTypeMap}
          stopTimes={timetableEntriesMap}
          agenciesMap={agenciesMap}
          showTooltip={true}
          // showTooltip={false}
          time={now}
          infoLevel={infoLevel}
          dataLang={dataLang}
          renderMode={nearbyRenderMode}
          renderer={canvasRenderer}
          onStopSelected={onStopSelected}
          onFetchStopTimes={onFetchStopTimes}
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
          dataLang={dataLang}
          renderer={canvasRenderer}
          onStopSelected={onStopSelected}
          incremental={true}
          // incremental={false}
        />
        {/* Route stops: stops on selected routes, rendered on top of dimmed markers */}
        {routeStopMarkers.length > 0 && (
          <StopMarkers
            stops={routeStopMarkers}
            selectedStopId={selectedStopId}
            routeTypeMap={routeStopsRouteTypeMap}
            showTooltip={true}
            stopTimes={timetableEntriesMap}
            time={now}
            renderMode={nearbyRenderMode}
            infoLevel={infoLevel}
            dataLang={dataLang}
            renderer={canvasRenderer}
            onStopSelected={onStopSelected}
            agenciesMap={agenciesMap}
            disableDimming={true}
          />
        )}
      </MapContainer>

      <MapOverlayPanels
        map={mapInstance}
        tileIndex={tileIndex}
        visibleRouteShapes={visibleRouteShapes}
        visibleStopTypes={visibleStopTypes}
        renderMode={renderMode}
        perfMode={perfMode}
        infoLevel={infoLevel}
        theme={theme}
        selectedStopId={selectedStopId}
        stopHistory={stopHistory}
        anchors={anchors}
        onCycleTile={onCycleTile}
        onToggleBusShapes={onToggleBusShapes}
        onToggleNonBusShapes={onToggleNonBusShapes}
        onToggleRenderMode={onToggleRenderMode}
        onTogglePerfMode={onTogglePerfMode}
        onCycleInfoLevel={onCycleInfoLevel}
        onToggleDarkMode={onToggleDarkMode}
        onCycleLang={onCycleLang}
        dataLang={dataLang}
        onToggleStopType={onToggleStopType}
        onSearchClick={onSearchClick}
        onInfoClick={onInfoClick}
        onLocated={handleLocated}
        autoLocateEnabled={autoLocateEnabled}
        onEnableAutoLocate={onEnableAutoLocate}
        onDisableAutoLocate={onDisableAutoLocate}
        locatePulseKey={locateUpdateCount}
        onDeselectStop={onDeselectStop}
        onHistorySelect={onHistorySelect}
        onPortalSelect={onPortalSelect}
        lookupAnchorStopMeta={lookupAnchorStopMeta}
      />
      {mapInstance && (
        <EdgeMarkersSwitch
          map={mapInstance}
          stops={filteredNearbyStops}
          routeTypeMap={routeTypeMap}
          agenciesMap={agenciesMap}
          now={now}
          infoLevel={infoLevel}
          dataLang={dataLang}
          renderMode={nearbyRenderMode}
          onStopSelected={onStopSelected}
          onFetchStopTimes={onFetchStopTimes}
        />
      )}
    </div>
  );
}
