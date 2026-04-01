import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { RouteDirection } from '../types/app/transit-composed';
import { cn } from '../lib/utils';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';

const sizeVariants = {
  sm: {
    emoji: 'text-xs',
    headsignSub: 'text-[8px]',
    headsign: 'text-[11px]',
    label: 'text-[8px]',
  },
  default: {
    emoji: 'text-base',
    headsignSub: 'text-[10px]',
    headsign: 'text-sm',
    label: 'text-[10px]',
  },
} as const;

interface TripInfoProps {
  /** Route direction context for this trip. */
  routeDirection: RouteDirection;
  /** Current info verbosity level. */
  infoLevel: InfoLevel;
  /** Whether to show the route type emoji icon. */
  showRouteTypeIcon?: boolean;
  /** Agency operating this trip. Shown at detailed+ info level. */
  agency?: Agency;
  /** Whether this stop is the terminal (last stop) of the trip. */
  isTerminal?: boolean;
  /** Whether pickup is unavailable at this stop. */
  isPickupUnavailable?: boolean;
  /** Size variant. @default 'default' */
  size?: keyof typeof sizeVariants;
  /** Apply CSS text-overflow ellipsis to headsign name and sub-names. */
  ellipsisHeadsign?: boolean;
}

/**
 * Displays trip identification info: route type icon, route badge,
 * agency badge, headsign with translations, and status labels
 * (terminal / pickup unavailable).
 *
 * Shared by {@link DepartureItem} and {@link FlatDepartureItem}.
 */
export function TripInfo({
  routeDirection,
  infoLevel,
  showRouteTypeIcon = false,
  agency,
  isTerminal = false,
  isPickupUnavailable = false,
  size = 'default',
  ellipsisHeadsign = false,
}: TripInfoProps) {
  const { route } = routeDirection;
  const info = useInfoLevel(infoLevel);
  const headsignNames = getHeadsignDisplayNames(routeDirection, infoLevel);
  const v = sizeVariants[size];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {showRouteTypeIcon && (
        <span className={`shrink-0 ${v.emoji}`}>{routeTypeEmoji(route.route_type)}</span>
      )}
      <RouteBadge
        route={route}
        infoLevel={infoLevel}
        size={size === 'sm' ? 'sm' : undefined}
        disableVerbose={true}
      />
      {info.isDetailedEnabled && agency && (
        <AgencyBadge size="xs" agency={agency} infoLevel={infoLevel} disableVerbose={true} />
      )}
      {/* Empty when headsign is unavailable — RouteBadge already identifies the route. */}
      <span className="inline-flex min-w-0 flex-col">
        {headsignNames.subNames.length > 0 && (
          <span
            className={cn(
              v.headsignSub,
              'font-normal text-[#888] dark:text-gray-400',
              ellipsisHeadsign && 'truncate',
            )}
          >
            {headsignNames.subNames.join(' / ')}
          </span>
        )}
        <span
          className={cn(
            v.headsign,
            'font-medium text-[#333] dark:text-gray-200',
            ellipsisHeadsign && 'truncate',
          )}
        >
          {headsignNames.name}
        </span>
      </span>
      {isTerminal && (
        <span
          className={`shrink-0 rounded bg-gray-100 px-1 ${v.label} font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300`}
        >
          終点
        </span>
      )}
      {isPickupUnavailable && (
        <span
          className={`shrink-0 rounded bg-red-100 px-1 ${v.label} font-medium text-red-700 dark:bg-red-900 dark:text-red-300`}
        >
          乗車不可
        </span>
      )}
    </div>
  );
}
