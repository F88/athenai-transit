import type { InfoLevel } from '../../types/app/settings';
import { useTranslation } from 'react-i18next';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';
import { routeTypeEmoji } from '../../utils/route-type-emoji';

/** Route types displayed in the filter panel, in display order. */
const STOP_TYPE_ENTRIES = [
  { routeType: 3, labelKey: 'panel.toggleBus' },
  { routeType: 1, labelKey: 'panel.toggleSubway' },
  { routeType: 0, labelKey: 'panel.toggleTram' },
  { routeType: 2, labelKey: 'panel.toggleRail' },
  // Uncomment when data sources for these route types are added:
  // { routeType: 4, labelKey: 'panel.toggleFerry' },
  // { routeType: 5, labelKey: 'panel.toggleCableTram' },
  // { routeType: 6, labelKey: 'panel.toggleGondola' },
  // { routeType: 7, labelKey: 'panel.toggleFunicular' },
] as const;

interface StopTypeFilterPanelProps {
  visibleStopTypes: Set<number>;
  infoLevel: InfoLevel;
  onToggleStopType: (rt: number) => void;
}

/**
 * Stop type filter panel using MapToggleButton (existing implementation).
 *
 * @param visibleStopTypes - Currently visible route types.
 * @param infoLevel - Current info level for ControlPanel border display.
 * @param onToggleStopType - Callback to toggle a single route type.
 */
export function StopTypeFilterPanel({
  visibleStopTypes,
  infoLevel,
  onToggleStopType,
}: StopTypeFilterPanelProps) {
  const { t } = useTranslation();
  return (
    <ControlPanel side="left" edge="top" offset="10rem" infoLevel={infoLevel}>
      {STOP_TYPE_ENTRIES.map(({ routeType, labelKey }) => (
        <MapToggleButton
          key={routeType}
          active={visibleStopTypes.has(routeType)}
          onClick={() => onToggleStopType(routeType)}
          label={t(labelKey)}
        >
          {routeTypeEmoji(routeType)}
        </MapToggleButton>
      ))}
    </ControlPanel>
  );
}
