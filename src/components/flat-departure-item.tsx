import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { formatAbsoluteTime } from '../domain/transit/time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { getDisplayMinutes } from '../domain/transit/timetable-utils';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
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
  /** Display language for translated names. */
  lang: string;
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
  lang,
  agency,
}: FlatDepartureItemProps) {
  const showVerbose = infoLevel === 'verbose';
  const { route } = entry.routeDirection;
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;
  const isTerminal = entry.patternPosition.isTerminal;
  const departureTime = minutesToDate(entry.serviceDate, getDisplayMinutes(entry));
  const isPickupUnavailable = entry.boarding.pickupType === 1;
  const diffMs = departureTime.getTime() - now.getTime();
  const showRelativeTime = isFirst || diffMs <= 60 * 60 * 1000;

  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div className="flex gap-2">
        <div className="flex min-h-8 w-14 shrink-0 flex-col justify-center text-right leading-none">
          {showRelativeTime && (
            <RelativeTime
              now={now}
              departureTime={departureTime}
              isTerminal={isTerminal}
              // Hide prefix for departures >90min to save space.
              hidePrefix={diffMs > 90 * 60 * 1000}
            />
          )}
          {/* Absolute time — always shown alongside relative for precise reference */}
          <div
            className="text-base text-[#333] dark:text-gray-100"
            style={bgColor ? { color: bgColor } : undefined}
          >
            {formatAbsoluteTime(departureTime)}
            {isTerminal && <span className="text-[10px] font-normal opacity-70">着</span>}
          </div>
        </div>
        <TripInfo
          routeDirection={entry.routeDirection}
          infoLevel={infoLevel}
          lang={lang}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          isTerminal={isTerminal}
          isPickupUnavailable={isPickupUnavailable}
        />
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
