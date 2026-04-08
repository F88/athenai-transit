import { useMemo } from 'react';
import { resolveAgencyLang } from '@/config/transit-defaults';
import { findRouteDirectionForHeadsign } from '@/domain/transit/find-route-direction-for-headsign';
import { getEffectiveHeadsign } from '@/domain/transit/get-effective-headsign';
import { getSelectedHeadsignDisplayName } from '@/domain/transit/get-headsign-display-names';
import { groupByRouteHeadsign } from '@/domain/transit/group-timetable-entries';
import type { Agency } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import { PillButton } from '../button/pill-button';

interface StopTimetableFilterProps {
  timetableEntries: TimetableEntry[];
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  dataLang: readonly string[];
  agencies: Agency[];
}

/**
 * Render route+headsign filter pills for the stop timetable view.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered stop timetable filter controls.
 */
export function StopTimetableFilter({
  timetableEntries,
  activeFilters,
  onToggleFilter,
  dataLang,
  agencies,
}: StopTimetableFilterProps) {
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

        return {
          key,
          selectedHeadsign,
          routeDirection,
          count: entries.length,
        };
      })
      .filter((entry) => entry !== null);
  }, [timetableEntries]);

  const noFilter = activeFilters.size === 0;

  if (routeHeadsigns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {routeHeadsigns.map((item) => {
        const { route } = item.routeDirection;
        const isActive = noFilter || activeFilters.has(item.key);
        const bg = route.route_color ? `#${route.route_color}` : undefined;
        const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;

        return (
          <PillButton
            key={item.key}
            size="sm"
            active={isActive}
            activeBg={bg}
            activeFg={fg}
            inactiveBorder={bg}
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
