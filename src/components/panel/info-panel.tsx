import type { InfoLevel } from '../../types/app/settings';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

interface InfoPanelProps {
  infoLevel: InfoLevel;
  onInfoClick: () => void;
}

/**
 * Information panel placed at the top-right of the map.
 * Opens the app info dialog.
 *
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onInfoClick - Callback to open the app info dialog.
 */
export function InfoPanel({ infoLevel, onInfoClick }: InfoPanelProps) {
  return (
    <ControlPanel side="right" edge="top" offset="14.75rem" infoLevel={infoLevel}>
      <MapToggleButton active onClick={onInfoClick} label="アプリ情報">
        ℹ️
      </MapToggleButton>
    </ControlPanel>
  );
}
