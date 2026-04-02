import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { UserLocation } from '../../types/app/map';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';
import { useMapNavigationActions } from '../../hooks/use-map-navigation-actions';

interface MapNavigationPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
  onLocated: (location: UserLocation) => void;
  onDeselectStop: () => void;
}

/**
 * Navigation panel placed at the bottom-right of the map.
 * Provides buttons to locate the user's current position and jump to a random place.
 *
 * @param map - Leaflet map instance.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onLocated - Callback fired with the user's geolocation result.
 * @param onDeselectStop - Callback fired before jumping to a random place.
 */
export function MapNavigationPanel({
  map,
  infoLevel,
  onLocated,
  onDeselectStop,
}: MapNavigationPanelProps) {
  const { locating, handleLocate, handleRandomJump } = useMapNavigationActions(
    map,
    onLocated,
    onDeselectStop,
  );

  return (
    <ControlPanel side="right" edge="bottom" offset="2rem" infoLevel={infoLevel}>
      <MapToggleButton
        active={!locating}
        onClick={handleLocate}
        label="現在位置へ移動"
        disabled={locating}
      >
        {locating ? '.' : '🎯'}
      </MapToggleButton>
      <MapToggleButton active onClick={handleRandomJump} label="ランダムな場所へ移動">
        🎲
      </MapToggleButton>
    </ControlPanel>
  );
}
