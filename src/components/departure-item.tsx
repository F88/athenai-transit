import type { InfoLevel } from '../types/app/settings';
import type { DepartureGroup } from '../types/app/transit';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { IdBadge } from './badge/id-badge';
import { RouteBadge } from './badge/route-badge';

interface DepartureItemProps {
  group: DepartureGroup;
  now: Date;
  infoLevel: InfoLevel;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  onShowTimetable?: (group: DepartureGroup) => void;
}

export function DepartureItem({
  group,
  now,
  infoLevel,
  showRouteTypeIcon,
  onShowTimetable,
}: DepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  // Display at most 3 departures: 1st as relative time, rest as absolute.
  const MAX_DISPLAY = 3;
  const displayDepartures = group.departures.slice(0, MAX_DISPLAY);
  const first = displayDepartures[0];
  const bgColor = group.route.route_color ? `#${group.route.route_color}` : undefined;

  return (
    <div className="border-b border-[#e0e0e0] py-3 last:border-b-0 dark:border-gray-700">
      {info.isVerboseEnabled && (
        <div className="mb-1">
          <IdBadge>{group.route.route_id}</IdBadge>
        </div>
      )}
      <div className="mb-1.5 flex items-center gap-2">
        {showRouteTypeIcon && (
          <span className="shrink-0 text-base">{routeTypeEmoji(group.route.route_type)}</span>
        )}
        <RouteBadge route={group.route} infoLevel={infoLevel} />
        <span className="text-sm font-medium text-[#333] dark:text-gray-200">{group.headsign}</span>
        {onShowTimetable && (
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-2 py-0.5 text-xs whitespace-nowrap text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowTimetable(group);
            }}
          >
            時刻表
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-3 pl-1">
        {first && (
          <span
            className="text-xl font-bold text-[#333] dark:text-gray-100"
            style={bgColor ? { color: bgColor } : undefined}
          >
            {formatRelativeTime(first, now)}
          </span>
        )}
        {displayDepartures.slice(1).map((dep, i) => (
          <span key={i} className="text-sm text-[#757575] dark:text-gray-400">
            {formatAbsoluteTime(dep)}
          </span>
        ))}
      </div>
    </div>
  );
}
