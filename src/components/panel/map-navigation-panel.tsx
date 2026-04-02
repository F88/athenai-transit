import { useCallback, useState } from 'react';
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

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        const center = map.getCenter();
        const currentZoom = map.getZoom();
        const nextZoom = Math.min(currentZoom + 1, map.getMaxZoom());
        const distanceToLocation = map.distance(center, [loc.lat, loc.lng]);
        if (distanceToLocation <= LOCATE_NEAR_THRESHOLD_METERS) {
          if (nextZoom > currentZoom) {
            logger.debug(
              `handleLocate: center near current location (${distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), zooming in ${String(currentZoom)} -> ${String(nextZoom)}`,
            );
            smoothMoveTo(map, [loc.lat, loc.lng], nextZoom);
          } else {
            logger.debug(
              `handleLocate: center near current location (${distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m) and zoom already at max (${String(currentZoom)})`,
            );
          }
        } else {
          logger.debug(
            `handleLocate: center far from current location (${distanceToLocation.toFixed(1)}m > ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), moving to zoom ${String(CURRENT_LOCATION_TARGET_ZOOM)}`,
          );
          smoothMoveTo(map, [loc.lat, loc.lng], CURRENT_LOCATION_TARGET_ZOOM);
        }
        onLocated(loc);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, onLocated]);

  // const handleHome = useCallback(() => {
  //   smoothMoveTo(map, INITIAL_CENTER, INITIAL_ZOOM);
  // }, [map]);

  const handleRandomJump = useCallback(() => {
    onDeselectStop();
    const { center, zoom } = pickRandomHome();
    smoothMoveTo(map, center, zoom);
  }, [map, onDeselectStop]);

  return (
    <ControlPanel side="right" edge="bottom" offset="2rem" infoLevel={infoLevel}>
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
