import type { InfoLevel } from '../types/app/settings';
import { useTranslation } from 'react-i18next';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { formatAbsoluteTime } from '../domain/transit/time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { getDisplayMinutes, hasBoardableDeparture } from '../domain/transit/timetable-utils';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
import { VerboseContextualTimetableEntries } from './verbose/verbose-contextual-timetable-entry';
import { Clock } from 'lucide-react';

interface DepartureItemProps {
  /** Timetable entries for a single route+headsign group. */
  entries: ContextualTimetableEntry[];
  now: Date;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
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
  dataLang,
  showRouteTypeIcon,
  agency,
  maxDisplay = 3,
  onShowTimetable,
}: DepartureItemProps) {
  const { t } = useTranslation();
  const showVerbose = infoLevel === 'verbose';
  const firstEntry = entries[0];
  if (!firstEntry) {
    return null;
  }

  const { route } = firstEntry.routeDirection;

  // Display at most N departures: 1st as both relative + absolute, rest as absolute only.
  const displayEntries = entries.slice(0, maxDisplay);

  // Convert minutes to Date for display — lightweight, only up to 3 entries.
  const displayTimes = displayEntries.map((e) =>
    minutesToDate(e.serviceDate, getDisplayMinutes(e)),
  );

  const first = displayTimes[0];
  const diffMs = first ? first.getTime() - now.getTime() : 0;

  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div>
        <TripInfo
          routeDirection={firstEntry.routeDirection}
          infoLevel={infoLevel}
          dataLang={dataLang}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          isTerminal={firstEntry.patternPosition.isTerminal}
          isPickupUnavailable={!hasBoardableDeparture(entries)}
        />
      </div>
      <div className="flex items-center gap-3 pl-1">
        {/* Relative time hint — easy to scan at a glance (e.g. "あと5分") */}
        {first && (
          <RelativeTime
            departureTime={first}
            now={now}
            size="lg"
            isTerminal={firstEntry.patternPosition.isTerminal}
            hidePrefix={diffMs > 90 * 60 * 1000}
          />
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
              onShowTimetable(route.route_id, getEffectiveHeadsign(firstEntry.routeDirection));
            }}
            title={t('showTimetable')}
            aria-label={t('showTimetable')}
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
