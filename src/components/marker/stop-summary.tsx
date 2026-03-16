import type { InfoLevel } from '../../types/app/settings';
import type { Agency, RouteType, Stop, StopWithContext } from '../../types/app/transit';
import { createInfoLevel } from '../../utils/create-info-level';
import { getStopDisplayNames } from '../../domain/transit/get-stop-display-names';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { AgencyBadge } from '../badge/agency-badge';
import { RouteBadge } from '../badge/route-badge';
import { routeTypesEmoji } from '../../domain/transit/route-type-emoji';

interface StopSummaryProps {
  stop: Stop;
  routeTypes: RouteType[];
  agencies: Agency[];
  groups?: StopWithContext['groups'];
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
 *
 * @param stop - The stop to display.
 * @param routeTypes - GTFS route_type values for the emoji icon(s).
 * @param groups - Departure groups from the stop (optional).
 * @param now - Current time for relative time calculation.
 * @param infoLevel - Controls which metadata fields are shown.
 */
export function StopSummary({
  stop,
  routeTypes,
  agencies,
  groups,
  now,
  infoLevel,
}: StopSummaryProps) {
  const info = createInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  // Departure items require `now` for relative time display
  const items = now ? (groups?.slice(0, 3) ?? []) : [];

  return (
    <>
      {info.isVerboseEnabled && (
        <div className="mb-0.5 inline-block rounded-[3px] bg-[#f0f0f0] px-1.5 text-[10px] leading-[1.4] font-normal text-[#666] dark:bg-gray-700 dark:text-gray-400">
          {stop.stop_id}
        </div>
      )}
      {stopNames.subNames.length > 0 && (
        <div className="text-[11px] font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-[#333] dark:text-gray-200">
        <span>
          {routeTypesEmoji(routeTypes)} {stopNames.name}
        </span>
        {agencies.length > 0 &&
          agencies.map((a) => (
            <AgencyBadge key={a.agency_id} agency={a} infoLevel={infoLevel} size="xs" />
          ))}
      </div>
      {items.map((group, i) => {
        const first = group.departures[0];
        if (!first) {
          return null;
        }
        // now is guaranteed defined here because items is empty when now is undefined
        const diffMin = Math.floor((first.getTime() - now!.getTime()) / 60000);
        const relative = diffMin <= 0 ? 'まもなく' : `${diffMin}分`;
        const headsignName = getHeadsignDisplayNames(group.headsign, group.route, infoLevel).name;
        return (
          <div
            key={i}
            className="mt-0.5 flex items-center gap-1 text-[11px] text-[#555] dark:text-gray-400"
          >
            <RouteBadge route={group.route} infoLevel={infoLevel} size="sm" />
            {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
            <span>{headsignName}</span>
            <span>{relative}</span>
          </div>
        );
      })}
    </>
  );
}
