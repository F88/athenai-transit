import type { InfoLevel } from '../types/app/settings';
import { useTranslation } from 'react-i18next';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { formatAbsoluteTime } from '../domain/transit/time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { getTimetableEntryAttributes } from '../domain/transit/timetable-entry-attributes';
import { getDisplayMinutes } from '../domain/transit/timetable-utils';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
import { TimetableEntryAttributesLabels } from './label/timetable-entry-attributes-labels';
import { VerboseContextualTimetableEntries } from './verbose/verbose-contextual-timetable-entry';
import { Clock } from 'lucide-react';

interface StopTimesItemProps {
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
  /**
   * Whether to render the agency badge inside `TripInfo`. Forwarded
   * verbatim. Callers that know the stop's full agency set should
   * compute this as `agencies.length > 1` so the badge only appears
   * when it actually disambiguates between multiple operators.
   *
   * @default false
   */
  showAgency?: boolean;
  /** Maximum number of stop times to display. Defaults to 3. */
  maxDisplay?: number;
  onShowTimetable?: (routeId: string, headsign: string) => void;
}

export function StopTimesItem({
  entries,
  now,
  infoLevel,
  dataLang,
  showRouteTypeIcon,
  agency,
  showAgency = false,
  maxDisplay = 3,
  onShowTimetable,
}: StopTimesItemProps) {
  const { t } = useTranslation();
  const showVerbose = infoLevel === 'verbose';
  const firstEntry = entries[0];
  if (!firstEntry) {
    return null;
  }

  const { route } = firstEntry.routeDirection;

  // Display at most N stop times: 1st as both relative + absolute, rest as absolute only.
  const displayEntries = entries.slice(0, maxDisplay);

  // Convert minutes to Date for display — lightweight, only up to 3 entries.
  const displayTimes = displayEntries.map((e) =>
    minutesToDate(e.serviceDate, getDisplayMinutes(e)),
  );

  const first = displayTimes[0];
  const diffMs = first ? first.getTime() - now.getTime() : 0;

  // Issue #47 / Alt F: attributes (terminal/origin/pickup/dropOff) are properties
  // of individual stop times, not groups. With si-based grouping in place, the
  // same route+headsign bucket can contain entries with different stopIndex
  // (6-shape routes, circular routes), so we render attribute labels per-stop-times
  // inline with each time slot rather than as a single group-level badge on
  // TripInfo's `attributes?` prop is kept for single-stop-time consumers
  // (StopTimeItem, StopSummary) but StopTimesItem no longer passes it.
  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div>
        <TripInfo
          routeDirection={firstEntry.routeDirection}
          infoLevel={infoLevel}
          dataLang={dataLang}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          showAgency={showAgency}
        />
      </div>
      <div className="flex items-center gap-3 pl-1">
        {/* Relative time hint — easy to scan at a glance (e.g. "あと5分").
            Kept as a non-wrapping single unit so the prefix stays glued to
            the value even on narrow screens. */}
        {first && (
          <RelativeTime
            time={first}
            now={now}
            size="lg"
            isTerminal={firstEntry.patternPosition.isTerminal}
            hidePrefix={diffMs > 90 * 60 * 1000}
          />
        )}
        {/* Absolute times wrapper — own flex-wrap container so the n
            absolute time entries can fold onto a second row when the
            container is narrow, while RelativeTime and the timetable
            button stay on the original row. `min-w-0 flex-1` lets it
            consume the remaining inline space and shrink to allow
            wrapping. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          {/* Absolute times for all entries including the first.
              The first entry intentionally appears in both relative and absolute
              because relative alone (e.g. "あと400分") is hard to interpret.
              Per Issue #47 / Alt F, each time renders its own per-stop-time
              attribute labels (TERM/ORIG/noPickup/noDropOff) inline. */}
          {displayEntries.map((entry, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 text-sm font-bold whitespace-nowrap text-[#757575] dark:text-gray-400"
            >
              {formatAbsoluteTime(displayTimes[i])}
              <TimetableEntryAttributesLabels
                attributes={getTimetableEntryAttributes(entry)}
                size="xs"
                isDisplayTerminal
                isDisplayOrigin
                isDisplayPickupUnavailable
                isDisplayDropOffUnavailable
              />
            </span>
          ))}
        </div>
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
