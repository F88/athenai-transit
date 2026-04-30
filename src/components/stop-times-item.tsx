import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { formatAbsoluteTime } from '../domain/transit/time';
import { getTimetableEntryAttributes } from '../domain/transit/timetable-entry-attributes';
import { getDisplayMinutes } from '../domain/transit/timetable-utils';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry, TripInspectionTarget } from '../types/app/transit-composed';
import { TimetableEntryAttributesLabels } from './label/timetable-entry-attributes-labels';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
import { VerboseContextualTimetableEntries } from './verbose/verbose-contextual-timetable-entry';

interface StopTimesItemProps {
  /** Timetable entries for a single route+headsign group. */
  entries: ContextualTimetableEntry[];
  now: Date;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
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
  /** Optional callback for inspecting one concrete trip. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function StopTimesItem({
  entries,
  now,
  infoLevel,
  dataLangs,
  showRouteTypeIcon,
  agency,
  showAgency = false,
  maxDisplay = 3,
  onShowTimetable,
  onInspectTrip,
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
          size="md"
          routeDirection={firstEntry.routeDirection}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
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
          <RelativeTime time={first} now={now} size="lg" hidePrefix={diffMs > 90 * 60 * 1000} />
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
          {displayEntries.map((entry, i) => {
            // Issue #47: 6-shape / circular routes can place the same trip
            // at multiple `stopIndex` values within one route+headsign
            // bucket, so include `stopIndex` in the key alongside the
            // tripLocator triple to keep keys unique per stop event.
            const entryKey = `${entry.tripLocator.patternId}__${entry.tripLocator.serviceId}__${entry.tripLocator.tripIndex}__${entry.patternPosition.stopIndex}`;
            const content = (
              <>
                {formatAbsoluteTime(displayTimes[i])}
                <TimetableEntryAttributesLabels
                  attributes={getTimetableEntryAttributes(entry)}
                  size="xs"
                  isDisplayTerminal
                  isDisplayOrigin
                  isDisplayPickupUnavailable
                  isDisplayDropOffUnavailable
                />
              </>
            );

            return onInspectTrip ? (
              <button
                key={entryKey}
                type="button"
                className="inline-flex cursor-pointer items-center gap-0.5 rounded-sm text-sm font-bold whitespace-nowrap text-[#757575] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-gray-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspectTrip({
                    serviceDate: entry.serviceDate,
                    tripLocator: entry.tripLocator,
                    stopIndex: entry.patternPosition.stopIndex,
                    departureMinutes: entry.schedule.departureMinutes,
                  });
                }}
              >
                {content}
              </button>
            ) : (
              <span
                key={entryKey}
                className="inline-flex items-center gap-0.5 text-sm font-bold whitespace-nowrap text-[#757575] dark:text-gray-400"
              >
                {content}
              </span>
            );
          })}
        </div>
        {onShowTimetable && (
          <button
            type="button"
            // className="ml-auto shrink-0 cursor-pointer rounded border border-blue-700 bg-transparent px-1.5 py-0.5 text-blue-700 active:bg-blue-700/10 dark:border-blue-400 dark:text-blue-400 dark:active:bg-blue-400/10"
            // className="shrink-0 cursor-pointer rounded border border-teal-600 bg-transparent px-1.5 py-0.5 text-teal-600 active:bg-teal-600/10 dark:border-teal-400 dark:text-teal-400 dark:active:bg-teal-400/10"
            className="shrink-0 cursor-pointer rounded border border-slate-600 bg-transparent px-1.5 py-0.5 text-slate-600 active:bg-slate-600/10 dark:border-slate-300 dark:text-slate-300 dark:active:bg-slate-300/10"
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
