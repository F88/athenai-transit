import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { hasBoardableDeparture } from '../domain/transit/timetable-utils';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';
import { VerboseContextualTimetableEntries } from './verbose/verbose-contextual-timetable-entry';

interface DepartureItemProps {
  /** Timetable entries for a single route+headsign group. */
  entries: ContextualTimetableEntry[];
  now: Date;
  infoLevel: InfoLevel;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
  /** Maximum number of departures to display. Defaults to 3. */
  maxDisplay?: number;
  onShowTimetable?: (routeId: string, headsign: string) => void;
}

export function DepartureItem({
  entries,
  now,
  infoLevel,
  showRouteTypeIcon,
  agency,
  maxDisplay = 3,
  onShowTimetable,
}: DepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  const firstEntry = entries[0];
  if (!firstEntry) {
    return null;
  }

  const { route } = firstEntry.routeDirection;
  const headsignNames = getHeadsignDisplayNames(firstEntry.routeDirection, infoLevel);

  // Display at most N departures: 1st as relative time, rest as absolute.
  const displayEntries = entries.slice(0, maxDisplay);

  // Convert minutes to Date for display — lightweight, only up to 3 entries.
  // Terminal entries show arrival time; all others show departure time.
  const displayTimes = displayEntries.map((e) =>
    minutesToDate(
      e.serviceDate,
      e.patternPosition.isTerminal ? e.schedule.arrivalMinutes : e.schedule.departureMinutes,
    ),
  );

  const first = displayTimes[0];
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;

  return (
    <div className="border-b border-[#e0e0e0] py-3 last:border-b-0 dark:border-gray-700">
      <div className="mb-1.5 flex items-center gap-2">
        {showRouteTypeIcon && (
          <span className="shrink-0 text-base">{routeTypeEmoji(route.route_type)}</span>
        )}
        <RouteBadge route={route} infoLevel={infoLevel} disableVerbose={true} />
        {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
        <span className="inline-flex flex-col">
          {headsignNames.subNames.length > 0 && (
            <span className="text-[10px] font-normal text-[#888] dark:text-gray-400">
              {headsignNames.subNames.join(' / ')}
            </span>
          )}
          <span className="text-sm font-medium text-[#333] dark:text-gray-200">
            {headsignNames.name}
          </span>
        </span>
        {/* Shown at all InfoLevels — users need to know why this group is not boardable.
            See FlatDepartureItem for the same rationale. */}
        {!hasBoardableDeparture(entries) && (
          <span className="shrink-0 rounded bg-red-100 px-1 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            乗車不可
          </span>
        )}
        {info.isDetailedEnabled && agency && (
          <AgencyBadge size="xs" agency={agency} infoLevel={infoLevel} disableVerbose={true} />
        )}
        {onShowTimetable && (
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-2 py-0.5 text-xs whitespace-nowrap text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowTimetable(route.route_id, firstEntry.routeDirection.headsign);
            }}
          >
            時刻表
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-3 pl-1">
        {/* Relative time hint — easy to scan at a glance (e.g. "あと5分") */}
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
        {/* Absolute times for all entries including the first.
            The first entry intentionally appears in both relative and absolute
            because relative alone (e.g. "あと400分") is hard to interpret. */}
        {displayTimes.map((dep, i) => (
          <span key={i} className="text-sm text-[#757575] dark:text-gray-400">
            {formatAbsoluteTime(dep)}
            {displayEntries[i]?.patternPosition.isTerminal && (
              <span className="text-[10px] opacity-70">着</span>
            )}
          </span>
        ))}
      </div>
      {/* Verbose data */}
      {showVerbose && (
        <VerboseContextualTimetableEntries
          //
          entries={displayEntries}
          // disableVerbose={true}
        />
      )}
    </div>
  );
}
