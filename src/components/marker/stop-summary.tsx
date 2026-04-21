import type { InfoLevel } from '../../types/app/settings';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import { resolveAgencyLang } from '../../config/transit-defaults';
import { createInfoLevel } from '../../utils/create-info-level';
import { getStopDisplayNames } from '../../domain/transit/get-stop-display-names';
import { minutesToDate } from '../../domain/transit/calendar-utils';
import { getTimetableEntryAttributes } from '../../domain/transit/timetable-entry-attributes';
import { getDisplayMinutes } from '../../domain/transit/timetable-utils';
import { AgencyBadge } from '../badge/agency-badge';
import { routeTypesEmoji } from '../../utils/route-type-emoji';
import { IdBadge } from '../badge/id-badge';
import { RelativeTime } from '../relative-time';
import { TripInfo } from '../trip-info';

interface StopSummaryProps {
  stop: Stop;
  routeTypes: AppRouteTypeValue[];
  agencies: Agency[];
  entries?: ContextualTimetableEntry[];
  now?: Date;
  /** Info level for controlling display verbosity. Uses createInfoLevel
   *  instead of the useInfoLevel hook because this component is also
   *  rendered via renderToStaticMarkup (Canvas mode). */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
}

/**
 * Render a stop's name, sub-names, and up to 3 upcoming stop times.
 *
 * Shared by both standard-mode Tooltip and lightweight-mode Popup.
 */
export function StopSummary({
  stop,
  routeTypes,
  agencies,
  entries,
  now,
  infoLevel,
  dataLang,
}: StopSummaryProps) {
  const info = createInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(
    stop,
    dataLang,
    resolveAgencyLang(agencies, stop.agency_id),
  );
  // Departure items require `now` for relative time display
  const items = now ? (entries?.slice(0, 3) ?? []) : [];

  return (
    <>
      {info.isVerboseEnabled && <IdBadge>{stop.stop_id}</IdBadge>}
      {info.isNormalEnabled && stopNames.subNames.length > 0 && (
        <div className="truncate text-[11px] font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-[#333] dark:text-gray-200">
        <span>
          {routeTypesEmoji(routeTypes)} {stopNames.name}
        </span>
        {agencies.length > 0 &&
          agencies.map((a) => (
            <AgencyBadge
              key={a.agency_id}
              agency={a}
              size="xs"
              dataLang={dataLang}
              agencyLangs={resolveAgencyLang(agencies, a.agency_id)}
              infoLevel={infoLevel}
              showBorder={true}
            />
          ))}
      </div>
      {items.map((entry, i) => {
        const depTime = minutesToDate(entry.serviceDate, getDisplayMinutes(entry));
        return (
          <div
            key={i}
            className="mt-0.5 flex items-center gap-1 text-[11px] text-[#555] dark:text-gray-400"
          >
            <TripInfo
              size={'sm'}
              routeDirection={entry.routeDirection}
              infoLevel={infoLevel === 'verbose' ? infoLevel : 'simple'}
              dataLang={dataLang}
              showRouteTypeIcon={false}
              attributes={getTimetableEntryAttributes(entry)}
              ellipsisHeadsign={true}
            />

            <RelativeTime
              time={depTime}
              now={now!}
              size="sm"
              isTerminal={entry.patternPosition.isTerminal}
            />
          </div>
        );
      })}
    </>
  );
}
