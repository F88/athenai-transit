import type { InfoLevel } from '../../types/app/settings';
import type { Agency, RouteType, Stop } from '../../types/app/transit';
import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import { createInfoLevel } from '../../utils/create-info-level';
import { getStopDisplayNames } from '../../domain/transit/get-stop-display-names';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { minutesToDate } from '../../domain/transit/calendar-utils';
import { AgencyBadge } from '../badge/agency-badge';
import { RouteBadge } from '../badge/route-badge';
import { routeTypesEmoji } from '../../domain/transit/route-type-emoji';
import { IdBadge } from '../badge/id-badge';

interface StopSummaryProps {
  stop: Stop;
  routeTypes: RouteType[];
  agencies: Agency[];
  entries?: ContextualTimetableEntry[];
  now?: Date;
  /** Info level for controlling display verbosity. Uses createInfoLevel
   *  instead of the useInfoLevel hook because this component is also
   *  rendered via renderToStaticMarkup (Canvas mode). */
  infoLevel: InfoLevel;
}

/**
 * Render a stop's name, sub-names, and up to 3 upcoming departures.
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
}: StopSummaryProps) {
  const info = createInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  // Departure items require `now` for relative time display
  const items = now ? (entries?.slice(0, 3) ?? []) : [];

  return (
    <>
      {info.isVerboseEnabled && <IdBadge>{stop.stop_id}</IdBadge>}
      {stopNames.subNames.length > 0 && (
        <div className="text-[11px] font-normal break-all text-[#888] dark:text-gray-400">
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
              infoLevel={infoLevel}
              size="xs"
              disableVerbose
            />
          ))}
      </div>
      {items.map((entry, i) => {
        // now is guaranteed defined here because items is empty when now is undefined
        // Terminal entries show arrival time; all others show departure time.
        const displayMinutes = entry.patternPosition.isTerminal
          ? entry.schedule.arrivalMinutes
          : entry.schedule.departureMinutes;
        const depTime = minutesToDate(entry.serviceDate, displayMinutes);
        const diffMin = Math.floor((depTime.getTime() - now!.getTime()) / 60000);
        const relative = diffMin <= 0 ? 'まもなく' : `${diffMin}分`;
        const { route } = entry.routeDirection;
        const headsignName = getHeadsignDisplayNames(entry.routeDirection, infoLevel).name;
        return (
          <div
            key={i}
            className="mt-0.5 flex items-center gap-1 text-[11px] text-[#555] dark:text-gray-400"
          >
            <RouteBadge route={route} infoLevel={infoLevel} size="sm" disableVerbose />
            {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
            <span>{headsignName}</span>
            <span>{relative}</span>
          </div>
        );
      })}
    </>
  );
}
