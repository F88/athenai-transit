import { useCallback, useState } from 'react';
import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { UserLocation } from '../../types/app/map';
import { smoothMoveTo } from '../../lib/leaflet-helpers';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

import { INITIAL_CENTER, INITIAL_ZOOM } from '../../config/map-defaults';
const LOCATE_ZOOM = 16;

interface MapNavigationPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
  onLocated: (location: UserLocation) => void;
}

/**
 * Navigation panel placed at the bottom-right of the map.
 * Provides buttons to jump to user's current location or the initial position.
 *
 * @param map - Leaflet map instance.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onLocated - Callback fired with the user's geolocation result.
 */
export function MapNavigationPanel({ map, infoLevel, onLocated }: MapNavigationPanelProps) {
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
        onLocated(loc);
        smoothMoveTo(map, [loc.lat, loc.lng], LOCATE_ZOOM);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, onLocated]);

  const handleHome = useCallback(() => {
    smoothMoveTo(map, INITIAL_CENTER, INITIAL_ZOOM);
  }, [map]);

  return (
    <ControlPanel side="right" edge="bottom" offset="2rem" infoLevel={infoLevel}>
      <MapToggleButton active={!locating} onClick={handleLocate} label="現在位置へ移動">
        {locating ? '...' : '🎯'}
      </MapToggleButton>
      <MapToggleButton active onClick={handleHome} label="初期位置へ戻る">
        🏠
      </MapToggleButton>
    </ControlPanel>
  );
}
