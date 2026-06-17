import { useMemo } from 'react';

import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { getBearingDeg } from '@/domain/transit/distance';
import { getHeadsignDisplayNames } from '@/domain/transit/name-resolver/get-headsign-display-names';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import type {
  TransitDisplayDatum,
  TransitDisplayMeta,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import { buildTripInspectionTarget } from '@/domain/transit/trip-inspection-target';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { AgencyBadge } from '@/components/badge/agency-badge';
import { DistanceBadge } from '@/components/badge/distance-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import { TimetableEntryAttributesLabels } from '@/components/label/timetable-entry-attributes-labels';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { StopTimeTimeInfo } from '@/components/stop-time-time-info';
import { PlatformCodeLabel } from '@/components/stop/platform-code-label';

/**
 * Per-`size` style bundle for `TransitDisplayEntry`. Looked up via
 * {@link TRANSIT_DISPLAY_ENTRY_STYLE_BY_SIZE}.
 */
interface TransitDisplayEntrySizeStyle {
  /** Row-level layout. */
  row: {
    /** Text size utility class for the row (`text-*`). */
    textClass: string;
  };
  /** `TimetableEntryAttributesLabels` rendering. */
  attributesLabels: {
    /** `TimetableEntryAttributesLabels` size. */
    size: ExtendedDisplaySize;
  };
  /** Badges (RouteBadge / AgencyBadge / DistanceBadge / PlatformCodeLabel) downscaled together. */
  badge: {
    /** Shared size for the entry's badges. */
    size: ExtendedDisplaySize;
  };
}

const TRANSIT_DISPLAY_ENTRY_STYLE_BY_SIZE: Record<
  ExtendedDisplaySize,
  TransitDisplayEntrySizeStyle
> = {
  xs: {
    row: { textClass: 'text-[10px]' },
    attributesLabels: { size: 'xs' },
    badge: { size: 'xs' },
  },
  sm: {
    row: { textClass: 'text-xs' },
    attributesLabels: { size: 'xs' },
    badge: { size: 'xs' },
  },
  md: {
    row: { textClass: 'text-xs' },
    attributesLabels: { size: 'xs' },
    badge: { size: 'sm' },
  },
  lg: {
    row: { textClass: 'text-xl' },
    attributesLabels: { size: 'sm' },
    badge: { size: 'md' },
  },
  xl: {
    row: { textClass: 'text-2xl' },
    attributesLabels: { size: 'md' },
    badge: { size: 'lg' },
  },
};

export interface TransitDisplayEntryProps {
  data: TransitDisplayDatum;
  meta: TransitDisplayMeta;
  dataLangs: readonly string[];
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display size; drives the row text size. */
  size: ExtendedDisplaySize;
  /**
   * Whether the board mixes route types (its `meta.routeTypes.length >= 2`). When
   * true, each row shows its trip's route-type emoji so mixed types can be told
   * apart; a single-type board does not need it.
   */
  // hasMultiRoutes: boolean;
  /** Maximum characters for headsign truncation. */
  headsignMaxLength?: number;
  showRouteBadge?: boolean;
  showAgencyBadge?: boolean;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry({
  data,
  meta,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  // hasMultiRoutes,
  headsignMaxLength: _headsignMaxLength,
  showRouteBadge = true,
  showAgencyBadge = true,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayEntryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);
  const style = TRANSIT_DISPLAY_ENTRY_STYLE_BY_SIZE[size];

  const { stop: stopWithContext, timetableEntry } = data;

  // Attribute / route color / headsign / stop name resolution depends only on the
  // row data and the display languages -- NOT on mapCenter or now. Memoize it so a
  // map drag (which re-renders the row to update `bearing`) does not re-run this
  // resolution while data / dataLangs are unchanged.
  const resolved = useMemo(() => {
    const { stop: swc, timetableEntry: entry } = data;
    const route = entry.routeDirection.route;
    const routeAgency = swc.agencies.find((agency) => agency.agency_id === route.agency_id);
    const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : DEFAULT_AGENCY_LANG;
    const { routeColor } = resolveRouteColors(route, 'css-hex');
    const headsign = getHeadsignDisplayNames(
      entry.routeDirection,
      dataLangs,
      routeAgencyLangs,
      'stop',
    ).resolved.name;
    const stopAgencyLangs = swc.agencies.map((agency) => agency.agency_lang);
    const stopName = getStopDisplayNames(swc.stop, dataLangs, stopAgencyLangs).name;
    // Distance is baked on the row (query-time), so it is data, not mapCenter.
    const distanceRounded = swc.distance != null ? Math.round(swc.distance) : null;
    // Inspection target for the time tap. The classic view gets this prebuilt by
    // buildTransitDisplayDatumForUi; this view keeps rows raw, so build it here so
    // StopTimeTimeInfo renders as an inspection button (it stays a plain div when
    // inspectTarget is missing).
    const inspectTarget = buildTripInspectionTarget(entry, entry.serviceDate);
    return {
      routeAgency,
      routeAgencyLangs,
      routeColor,
      headsign,
      // stopAgencyLangs,
      stopName,
      distanceRounded,
      inspectTarget,
    };
  }, [data, dataLangs]);
  const {
    routeAgency,
    routeAgencyLangs,
    routeColor,
    headsign,
    // stopAgencyLangs,
    stopName,
    distanceRounded,
    inspectTarget,
  } = resolved;

  // Bearing is computed live from the current map center so the direction arrow
  // tracks panning (like StopInfo); it stays outside the memo.
  const bearing = mapCenter ? getBearingDeg(mapCenter, stopWithContext.stop) : null;

  return (
    // No `data-stop-id` here: the same stop id can appear in several rows across
    // boards, so it cannot identify a single row -- and the stop browser skips its
    // scroll-to-selected effect for this view anyway.
    <li
      className={cn(
        'flex items-stretch overflow-hidden',
        'cursor-pointer',
        'hover:bg-info/10',
        'my-0.5',
        style.row.textClass,
        // 'bg-yellow-200',
      )}
      onClick={() => onStopSelected(stopWithContext.stop.stop_id)}
    >
      {/* Route color head bar */}
      <svg
        aria-hidden
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="w-2 shrink-0 self-stretch"
      >
        <rect x="0" y="0" width="1" height="1" fill={routeColor} />
      </svg>

      {/* Trip info / 3 columns: Time, Route, Stop */}
      {/* 1st columns: Time */}
      <div className="flex flex-0 border-0 pt-0 pl-1">
        {/* Local TimeInfo: shows timeText; tap selects the stop + opens inspection. */}
        <StopTimeTimeInfo
          arrivalMinutes={timetableEntry.schedule.arrivalMinutes}
          departureMinutes={timetableEntry.schedule.departureMinutes}
          serviceDate={timetableEntry.serviceDate}
          now={now}
          size={size}
          align="right"
          showArrivalTime={meta.category === 'arrivals'}
          showDepartureTime={meta.category === 'departures'}
          collapseToleranceMinutes={null}
          // forceShowRelativeTime={true}
          forceShowRelativeTime={false}
          textAppearance={
            {
              // color: routeColor,
            }
          }
          inspectTarget={inspectTarget}
          stopId={stopWithContext.stop.stop_id}
          onSelectStopById={onStopSelected}
          onInspectTrip={onInspectTrip}
        />
      </div>

      {/* 2nd column (2 rows) */}
      <div className="flex flex-2 flex-col justify-center gap-1 border-0 py-0.5 pl-4">
        {/* 1st row: Route info (Route name, Headsign, ...) */}
        <div className="flex items-center gap-2">
          {showRouteBadge && (
            <RouteBadge
              route={timetableEntry.routeDirection.route}
              dataLang={dataLangs}
              agencyLangs={routeAgencyLangs}
              infoLevel={infoLevel}
              size={style.badge.size}
              showBorder={true}
            />
          )}
          <TimetableEntryAttributesLabels
            size={style.attributesLabels.size}
            attributes={getTimetableEntryAttributes(timetableEntry)}
            showDisplayLastStop={true}
            showDisplayFirstStop={true}
            showDisplayPickupUnavailable={infoLevelFlag.isVerboseEnabled}
            showDisplayDropOffUnavailable={infoLevelFlag.isVerboseEnabled}
          />
        </div>
        {/* 2nd row: Headsign (destination) */}
        <div className="">{headsign}</div>
      </div>

      {/* 3rd column: 2 rows - Route agency / Stop */}
      <div className="py-0.5pr-2 flex flex-1 flex-col justify-center gap-1 border-0 pl-2">
        {/* 1st row: Route agency */}
        <div className="flex items-center gap-2">
          {/* Agency name */}
          {showAgencyBadge && routeAgency && (
            <AgencyBadge
              agency={routeAgency}
              size={style.badge.size}
              infoLevel={infoLevel}
              dataLang={dataLangs}
              showBorder={true}
            />
          )}
          {/* Distance + direction to the stop (same DistanceBadge as StopInfo). */}
          {infoLevelFlag.isVerboseEnabled && distanceRounded != null && distanceRounded >= 10 && (
            <DistanceBadge
              meters={distanceRounded}
              bearingDeg={bearing}
              size={style.badge.size}
              showDirection
            />
          )}
        </div>
        {/* 2nd row: Stop */}
        <div className="">
          <span className="block min-w-0 leading-tight wrap-break-word whitespace-normal">
            {stopName}
            {stopWithContext.stop.platform_code !== undefined && (
              <PlatformCodeLabel
                className="ml-1 inline-block align-[0.15em]"
                code={stopWithContext.stop.platform_code}
                size={style.badge.size}
              />
            )}
          </span>
        </div>
      </div>

      {/* Right edge: agency color bar, mirroring the left route-color bar. */}
      {/* <svg
        aria-hidden
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="w-1 shrink-0 self-stretch"
      >
        <rect x="0" y="0" width="1" height="1" fill={agencyColor} />
      </svg> */}
    </li>
  );
}
