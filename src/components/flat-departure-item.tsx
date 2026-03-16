import type { InfoLevel } from '../types/app/settings';
import type { Agency, FlatDeparture } from '../types/app/transit';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { formatAbsoluteTime, formatRelativeTime } from '../domain/transit/time';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';

interface FlatDepartureItemProps {
  /** The flattened departure to display. */
  item: FlatDeparture;
  /** Current time for relative time calculation. */
  now: Date;
  /** Whether this is the first item (uses relative time format). */
  isFirst: boolean;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Current info verbosity level for route label formatting. */
  infoLevel: InfoLevel;
  /** Agency short name to display at detailed+ info level. */
  agencyName?: string;
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
}

/**
 * A single row in the T1 (Stop) flat departure list.
 *
 * The first departure shows relative time ("あと5分"), subsequent
 * departures show absolute time ("14:30"). Route label is colored
 * with the route's designated color.
 *
 * @param item - Flattened departure data.
 * @param now - Current time reference.
 * @param isFirst - Whether to display relative time.
 */
export function FlatDepartureItem({
  item,
  now,
  isFirst,
  showRouteTypeIcon,
  infoLevel,
  agencyName,
  agency,
}: FlatDepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const headsignName = getHeadsignDisplayNames(item.headsign, item.route, infoLevel).name;
  const bgColor = item.route.route_color ? `#${item.route.route_color}` : undefined;

  return (
    <div className="flex items-center gap-2 border-b border-[#e0e0e0] py-2 last:border-b-0 dark:border-gray-700">
      <span
        className="w-18 shrink-0 text-right text-sm font-bold text-[#333] dark:text-gray-100"
        style={bgColor ? { color: bgColor } : undefined}
      >
        {isFirst ? formatRelativeTime(item.departure, now) : formatAbsoluteTime(item.departure)}
      </span>
      {showRouteTypeIcon && (
        <span className="shrink-0 text-base">{routeTypeEmoji(item.route.route_type)}</span>
      )}
      <RouteBadge route={item.route} infoLevel={infoLevel} className="shrink-0" />
      {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
      <span className="truncate text-sm text-[#333] dark:text-gray-200">{headsignName}</span>
      {info.isDetailedEnabled && agencyName && (
        <span className="shrink-0 text-[10px] text-[#888] dark:text-gray-400">{agencyName}</span>
      )}
      {info.isDetailedEnabled && agency && (
        <AgencyBadge agency={agency} infoLevel={infoLevel} size="xs" />
      )}
    </div>
  );
}
