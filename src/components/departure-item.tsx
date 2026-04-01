import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { hasBoardableDeparture } from '../domain/transit/timetable-utils';
import { TripInfo } from './trip-info';
import { VerboseContextualTimetableEntries } from './verbose/verbose-contextual-timetable-entry';
import { Clock } from 'lucide-react';

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
  const showVerbose = infoLevel === 'verbose';
  const firstEntry = entries[0];
  if (!firstEntry) {
    return null;
  }

  const { route } = firstEntry.routeDirection;

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
      <div className="mb-1.5">
        <TripInfo
          routeDirection={firstEntry.routeDirection}
          infoLevel={infoLevel}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          isTerminal={firstEntry.patternPosition.isTerminal}
          isPickupUnavailable={!hasBoardableDeparture(entries)}
        />
      </div>
      <div className="flex items-center gap-3 pl-1">
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
        {onShowTimetable && (
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-1.5 py-0.5 text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowTimetable(route.route_id, firstEntry.routeDirection.headsign);
            }}
            title="Show timetable"
            aria-label="Show timetable"
          >
            <Clock size={14} strokeWidth={2} />
          </button>
        )}
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
