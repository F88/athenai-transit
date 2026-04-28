import { useMemo } from 'react';
import { resolveAgencyLang } from '@/config/transit-defaults';
import { findRouteDirectionForHeadsign } from '@/domain/transit/find-route-direction-for-headsign';
import { getEffectiveHeadsign } from '@/domain/transit/get-effective-headsign';
import { getSelectedHeadsignDisplayName } from '@/domain/transit/get-headsign-display-names';
import { groupByRouteHeadsign } from '@/domain/transit/group-timetable-entries';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from '@/domain/transit/color-resolver/contrast-thresholds';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { useThemeContrastBackgroundColor } from '@/hooks/use-is-low-contrast-against-theme';
import type { Agency } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import { getContrastAssessment } from '@/utils/color/color-contrast';
import { PillButton } from '../button/pill-button';

interface TimetableHeadsignFilterProps {
  timetableEntries: TimetableEntry[];
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  dataLang: readonly string[];
  agencies: Agency[];
}

/**
 * Render route+headsign filter pills for a timetable view.
 *
 * Pills are derived from the route+headsign combinations present in
 * `timetableEntries`. Toggling a pill includes / excludes that
 * route+headsign from the displayed timetable. The filter axis is
 * route+headsign even though the user-facing label centers on headsign.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered headsign filter controls.
 */
export function TimetableHeadsignFilter({
  timetableEntries,
  activeFilters,
  onToggleFilter,
  dataLang,
  agencies,
}: TimetableHeadsignFilterProps) {
  const themeContrastBackgroundColor = useThemeContrastBackgroundColor();

  const routeHeadsigns = useMemo(() => {
    return groupByRouteHeadsign(timetableEntries)
      .map(([key, entries]) => {
        const firstEntry = entries[0];
        if (!firstEntry) {
          return null;
        }

        const selectedHeadsign = getEffectiveHeadsign(firstEntry.routeDirection);
        const routeDirection = findRouteDirectionForHeadsign(entries, selectedHeadsign);
        if (!routeDirection) {
          return null;
        }

        const { routeColor, routeTextColor } = resolveRouteColors(routeDirection.route, 'css-hex');
        const routeColorAssessment = getContrastAssessment(
          routeColor,
          themeContrastBackgroundColor,
          LOW_CONTRAST_BADGE_MIN_RATIO,
        );
        // Keep the fill/text pair aligned with RouteBadge and use the paired
        // text color only as an inactive outline fallback when the route color
        // blends into the current theme background.
        const inactiveBorderColor = routeColorAssessment.isLowContrast
          ? routeTextColor
          : routeColor;

        return {
          key,
          selectedHeadsign,
          routeDirection,
          count: entries.length,
          routeColor,
          routeTextColor,
          inactiveBorderColor,
        };
      })

      .filter((entry) => entry !== null);
  }, [themeContrastBackgroundColor, timetableEntries]);

  const noFilter = activeFilters.size === 0;

  if (routeHeadsigns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {routeHeadsigns.map((item) => {
        const { route } = item.routeDirection;
        const isActive = noFilter || activeFilters.has(item.key);

        return (
          <PillButton
            key={item.key}
            size="sm"
            active={isActive}
            activeBg={item.routeColor}
            activeFg={item.routeTextColor}
            activeBorder={item.routeColor}
            inactiveBorder={item.inactiveBorderColor}
            onClick={() => onToggleFilter(item.key)}
            count={item.count}
          >
            {getSelectedHeadsignDisplayName(
              item.routeDirection,
              item.selectedHeadsign,
              dataLang,
              resolveAgencyLang(agencies, route.agency_id),
            ) ||
              route.route_short_name ||
              route.route_long_name ||
              route.route_id}
          </PillButton>
        );
      })}
    </div>
  );
}
