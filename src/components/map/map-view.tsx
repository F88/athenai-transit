import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import type { AutoLocateOffReason } from '../../types/app/auto-locate';
import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { InfoLevel, RenderMode, Theme } from '../../types/app/settings';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';
import { DEFAULT_MAX_ZOOM } from '../../config/map-constants';
import { classifyAutoLocateError } from '../../lib/auto-locate-error';
import { enableDoubleTapZoom } from '../../lib/double-tap-zoom';
import { resolveLocateAction } from '../../lib/map-locate';
import { smoothMoveTo, toBounds, toCenter } from '../../lib/leaflet-helpers';
import { StopMarkers } from '../marker/stop-markers';
import type { UserLocation } from '../../types/app/map';

import {
  CLICK_SUPPRESSION_MS,
  shouldSuppressMapClick,
} from '../../domain/map/map-click-suppression';
import { resolveMapMaxZoom } from '../../domain/map/map-max-zoom';
import { createLogger } from '../../lib/logger';
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
    if (logger.isEnabled('debug')) {
      logger.debug(`panning to lat=${position.lat}, lng=${position.lng}`);
    }
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

/**
 * Render caller-supplied circles in addition to (or in place of) the
 * always-on `DistanceRings`. Each circle is anchored to its own `center`
 * (independent of the current map viewport center) and stays put when the
 * user drags the map, so the circle reflects "the area the caller cares
 * about" (e.g. the most recently committed stops-fetch center) rather
 * than the live viewport.
 */
function AdditionalCircles({ circles }: { circles: readonly HighlightedCircle[] }) {
  return (
    <>
      {circles.map((c, i) => (
        <Circle
          key={`additional-${i}`}
          center={[c.center.lat, c.center.lng]}
          radius={c.radius}
          interactive={false}
          pathOptions={{
            color: c.color,
            fillColor: c.color,
            fillOpacity: 0.12,
            weight: 6,
            opacity: 0.85,
          }}
        />
      ))}
    </>
  );
}

/**
 * Specification for one extra Circle rendered on top of the always-on
 * `DistanceRings`. The caller decides everything: where the circle is
 * anchored, how large it is, and what color it gets. Color is required
 * (and intentionally an opaque CSS color string) so the MapView never
 * has to know about `DISTANCE_BANDS` -- caller-side helpers in
 * `utils/distance-style.ts` etc. can be used to look one up if the
 * caller wants band-consistent colors.
 */
export interface HighlightedCircle {
  /** Anchor point. Does NOT follow the user dragging the map. */
  center: LatLng;
  /** Radius in meters. Free-form; not restricted to `DISTANCE_BANDS.max`. */
  radius: number;
  /** CSS color string used for both stroke and fill. */
  color: string;
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
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /**
   * The "now" for relative departure times ("in N min"). Usually the real
   * clock, but the user can pin it (time picker / `?time=`); when pinned
   * the countdown stops.
   */
  relativeTimeNow: Date;
  onBoundsChanged: (bounds: Bounds, center: LatLng) => void;
  onStopSelected: (stop: Stop) => void;
  onFetchStopTimes: (stopId: string) => Promise<StopWithContext | null>;
  theme: Theme;
  doubleTapDrag: 'zoom-in' | 'zoom-out';
  onDeselectStop: () => void;
  onRouteShapeSelected: (routeId: string) => void;
  /** Resolves the number of trips on a route in the current service day. */
  resolveRouteFreq: (routeId: string) => number | undefined;
  /** Height class applied to the outer map container. */
  heightClassName?: string;
  /**
   * Whether continuous current-location tracking is currently enabled.
   * Owned by `app.tsx` so every consumer (the locate button's
   * highlighted state, `useMapLocateWatch`'s `enabled`, the auto-pan
   * effect, the pinch-zoom yield, the ON → OFF catch-up effect, and
   * each disable trigger) reads from the same source of truth.
   */
  autoLocateEnabled: boolean;
  /**
   * Turn auto-locate off, tagging the call site with a typed reason
   * for diagnostics. Called from within MapView for `'manual-drag'`,
   * `'pinch-zoom-shift'`, and `'permission-denied'` (geolocation watch
   * error).
   */
  onDisableAutoLocate: (reason: AutoLocateOffReason) => void;
  /**
   * Last known user geolocation; owned by `app.tsx` so it is also
   * available to chrome rendered outside MapView (e.g. the locate
   * button in `MapOverlay`). MapView reads this for the
   * user-location marker, the auto-pan effect, and the pinch-zoom
   * yield logic.
   */
  userLocation: UserLocation | null;
  /**
   * Called with every fresh geolocation fix from MapView's
   * `useMapLocateWatch` (the continuous-tracking watchPosition tick).
   * `app.tsx` updates the lifted `userLocation` state and bumps the
   * `locatePulseKey` counter forwarded to `MapOverlay`'s locate
   * button.
   */
  onLocated: (location: UserLocation) => void;
  /**
   * Published when the underlying Leaflet `L.Map` is created (and on
   * subsequent re-creations). `app.tsx` captures the instance so
   * chrome extracted out of MapView (`MapOverlay`, eventually
   * `EdgeMarkersSwitch`) can interact with the same map.
   */
  onMapInstance?: (map: L.Map) => void;
  /**
   * Whether to render the always-on distance reference rings
   * (= existing {@link DISTANCE_BANDS}-based concentric circles).
   * Defaults to true so existing call sites keep the historical behavior.
   */
  showDistanceRings?: boolean;
  /**
   * Caller-supplied circles to draw on top of (or in place of) the distance
   * rings -- e.g. to highlight the current display radius. Each entry is
   * rendered as a single Leaflet `Circle` with a transparent-tinted fill.
   * Defaults to nothing rendered. See {@link HighlightedCircle}.
   */
  highlightedCircles?: HighlightedCircle[];
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
  infoLevel,
  dataLang,
  relativeTimeNow,
  onBoundsChanged,
  onStopSelected,
  onFetchStopTimes,
  theme,
  doubleTapDrag,
  onDeselectStop,
  onRouteShapeSelected,
  resolveRouteFreq,
  heightClassName,
  autoLocateEnabled,
  onDisableAutoLocate,
  userLocation,
  onLocated,
  onMapInstance,
  showDistanceRings = true,
  highlightedCircles,
}: MapViewProps) {
  const { t } = useTranslation();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Bridge MapRef -> both the local `mapInstance` state (consumed by
  // effects in this component) and the parent-supplied `onMapInstance`
  // callback (consumed by `MapOverlay` / `EdgeMarkersSwitch`
  // hosted in `app.tsx`).
  const handleMapInstance = useCallback(
    (map: L.Map) => {
      setMapInstance(map);
      onMapInstance?.(map);
    },
    [onMapInstance],
  );

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
      // 'disable' is actionable (= the user has to grant permission to
      // recover) so warn-level is appropriate; the logger lets warn
      // bypass tag filters so the message lands in any environment.
      // 'transient' (POSITION_UNAVAILABLE / TIMEOUT) is recoverable
      // by the watch itself — surfacing it at warn would spam logs in
      // weak-GPS or DevTools-override conditions, so demote to debug.
      if (action.kind === 'disable') {
        logger.warn(action.logMessage);
        onDisableAutoLocate('permission-denied');
        toast.error(tRef.current('geolocation.trackingFailed'));
      } else {
        logger.debug(action.logMessage);
      }
    },
    [onDisableAutoLocate],
  );
  useMapLocateWatch({
    enabled: autoLocateEnabled,
    onLocated,
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
        {showDistanceRings && <DistanceRings />}
        {highlightedCircles && highlightedCircles.length > 0 && (
          <AdditionalCircles circles={highlightedCircles} />
        )}
        {infoLevel === 'verbose' && <ZoomDisplay />}
        <PanToFocus position={focusPosition} />
        <MapRef onMap={handleMapInstance} />
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
          time={relativeTimeNow}
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
            time={relativeTimeNow}
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

      {mapInstance && (
        <EdgeMarkersSwitch
          map={mapInstance}
          stops={filteredNearbyStops}
          routeTypeMap={routeTypeMap}
          agenciesMap={agenciesMap}
          now={relativeTimeNow}
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
