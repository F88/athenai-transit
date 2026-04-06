import type { InfoLevel } from '../../types/app/settings';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';
import { routeTypeEmoji } from '../../utils/route-type-emoji';

/** Route types displayed in the filter panel, in display order. */
const STOP_TYPE_ENTRIES = [
  { routeType: 3, label: 'バスの表示切替' },
  { routeType: 1, label: '地下鉄の表示切替' },
  { routeType: 0, label: '路面電車の表示切替' },
  { routeType: 2, label: '鉄道の表示切替' },
  // Uncomment when data sources for these route types are added:
  // { routeType: 4, label: 'フェリーの表示切替' },
  // { routeType: 5, label: 'ケーブルカーの表示切替' },
  // { routeType: 6, label: 'ゴンドラの表示切替' },
  // { routeType: 7, label: 'フニクラーの表示切替' },
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
  return (
    <ControlPanel side="left" edge="top" offset="10rem" infoLevel={infoLevel}>
      {STOP_TYPE_ENTRIES.map(({ routeType, label }) => (
        <MapToggleButton
          key={routeType}
          active={visibleStopTypes.has(routeType)}
          onClick={() => onToggleStopType(routeType)}
          label={label}
        >
          {routeTypeEmoji(routeType)}
        </MapToggleButton>
      ))}
    </ControlPanel>
  );
}
