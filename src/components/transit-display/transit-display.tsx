import { Fragment, useMemo } from 'react';

import {
  ArrowRight,
  ArrowUp,
  Building2,
  Clock,
  Radio,
  Route as RouteIcon,
  Signpost,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { IconTextBadge } from '@/components/badge/icon-text-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Separator } from '@/components/ui/separator';
import { computeTransitDisplayDatumStats } from '@/domain/transit/compute-transit-display-datum-stats';
import { formatDateKey } from '@/domain/transit/calendar-utils';
import type { TransitDisplayDataWithMetaData } from '@/domain/transit/transit-info-display/build-transit-display-data';
import { useInfoLevel } from '@/hooks/use-info-level';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

import { TransitDisplayEntry } from './transit-display-entry';

const BOARD_PANEL_BG = 'bg-[#f5f7fa] dark:bg-gray-800';

/**
 * Styling for one header IconTextBadge: the component `size` (padding / base
 * scale) plus class overrides for the text half and the icon svg (to scale
 * beyond the component's built-in presets, which cap at ~14px).
 */
interface HeaderBadgeStyle {
  size: ExtendedDisplaySize;
  textClass: string;
  iconClass: string;
}

/**
 * Per-`size` style bundle for `TransitDisplay`. Looked up via
 * {@link TRANSIT_DISPLAY_STYLE_BY_SIZE}.
 */
interface TransitDisplaySizeStyle {
  /** Board title (left side of the header band). */
  title: {
    /**
     * Text utility class one step larger than the rows so the title reads
     * above the data.
     */
    textClass: string;
    /**
     * Icon size utility class tracking `title.textClass`. A `size-*` class
     * (not the lucide `size` prop) is required so the icon overrides the
     * ui/button base rule `[&_svg:not([class*='size-'])]:size-4`.
     */
    iconClass: string;
  };
  /**
   * Header badges (`StatsBadges` small variant and the radius `large` variant).
   * Drives both the IconTextBadge component size and class overrides for the
   * text / icon svg.
   */
  headerStatsIcons: {
    /** Four stats badges in `StatsBadges`. */
    small: HeaderBadgeStyle;
    /** Radius badge in the header. */
    large: HeaderBadgeStyle;
  };
}

const TRANSIT_DISPLAY_STYLE_BY_SIZE: Record<ExtendedDisplaySize, TransitDisplaySizeStyle> = {
  xs: {
    title: { textClass: 'text-[10px]', iconClass: 'size-2.5' },
    headerStatsIcons: {
      small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
      large: { size: 'xs', textClass: 'text-[10px]', iconClass: '[&>svg]:size-2.5' },
    },
  },
  sm: {
    title: { textClass: 'text-xs', iconClass: 'size-3' },
    headerStatsIcons: {
      small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
      large: { size: 'xs', textClass: 'text-[10px]', iconClass: '[&>svg]:size-2.5' },
    },
  },
  md: {
    title: { textClass: 'text-base', iconClass: 'size-4' },
    headerStatsIcons: {
      small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
      large: { size: 'xs', textClass: 'text-xs', iconClass: '[&>svg]:size-3' },
    },
  },
  lg: {
    title: { textClass: 'text-2xl', iconClass: 'size-9' },
    headerStatsIcons: {
      small: { size: 'sm', textClass: 'text-base', iconClass: '[&>svg]:size-4' },
      large: { size: 'sm', textClass: 'text-xl', iconClass: '[&>svg]:size-5' },
    },
  },
  xl: {
    title: { textClass: 'text-4xl', iconClass: 'size-15' },
    headerStatsIcons: {
      small: { size: 'md', textClass: 'text-2xl', iconClass: '[&>svg]:size-6' },
      large: { size: 'md', textClass: 'text-3xl', iconClass: '[&>svg]:size-8' },
    },
  },
};

export interface TransitDisplayProps {
  transitDisplayDataWithMetaData: TransitDisplayDataWithMetaData;
  dataLangs: readonly string[];
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Badge row that renders a stats scope as icon badges. Icon choices follow the
 * data-source group summary convention: Signpost = stops, Route = routes,
 * Building2 = agencies, Shapes = route types, Clock = entries. `entryCount` is
 * omitted for the stop-set scope (which has no entry count).
 */
function StatsBadges({
  size,
  entryCount,
  stopCount,
  routeCount,
  agencyCount,
}: {
  size: ExtendedDisplaySize;
  entryCount?: number;
  stopCount: number;
  routeCount: number;
  agencyCount: number;
}) {
  const style = TRANSIT_DISPLAY_STYLE_BY_SIZE[size];
  const { size: badgeSize, textClass, iconClass } = style.headerStatsIcons.small;

  return (
    <div className="flex flex-col items-end gap-0.5 border-0">
      {/* Row 1: entries (optional) + stops. */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {entryCount !== undefined && (
          <IconTextBadge
            size={badgeSize}
            icon={<Clock />}
            text={`${entryCount.toLocaleString(i18n.language)}`}
            textClassName={textClass}
            iconClassName={iconClass}
            aria-label="entries"
          />
        )}
        <IconTextBadge
          size={badgeSize}
          icon={<Signpost />}
          text={`${stopCount.toLocaleString(i18n.language)}`}
          textClassName={textClass}
          iconClassName={iconClass}
          aria-label="stops"
        />
      </div>
      {/* Row 2: routes + agencies. */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        <IconTextBadge
          size={badgeSize}
          icon={<RouteIcon />}
          text={`${routeCount.toLocaleString(i18n.language)}`}
          textClassName={textClass}
          iconClassName={iconClass}
          aria-label="routes"
        />
        <IconTextBadge
          size={badgeSize}
          icon={<Building2 />}
          text={`${agencyCount.toLocaleString(i18n.language)}`}
          textClassName={textClass}
          iconClassName={iconClass}
          aria-label="agencies"
        />
      </div>
    </div>
  );
}

/**
 * One transit board: a single departure or arrival display.
 *
 * Design basis: Athenai's modern, theme-aware design language (the classic
 * split-flap view carries the legacy look instead). The board is a
 * theme-aware panel with a soft rounded border.
 *
 * Layout: a header band (title on the left, radius on the right) above the rows,
 * or an empty fallback when the board has no entries.
 */
export function TransitDisplay({
  transitDisplayDataWithMetaData,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayProps) {
  const { meta, data: transitDisplayData, stats } = transitDisplayDataWithMetaData;

  const infoLevelFlag = useInfoLevel(infoLevel);
  const { t } = useTranslation();
  const style = TRANSIT_DISPLAY_STYLE_BY_SIZE[size];

  // Board title: mode emoji + departures/arrivals phrase. The
  // route type and basis are structured meta; the UI composes the localized text.
  // The board's title carries the departure/arrival distinction, so rows do not
  // repeat it: each row shows a single time (the board's basis) without a label.
  const isArrivalBoard = meta.category === 'arrivals';

  const routeTypeIcon = routeTypesEmoji(meta.routeTypes);
  const title = t(isArrivalBoard ? 'transitDisplay2.arrivals' : 'transitDisplay2.departures');

  // Displayed (post-cap) stats are derivable from the rendered rows, so the
  // component computes them here rather than carrying them on `stats`. Memoized on
  // the rows: it depends only on the board data, not on mapCenter / now, so a map
  // drag does not recompute it.
  const displayedStats = useMemo(
    () => computeTransitDisplayDatumStats(transitDisplayData.data),
    [transitDisplayData.data],
  );

  // Routes shown in the header band, ordered by route_id alphabetical so the
  // badge order is stable across renders and matches sortTransitDisplayDataWithMetaData.
  const sortedRoutes = useMemo(
    () => [...meta.routes].sort((a, b) => a.route_id.localeCompare(b.route_id)),
    [meta.routes],
  );

  const hasMultiRoutes = meta.routes.length >= 2;

  return (
    // Each board is a theme-aware panel with a soft rounded border; stacked
    // boards are separated by their own surface and margin.
    <section
      className={cn(
        //
        'overflow-hidden',
        'rounded-sm border-0',
        BOARD_PANEL_BG,
      )}
    >
      {/* Board meta in brief: category, route type(s), direction(s), row cap, radius. */}
      {infoLevelFlag.isVerboseEnabled && (
        <div className="flex flex-col items-end gap-0.5 text-[8px]">
          <p className="m-0 w-full min-w-0 text-right">
            [{meta.category} / rt {meta.routeTypes.join(',')} / r {meta.routes.length} / dir{' '}
            {meta.directions.join(',')} / (max:
            {meta.selection.maxEntries}/{meta.selection.radiusMeters}m)]
          </p>
          <p className="m-0 w-full min-w-0 text-right">
            [shown:
            {displayedStats.entryCount} entries / {displayedStats.routeTypeCount} types /{' '}
            {displayedStats.agencyCount} agencies / {displayedStats.routeCount} routes /{' '}
            {displayedStats.stopCount} stops ]
          </p>
        </div>
      )}
      {/* Header band: title left, radius right, on a single line, on the board's
          theme-aware panel face. */}
      <div className={cn('flex flex-col gap-1', 'py-1 pr-2 pl-4')}>
        <div className="flex items-center justify-between gap-3 border-0">
          {/* Left side:  Title -- board basis arrow (up = departures, right = arrivals) + mode + phrase. */}
          <h3
            className={cn(
              'flex min-w-0 items-center gap-2 font-bold tracking-[0.18em] uppercase',
              style.title.textClass,
            )}
          >
            {isArrivalBoard ? (
              <ArrowRight
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', style.title.iconClass)}
              />
            ) : (
              <ArrowUp
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', style.title.iconClass)}
              />
            )}
            {routeTypeIcon}
            <span className="truncate">{title}</span>
          </h3>

          {/* Right side: stats badges + radius, grouped and right-aligned. */}
          <div className="flex shrink-0 items-center gap-1">
            <IconTextBadge
              size={style.headerStatsIcons.large.size}
              icon={<Radio />}
              text={`${meta.selection.radiusMeters.toLocaleString(i18n.language)}m`}
              textClassName={style.headerStatsIcons.large.textClass}
              iconClassName={style.headerStatsIcons.large.iconClass}
              frameClassName="p-1 border-none"
              aria-label="radius"
            />
            {infoLevelFlag.isNormalEnabled && (
              <StatsBadges
                size={size}
                entryCount={stats.qualifying.entryCount}
                stopCount={stats.qualifying.stopCount}
                routeCount={stats.qualifying.routeCount}
                agencyCount={stats.qualifying.agencyCount}
              />
            )}
          </div>
        </div>

        {/* Routes (show only multiple routes) */}
        {hasMultiRoutes && infoLevelFlag.isDetailedEnabled && (
          <div className="flex flex-wrap items-center gap-1">
            {sortedRoutes.map((route) => {
              // Find the agency that runs this route. board scope may span multiple
              // stops, so flatten all agencies present and match by agency_id.
              const agency = transitDisplayData.data
                .flatMap((c) => c.stop.agencies)
                .find((a) => a.agency_id === route.agency_id);
              const agencyLangs = agency ? [agency.agency_lang] : undefined;
              return (
                <RouteBadge
                  route={route}
                  dataLang={dataLangs}
                  agencyLangs={agencyLangs}
                  infoLevel={infoLevel}
                  size={style.headerStatsIcons.large.size}
                  showBorder={true}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Body: the rows (or the empty fallback). */}
      <div
        className={cn(
          'p-0',
          //
          // BOARD_PANEL_BG,
          // 'bg-transparent',
        )}
      >
        <ul className="m-0 list-none p-0">
          {transitDisplayData.data.map((row) => {
            const { timetableEntry, stop: stopWithContext } = row;
            const key = JSON.stringify([
              stopWithContext.stop.stop_id,
              formatDateKey(timetableEntry.serviceDate),
              timetableEntry.tripLocator.patternId,
              timetableEntry.tripLocator.serviceId,
              timetableEntry.tripLocator.tripIndex,
              timetableEntry.patternPosition.stopIndex,
            ]);
            return (
              <Fragment key={key}>
                <Separator orientation="horizontal" className="mx-4 h-2" />
                <TransitDisplayEntry
                  data={row}
                  meta={meta}
                  dataLangs={dataLangs}
                  now={now}
                  mapCenter={mapCenter}
                  infoLevel={infoLevel}
                  size={size}
                  // showRouteBadge={hasMultiRoutes}
                  // showAgencyBadge={hasMultiRoutes}
                  onStopSelected={onStopSelected}
                  onInspectTrip={onInspectTrip}
                />
              </Fragment>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
