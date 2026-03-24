import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { TimetableEntry } from '../types/app/transit-composed';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';

interface FlatDepartureItemProps {
  /** The timetable entry to display. */
  entry: TimetableEntry;
  /** Service day used to resolve departure minutes to Date. */
  serviceDay: Date;
  /** Current time for relative time calculation. */
  now: Date;
  /** Whether this is the first item in the list. */
  isFirst: boolean;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Current info verbosity level for route label formatting. */
  infoLevel: InfoLevel;
  /** Agency short name to display at detailed+ info level. */
  agencyName?: string;
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
}

/**
 * A single row in the T1 (Stop) flat departure list.
 *
 * The first departure shows relative time ("あと5分"), subsequent
 * departures show absolute time ("14:30"). Route label is colored
 * with the route's designated color.
 */
export function FlatDepartureItem({
  entry,
  serviceDay,
  now,
  isFirst,
  showRouteTypeIcon,
  infoLevel,
  agencyName,
  agency,
}: FlatDepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const { route, headsign } = entry.routeDirection;
  const headsignName = getHeadsignDisplayNames(headsign, route, infoLevel).name;
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;
  const departureTime = minutesToDate(serviceDay, entry.schedule.departureMinutes);
  const isTerminal = entry.patternPosition.isTerminal;
  const isPickupUnavailable = entry.boarding.pickupType === 1;

  return (
    <div className="border-b border-[#e0e0e0] py-2 last:border-b-0 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className="w-18 shrink-0 text-right">
          {(isFirst || departureTime.getTime() - now.getTime() <= 10 * 60 * 1000) && (
            <div
              className="text-sm font-bold text-[#333] dark:text-gray-100"
              style={bgColor ? { color: bgColor } : undefined}
            >
              {formatRelativeTime(departureTime, now)}
            </div>
          )}
          <div
            className="text-sm font-bold text-[#333] dark:text-gray-100"
            style={bgColor ? { color: bgColor } : undefined}
          >
            {formatAbsoluteTime(departureTime)}
          </div>
        </div>
        {showRouteTypeIcon && (
          <span className="shrink-0 text-base">{routeTypeEmoji(route.route_type)}</span>
        )}
        <RouteBadge route={route} infoLevel={infoLevel} className="shrink-0" />
        {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
        <span className="truncate text-sm text-[#333] dark:text-gray-200">{headsignName}</span>
        {isTerminal && (
          <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            終点
          </span>
        )}
        {isPickupUnavailable && (
          <span className="shrink-0 rounded bg-red-100 px-1 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            乗車不可
          </span>
        )}
        {info.isDetailedEnabled && agencyName && (
          <span className="shrink-0 text-[10px] text-[#888] dark:text-gray-400">{agencyName}</span>
        )}
        {info.isDetailedEnabled && agency && (
          <AgencyBadge agency={agency} infoLevel={infoLevel} size="xs" />
        )}
      </div>
      {info.isVerboseEnabled && (
        <div className="mt-0.5 pl-18 text-[9px] text-[#999] dark:text-gray-500">
          pt={entry.boarding.pickupType} dt={entry.boarding.dropOffType}
          {entry.patternPosition.isTerminal && ' TERM'}
          {entry.patternPosition.isOrigin && ' ORIG'}
          {` [${entry.patternPosition.stopIndex + 1}/${entry.patternPosition.totalStops}]`}
          {` d=${entry.schedule.departureMinutes}`}
          {entry.schedule.arrivalMinutes !== entry.schedule.departureMinutes &&
            ` a=${entry.schedule.arrivalMinutes}`}
          {entry.routeDirection.direction !== undefined && ` dir=${entry.routeDirection.direction}`}
        </div>
      )}
    </div>
  );
}
