import type { InfoLevel } from '../../types/app/settings';
import { useTranslation } from 'react-i18next';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

interface MapLayerPanelProps {
  tileIndex: number | null;
  visibleRouteShapes: Set<number>;
  infoLevel: InfoLevel;
  onCycleTile: () => void;
  onToggleBusShapes: () => void;
  onToggleNonBusShapes: () => void;
}

/**
 * Map layer toggle panel placed at the top-left of the map.
 * Controls tile visibility, bus route shapes, and non-bus route shapes.
 *
 * @param tileIndex - Current tile source index, or `null` if tiles are hidden.
 * @param visibleRouteShapes - Set of currently visible route shape types.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onCycleTile - Callback to cycle through tile sources.
 * @param onToggleBusShapes - Callback to toggle bus route shape visibility.
 * @param onToggleNonBusShapes - Callback to toggle non-bus route shape visibility.
 */
export function MapLayerPanel({
  tileIndex,
  visibleRouteShapes,
  infoLevel,
  onCycleTile,
  onToggleBusShapes,
  onToggleNonBusShapes,
}: MapLayerPanelProps) {
  const { t } = useTranslation();
  return (
    <ControlPanel side="left" edge="top" offset="0.75rem" infoLevel={infoLevel}>
      <MapToggleButton
        active={tileIndex !== null}
        onClick={onCycleTile}
        label={t('panel.toggleMap')}
      >
        🗺
      </MapToggleButton>
      <MapToggleButton
        active={visibleRouteShapes.has(3)}
        onClick={onToggleBusShapes}
        label={t('panel.toggleBusRoutes')}
      >
        🧑🏼‍🎨
      </MapToggleButton>
      <MapToggleButton
        active={[0, 1, 2, 4, 5, 6, 7].every((t) => visibleRouteShapes.has(t))}
        onClick={onToggleNonBusShapes}
        label={t('panel.toggleNonBusRoutes')}
      >
        👨🏻‍🎨
      </MapToggleButton>
    </ControlPanel>
  );
}
