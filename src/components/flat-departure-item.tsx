import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';
import { VerboseContextualTimetableEntry } from './verbose/verbose-contextual-timetable-entry';

interface FlatDepartureItemProps {
  /** The timetable entry to display. */
  entry: ContextualTimetableEntry;
  /** Current time for relative time calculation. */
  now: Date;
  /** Whether this is the first item in the list. */
  isFirst: boolean;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Current info verbosity level for route label formatting. */
  infoLevel: InfoLevel;
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
  now,
  isFirst,
  showRouteTypeIcon,
  infoLevel,
  agency,
}: FlatDepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  const { route } = entry.routeDirection;
  const headsignNames = getHeadsignDisplayNames(entry.routeDirection, infoLevel);
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;
  const isTerminal = entry.patternPosition.isTerminal;
  // Terminal entries show arrival time; all others show departure time.
  const displayMinutes = isTerminal
    ? entry.schedule.arrivalMinutes
    : entry.schedule.departureMinutes;
  const departureTime = minutesToDate(entry.serviceDate, displayMinutes);
  const isPickupUnavailable = entry.boarding.pickupType === 1;

  return (
    <div className="border-b border-[#e0e0e0] py-2 last:border-b-0 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className="w-18 shrink-0 text-right">
          {/* Relative time hint for first entry or entries within 10 min */}
          {(isFirst || departureTime.getTime() - now.getTime() <= 10 * 60 * 1000) && (
            <div
              className="text-sm font-bold text-[#333] dark:text-gray-100"
              style={bgColor ? { color: bgColor } : undefined}
            >
              {formatRelativeTime(departureTime, now)}
              {isTerminal && <span className="text-xs font-normal opacity-70">着</span>}
            </div>
          )}
          {/* Absolute time — always shown alongside relative for precise reference */}
          <div
            className="text-sm font-bold text-[#333] dark:text-gray-100"
            style={bgColor ? { color: bgColor } : undefined}
          >
            {formatAbsoluteTime(departureTime)}
            {isTerminal && <span className="text-[10px] font-normal opacity-70">着</span>}
          </div>
        </div>
        {showRouteTypeIcon && (
          <span className="shrink-0 text-base">{routeTypeEmoji(route.route_type)}</span>
        )}
        <RouteBadge
          className="shrink-0"
          route={route}
          infoLevel={infoLevel}
          disableVerbose={true}
        />
        {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
        <span className="inline-flex min-w-0 flex-col">
          {headsignNames.subNames.length > 0 && (
            <span className="text-[10px] font-normal text-[#888] dark:text-gray-400">
              {headsignNames.subNames.join(' / ')}
            </span>
          )}
          <span className="truncate text-sm text-[#333] dark:text-gray-200">
            {headsignNames.name}
          </span>
        </span>
        {/* Terminal/pickup labels are shown at all InfoLevels (unlike TimetableGrid's
            EntryLabels which gates by level). NearbyStop needs these labels to explain
            why a departure is not boardable — hiding them would leave users unable to
            distinguish drop-off-only arrivals from normal departures. */}
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
        {info.isDetailedEnabled && agency && (
          <AgencyBadge
            //
            size="xs"
            agency={agency}
            infoLevel={infoLevel}
            disableVerbose={true}
          />
        )}
      </div>
      {/* Verbose data */}
      {showVerbose && (
        <VerboseContextualTimetableEntry
          //
          entry={entry}
          // disableVerbose={true}
        />
      )}
    </div>
  );
}
