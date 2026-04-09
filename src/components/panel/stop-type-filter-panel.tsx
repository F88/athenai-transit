import type { InfoLevel } from '../../types/app/settings';
import { useTranslation } from 'react-i18next';
import { APP_ROUTE_TYPES } from '../../config/route-types';
import { ControlPanel } from '../shared/control-panel';
import { MapToggleButton } from '../button/map-toggle-button';
import {
  getRouteTypeCategoryEmoji,
  routeTypeCategory,
  routeTypeGroup,
  type RouteTypeCategory,
} from '../../utils/route-type-category';

/** Route types displayed in the filter panel, in display order. */
const STOP_TYPE_CATEGORY_ENTRIES: ReadonlyArray<{ category: RouteTypeCategory; labelKey: string }> =
  [
    { category: 'bus', labelKey: 'panel.toggleBus' },
    { category: 'subway', labelKey: 'panel.toggleSubway' },
    { category: 'train', labelKey: 'panel.toggleTrain' },
    { category: 'others', labelKey: 'panel.toggleOthers' },
  ] as const;

const REPRESENTATIVE_ROUTE_TYPE_BY_CATEGORY = APP_ROUTE_TYPES.reduce<
  Partial<Record<RouteTypeCategory, number>>
>((acc, { value }) => {
  const category = routeTypeCategory(value);
  if (acc[category] == null) {
    acc[category] = value;
  }
  return acc;
}, {});

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
      {STOP_TYPE_CATEGORY_ENTRIES.map(({ category, labelKey }) => {
        const routeType = REPRESENTATIVE_ROUTE_TYPE_BY_CATEGORY[category];
        if (routeType == null) {
          return null;
        }
        return (
          <MapToggleButton
            key={routeType}
            active={routeTypeGroup(routeType).every((rt) => visibleStopTypes.has(rt))}
            onClick={() => onToggleStopType(routeType)}
            label={t(labelKey)}
          >
            {getRouteTypeCategoryEmoji(category)}
          </MapToggleButton>
        );
      })}
    </ControlPanel>
  );
}
