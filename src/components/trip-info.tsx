import type { InfoLevel } from '../types/app/settings';
import type { Agency, TimetableEntryAttributes } from '../types/app/transit';
import type { RouteDirection } from '../types/app/transit-composed';
import { type ResolvedDisplayNames, hasDisplayContent } from '../domain/transit/get-display-names';
import type { InfoLevelFlags } from '../utils/create-info-level';
import { DEFAULT_AGENCY_LANG } from '../config/transit-defaults';
import { cn } from '../lib/utils';
import { useInfoLevel } from '../hooks/use-info-level';
import { routeTypeEmoji } from '../utils/route-type-emoji';
import { getHeadsignDisplayNames } from '../domain/transit/get-headsign-display-names';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';
import { TimetableEntryAttributesLabels } from './label/timetable-entry-attributes-labels';
import { headsignSourceEmoji } from '../domain/transit/headsign-source-emoji';

const sizeVariants = {
  // Compact variant for StopSummary tooltips. Small text sizes are
  // intentional — secondary info must stay subordinate in limited space.
  sm: {
    emoji: 'text-xs',
    headsignSub: 'text-[8px]',
    headsign: 'text-[11px]',
    label: 'text-[8px]',
  },
  // Standard variant for DepartureItem / FlatDepartureItem.
  default: {
    emoji: 'text-base',
    headsignSub: 'text-[10px]',
    headsign: 'text-sm',
    label: 'text-[10px]',
  },
} as const;

/**
 * Headsign display within TripInfo.
 *
 * - simple: resolved name only
 * - normal+: resolved subNames + resolved name
 */
function HeadsignInfo({
  names,
  info,
  headsignClass,
  subClass,
  ellipsis,
}: {
  names: ResolvedDisplayNames;
  info: InfoLevelFlags;
  headsignClass: string;
  subClass: string;
  ellipsis: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 flex-col">
      {info.isNormalEnabled && names.subNames.length > 0 && (
        <span className={cn(subClass, ellipsis && 'truncate')}>{names.subNames.join(' / ')}</span>
      )}
      <span className={cn(headsignClass, ellipsis && 'truncate')}>{names.name}</span>
    </span>
  );
}

interface TripInfoProps {
  /** Route direction context for this trip. */
  routeDirection: RouteDirection;
  /** Current info verbosity level. */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Whether to show the route type emoji icon. */
  showRouteTypeIcon?: boolean;
  /** Agency operating this trip. Rendered only when `showAgency` is true. */
  agency?: Agency;
  /**
   * Whether to render the agency badge. The badge is still gated by
   * `infoLevel >= detailed` and the presence of `agency`, but this
   * flag lets callers opt out entirely (e.g. in compact contexts
   * where the agency would compete with the route badge for space).
   *
   * @default false
   */
  showAgency?: boolean;
  /**
   * Per-entry boolean attributes (terminal / origin / pickup-unavailable /
   * drop-off-unavailable). When provided, rendered via the shared
   * `TimetableEntryAttributesLabels` primitive so the style matches the
   * timetable grid.
   *
   * **Important**: only valid for **single-departure** consumers
   * (FlatDepartureItem, StopSummary) where the prop describes one specific
   * entry. Multi-departure consumers (DepartureItem) intentionally do NOT
   * pass this prop — instead they render `TimetableEntryAttributesLabels`
   * inline next to each individual departure time. This is required by
   * Issue #47: with si-based grouping a route+headsign bucket can contain
   * entries with different `stopIndex` (6-shape, circular routes), so
   * group-level attributes would mis-represent some entries.
   */
  attributes?: TimetableEntryAttributes;
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
  dataLang,
  showRouteTypeIcon = false,
  agency,
  showAgency = false,
  attributes,
  size = 'default',
  ellipsisHeadsign = false,
}: TripInfoProps) {
  const { route } = routeDirection;
  const info = useInfoLevel(infoLevel);
  const v = sizeVariants[size];
  const agencyLang = agency?.agency_lang ? [agency.agency_lang] : DEFAULT_AGENCY_LANG;
  const headsignNames = getHeadsignDisplayNames(routeDirection, dataLang, agencyLang, 'stop');

  const headsignClass = cn(v.headsign, 'font-medium text-[#333] dark:text-gray-200');
  const subClass = cn(v.headsignSub, 'font-normal text-[#888] dark:text-gray-400');

  const headSignInfos = info.isVerboseEnabled ? (
    <>
      {hasDisplayContent(headsignNames.tripName) && (
        <>
          <HeadsignInfo
            names={{
              ...headsignNames.tripName,
              name: headsignSourceEmoji('trip') + ' ' + headsignNames.tripName.name,
            }}
            info={info}
            headsignClass={headsignClass}
            subClass={subClass}
            ellipsis={ellipsisHeadsign}
          />
        </>
      )}
      {headsignNames.stopName && hasDisplayContent(headsignNames.stopName) && (
        <>
          <HeadsignInfo
            names={{
              ...headsignNames.stopName,
              name: headsignSourceEmoji('stop') + ' ' + headsignNames.stopName.name,
            }}
            info={info}
            headsignClass={headsignClass}
            subClass={subClass}
            ellipsis={ellipsisHeadsign}
          />
        </>
      )}
    </>
  ) : (
    <HeadsignInfo
      names={headsignNames.resolved}
      info={info}
      headsignClass={headsignClass}
      subClass={subClass}
      ellipsis={ellipsisHeadsign}
    />
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {showRouteTypeIcon && (
        <span className={`shrink-0 ${v.emoji}`}>{routeTypeEmoji(route.route_type)}</span>
      )}
      <RouteBadge
        route={route}
        dataLang={dataLang}
        agencyLangs={agencyLang}
        infoLevel={infoLevel}
        size={size === 'sm' ? 'sm' : undefined}
        disableVerbose={true}
      />
      {info.isDetailedEnabled && agency && showAgency && (
        <AgencyBadge
          size="xs"
          agency={agency}
          dataLang={dataLang}
          agencyLangs={agencyLang}
          infoLevel={infoLevel}
          disableVerbose={true}
        />
      )}

      {/* Headsign */}
      {headSignInfos}

      {attributes && (
        <TimetableEntryAttributesLabels
          attributes={attributes}
          // size: fixed for design reasons — these labels are visually subordinate to the main route/headsign info and should not compete for attention by scaling up to the same size as the route badge.
          size={'sm'}
          isDisplayTerminal={true}
          isDisplayOrigin={true}
          isDisplayPickupUnavailable={true}
          isDisplayDropOffUnavailable={true}
        />
      )}
    </div>
  );
}
