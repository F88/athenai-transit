import { DEFAULT_AGENCY_LANG } from '../config/transit-defaults';
import { headsignSourceEmoji } from '../domain/transit/headsign-source-emoji';
import { hasDisplayContent } from '../domain/transit/name-resolver/get-display-names';
import { getHeadsignDisplayNames } from '../domain/transit/name-resolver/get-headsign-display-names';
import { useInfoLevel } from '../hooks/use-info-level';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, TimetableEntryAttributes } from '../types/app/transit';
import type { RouteDirection } from '../types/app/transit-composed';
import { routeTypeEmoji } from '../utils/route-type-emoji';
import { AgencyBadge } from './badge/agency-badge';
import { RouteBadge } from './badge/route-badge';
import type { BaseLabelSize } from './label/base-label';
import { TimetableEntryAttributesLabels } from './label/timetable-entry-attributes-labels';
import { StackedDisplayNames } from './shared/stacked-display-names';

const sizeVariants = {
  // Standard variant for StopTimeItem / StopTimesItem.
  md: {
    emoji: 'text-[1.2rem]',
    label: 'text-[0.7rem]',
    sizeForNames: 'md',
  },
  // Compact variant for StopSummary tooltips. Small text sizes are
  // intentional — secondary info must stay subordinate in limited space.
  sm: {
    emoji: 'text-[1.0rem]',
    label: 'text-[0.6rem]',
    sizeForNames: 'sm',
  },
  xs: {
    emoji: 'text-[1.0rem]',
    label: 'text-[0.5rem]',
    sizeForNames: 'xs',
  },
} as const;

/**
 * Size passed to {@link TimetableEntryAttributesLabels}, mapped from TripInfo's
 * own `size`. Currently an identity mapping; per-size values are tuned here.
 */
const ATTRIBUTES_LABELS_SIZE_BY_SIZE: Record<keyof typeof sizeVariants, BaseLabelSize> = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
};
interface TripInfoProps {
  /** Agency operating this trip. Rendered only when `showAgency` is true. */
  agency?: Agency;
  /** Route direction context for this trip. */
  routeDirection: RouteDirection;
  /**
   * Per-entry boolean attributes (terminal / origin / pickup-unavailable /
   * drop-off-unavailable). When provided, rendered via the shared
   * `TimetableEntryAttributesLabels` primitive so the style matches the
   * timetable grid.
   *
   * **Important**: only valid for **single-stop-time** consumers
   * (StopTimeItem, StopSummary) where the prop describes one specific
   * entry. Multi-stop-time consumers (StopTimesItem) intentionally do NOT
   * pass this prop — instead they render `TimetableEntryAttributesLabels`
   * inline next to each individual stop time. This is required by
   * Issue #47: with si-based grouping a route+headsign bucket can contain
   * entries with different `stopIndex` (6-shape, circular routes), so
   * group-level attributes would mis-represent some entries.
   */
  attributes?: TimetableEntryAttributes;
  /** Size variant. */
  size: keyof typeof sizeVariants;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Current info verbosity level. */
  infoLevel: InfoLevel;
  /** Whether to show the route type emoji icon. */
  showRouteTypeIcon?: boolean;
  /**
   * Whether to render the agency badge. The badge is still gated by
   * `infoLevel >= detailed` and the presence of `agency`, but this
   * flag lets callers opt out entirely (e.g. in compact contexts
   * where the agency would compete with the route badge for space).
   *
   * @default false
   */
  showAgency?: boolean;
  /** Apply CSS text-overflow ellipsis to headsign name and sub-names. */
  ellipsisHeadsign?: boolean;
}

/**
 * Displays trip identification info: route type icon, route badge,
 * agency badge, headsign with translations, and status labels
 * (terminal / pickup unavailable).
 *
 * Shared by {@link StopTimeItem} and {@link StopTimesItem}.
 */
export function TripInfo({
  agency,
  routeDirection,
  attributes,
  size,
  dataLangs,
  infoLevel,
  showRouteTypeIcon = false,
  showAgency = false,
  ellipsisHeadsign = false,
}: TripInfoProps) {
  const { route } = routeDirection;
  const infoLevelFlag = useInfoLevel(infoLevel);
  const v = sizeVariants[size];
  const agencyLang = agency?.agency_lang ? [agency.agency_lang] : DEFAULT_AGENCY_LANG;
  const headsignNames = getHeadsignDisplayNames(routeDirection, dataLangs, agencyLang, 'stop');

  const headSignInfos = infoLevelFlag.isVerboseEnabled ? (
    <>
      {hasDisplayContent(headsignNames.tripName) && (
        <>
          <StackedDisplayNames
            names={{
              ...headsignNames.tripName,
              name: headsignSourceEmoji('trip') + ' ' + headsignNames.tripName.name,
            }}
            size={v.sizeForNames}
            ellipsis={ellipsisHeadsign}
            showSubNames={infoLevelFlag.isNormalEnabled}
            subNamesPosition="top"
          />
        </>
      )}
      {headsignNames.stopName && hasDisplayContent(headsignNames.stopName) && (
        <>
          <StackedDisplayNames
            names={{
              ...headsignNames.stopName,
              name: headsignSourceEmoji('stop') + ' ' + headsignNames.stopName.name,
            }}
            size={v.sizeForNames}
            ellipsis={ellipsisHeadsign}
            showSubNames={infoLevelFlag.isNormalEnabled}
            subNamesPosition="top"
          />
        </>
      )}
    </>
  ) : (
    <>
      <StackedDisplayNames
        names={headsignNames.resolved}
        size={v.sizeForNames}
        ellipsis={ellipsisHeadsign}
        showSubNames={infoLevelFlag.isNormalEnabled}
        subNamesPosition="top"
      />
    </>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {showRouteTypeIcon && (
        <span className={`shrink-0 ${v.emoji}`}>{routeTypeEmoji(route.route_type)}</span>
      )}
      <RouteBadge
        size={size}
        route={route}
        dataLang={dataLangs}
        agencyLangs={agencyLang}
        infoLevel={infoLevel}
        showBorder={true}
      />
      {infoLevelFlag.isDetailedEnabled && agency && showAgency && (
        <AgencyBadge
          size={size}
          agency={agency}
          dataLang={dataLangs}
          agencyLangs={agencyLang}
          infoLevel={infoLevel}
          showBorder={true}
        />
      )}

      {/* Headsign */}
      {headSignInfos}

      {attributes && (
        <TimetableEntryAttributesLabels
          size={ATTRIBUTES_LABELS_SIZE_BY_SIZE[size]}
          attributes={attributes}
          showDisplayLastStop={true}
          showDisplayFirstStop={true}
          showDisplayPickupUnavailable={true}
          showDisplayDropOffUnavailable={true}
        />
      )}
    </div>
  );
}
