import type { InfoLevel } from '../../types/app/settings';
import { useTranslation } from 'react-i18next';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';

interface StopControlPanelProps {
  infoLevel: InfoLevel;
  onSearchClick: () => void;
}

/**
 * Stop-related control panel placed at the bottom-left of the map.
 * Currently provides a search button; additional stop operations can be added here.
 *
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onSearchClick - Callback to open the stop search dialog.
 */
export function StopControlPanel({ infoLevel, onSearchClick }: StopControlPanelProps) {
  const { t } = useTranslation();
  return (
    <ControlPanel side="left" edge="bottom" offset="2rem" infoLevel={infoLevel}>
      <MapToggleButton active onClick={onSearchClick} label={t('panel.searchStops')}>
        🔍
      </MapToggleButton>
    </ControlPanel>
  );
}
