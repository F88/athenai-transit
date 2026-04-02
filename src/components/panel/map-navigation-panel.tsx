import { useCallback, useEffect, useState } from 'react';
import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { UserLocation } from '../../types/app/map';
import { smoothMoveTo } from '../../lib/leaflet-helpers';
import { createLogger } from '../../utils/logger';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

import { pickRandomHome } from '../../config/map-defaults';
// import { INITIAL_CENTER, INITIAL_ZOOM } from '../../config/map-defaults'; // for future HOME button
const CURRENT_LOCATION_TARGET_ZOOM = 16;
const LOCATE_NEAR_THRESHOLD_METERS = 10;

const logger = createLogger('MapNavigationPanel');

type LocateAction =
  | { kind: 'move'; distanceToLocation: number }
  | {
      kind: 'zoom-in';
      distanceToLocation: number;
      currentZoom: number;
      nextZoom: number;
    }
  | { kind: 'noop'; distanceToLocation: number; currentZoom: number };

function toUserLocation(pos: GeolocationPosition): UserLocation {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
}

function resolveLocateAction(map: L.Map, loc: UserLocation): LocateAction {
  const center = map.getCenter();
  const currentZoom = map.getZoom();
  const distanceToLocation = map.distance(center, [loc.lat, loc.lng]);

  if (distanceToLocation > LOCATE_NEAR_THRESHOLD_METERS) {
    return { kind: 'move', distanceToLocation };
  }

  const nextZoom = Math.min(currentZoom + 1, map.getMaxZoom());
  if (nextZoom > currentZoom) {
    return {
      kind: 'zoom-in',
      distanceToLocation,
      currentZoom,
      nextZoom,
    };
  }

  return { kind: 'noop', distanceToLocation, currentZoom };
}

function applyLocateAction(map: L.Map, loc: UserLocation, action: LocateAction): void {
  switch (action.kind) {
    case 'move':
      logger.debug(
        `handleLocate: center far from current location (${action.distanceToLocation.toFixed(1)}m > ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), moving to zoom ${String(CURRENT_LOCATION_TARGET_ZOOM)}`,
      );
      smoothMoveTo(map, [loc.lat, loc.lng], CURRENT_LOCATION_TARGET_ZOOM);
      return;
    case 'zoom-in':
      logger.debug(
        `handleLocate: center near current location (${action.distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), zooming in ${String(action.currentZoom)} -> ${String(action.nextZoom)}`,
      );
      setZoomLevel(map, action.nextZoom);
      return;
    case 'noop':
      logger.debug(
        `handleLocate: center near current location (${action.distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m) and zoom already at max (${String(action.currentZoom)})`,
      );
      return;
  }
}

function setZoomLevel(map: L.Map, zoom: number): void {
  const currentZoom = map.getZoom();
  const nextZoom = Math.max(map.getMinZoom(), Math.min(zoom, map.getMaxZoom()));
  if (nextZoom === currentZoom) {
    return;
  }

  map.setZoom(nextZoom, { animate: true });
}

function changeZoom(map: L.Map, delta: 1 | -1): void {
  setZoomLevel(map, map.getZoom() + delta);
}

function ZoomInButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <MapToggleButton active={active} onClick={onClick} label="拡大">
      +
    </MapToggleButton>
  );
}

function ZoomOutButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <MapToggleButton active={active} onClick={onClick} label="縮小">
      -
    </MapToggleButton>
  );
}

interface MapNavigationPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
  onLocated: (location: UserLocation) => void;
  onDeselectStop: () => void;
}

/**
 * Navigation panel placed at the bottom-right of the map.
 * Provides buttons to jump to user's current location or the initial position.
 *
 * @param map - Leaflet map instance.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onLocated - Callback fired with the user's geolocation result.
 */
export function MapNavigationPanel({
  map,
  infoLevel,
  onLocated,
  onDeselectStop,
}: MapNavigationPanelProps) {
  const [locating, setLocating] = useState(false);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);
    handleZoomEnd();

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = toUserLocation(pos);
        const action = resolveLocateAction(map, loc);
        applyLocateAction(map, loc, action);
        onLocated(loc);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, onLocated]);

  const handleRandomJump = useCallback(() => {
    onDeselectStop();
    const { center, zoom } = pickRandomHome();
    smoothMoveTo(map, center, zoom);
  }, [map, onDeselectStop]);

  const handleZoomIn = useCallback(() => {
    changeZoom(map, 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    changeZoom(map, -1);
  }, [map]);

  const canZoomIn = zoom < map.getMaxZoom();
  const canZoomOut = zoom > map.getMinZoom();

  return (
    <ControlPanel side="right" edge="bottom" offset="2rem" infoLevel={infoLevel}>
      <ZoomInButton active={canZoomIn} onClick={handleZoomIn} />
      <ZoomOutButton active={canZoomOut} onClick={handleZoomOut} />
      <MapToggleButton active={!locating} onClick={handleLocate} label="現在位置へ移動">
        {locating ? '...' : '🎯'}
      </MapToggleButton>
      {/* HOME button hidden — kept for future USER HOME feature */}
      {/* <MapToggleButton active onClick={handleHome} label="初期位置へ戻る">
        🏠
      </MapToggleButton> */}
      <MapToggleButton active onClick={handleRandomJump} label="ランダムな場所へ移動">
        🎲
      </MapToggleButton>
    </ControlPanel>
  );
}
