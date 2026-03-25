import { useMemo } from 'react';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { TimetableEntry } from '../types/app/transit-composed';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { hasBoardableDeparture } from '../domain/transit/timetable-utils';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';

interface DepartureItemProps {
  /** Timetable entries for a single route+headsign group. */
  entries: TimetableEntry[];
  /** Service day used to resolve departure minutes to Date. */
  serviceDay: Date;
  now: Date;
  infoLevel: InfoLevel;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Agency short name to display at detailed+ info level. */
  agencyName?: string;
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
  /** Maximum number of departures to display. Defaults to 3. */
  maxDisplay?: number;
  onShowTimetable?: (routeId: string, headsign: string) => void;
}

export function DepartureItem({
  entries,
  serviceDay,
  now,
  infoLevel,
  showRouteTypeIcon,
  agencyName,
  agency,
  maxDisplay = 3,
  onShowTimetable,
}: DepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const firstEntry = entries[0];
  if (!firstEntry) {
    return null;
  }

  const { route, headsign } = firstEntry.routeDirection;
  const headsignName = getHeadsignDisplayNames(headsign, route, infoLevel).name;

  // Display at most N departures: 1st as relative time, rest as absolute.
  const displayEntries = entries.slice(0, maxDisplay);

  // Convert minutes to Date for display — lightweight, only up to 3 entries.
  // Terminal entries show arrival time; all others show departure time.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- entries/serviceDay are stable within a render
  const displayTimes = useMemo(
    () =>
      displayEntries.map((e) =>
        minutesToDate(
          serviceDay,
          e.patternPosition.isTerminal ? e.schedule.arrivalMinutes : e.schedule.departureMinutes,
        ),
      ),
    [displayEntries, serviceDay],
  );

  const first = displayTimes[0];
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;

  return (
    <div className="border-b border-[#e0e0e0] py-3 last:border-b-0 dark:border-gray-700">
      <div className="mb-1.5 flex items-center gap-2">
        {showRouteTypeIcon && (
          <span className="shrink-0 text-base">{routeTypeEmoji(route.route_type)}</span>
        )}
        <RouteBadge route={route} infoLevel={infoLevel} />
        {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
        <span className="text-sm font-medium text-[#333] dark:text-gray-200">{headsignName}</span>
        {!hasBoardableDeparture(entries) && (
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
        {onShowTimetable && (
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-2 py-0.5 text-xs whitespace-nowrap text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowTimetable(route.route_id, headsign);
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
            {firstEntry.patternPosition.isTerminal && (
              <span className="text-xs font-normal opacity-70">着</span>
            )}
          </span>
        )}
        {displayTimes.map((dep, i) => (
          <span key={i} className="text-sm text-[#757575] dark:text-gray-400">
            {formatAbsoluteTime(dep)}
            {displayEntries[i]?.patternPosition.isTerminal && (
              <span className="text-[10px] opacity-70">着</span>
            )}
          </span>
        ))}
      </div>
      {info.isVerboseEnabled && (
        <div className="mt-1 space-y-0.5 pl-1">
          {displayEntries.map((e, i) => (
            <div key={i} className="text-[9px] text-[#999] dark:text-gray-500">
              {formatAbsoluteTime(displayTimes[i])}
              {` pt=${e.boarding.pickupType} dt=${e.boarding.dropOffType}`}
              {e.patternPosition.isTerminal && ' TERM'}
              {e.patternPosition.isOrigin && ' ORIG'}
              {` [${e.patternPosition.stopIndex + 1}/${e.patternPosition.totalStops}]`}
              {` d=${e.schedule.departureMinutes}`}
              {e.schedule.arrivalMinutes !== e.schedule.departureMinutes &&
                ` a=${e.schedule.arrivalMinutes}`}
              {e.routeDirection.direction !== undefined && ` dir=${e.routeDirection.direction}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
