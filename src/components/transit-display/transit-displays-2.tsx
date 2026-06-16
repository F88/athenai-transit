import { Fragment, useMemo, useState } from 'react';

import { ArrowRight, ArrowUp, Building2, Clock, Radio, Route, Signpost } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { DistanceBadge } from '@/components/badge/distance-badge';
import { IconTextBadge } from '@/components/badge/icon-text-badge';
import { TimetableEntryAttributesLabels } from '@/components/label/timetable-entry-attributes-labels';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import {
  type TransitDisplayCategory,
  type TransitDisplayDataWithMetaData,
  type TransitDisplayDatum,
  type TransitDisplayMeta,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import {
  hasMultipleRoutes,
  type TransitDisplayStatus,
} from '@/domain/transit/transit-info-display/transit-display-ui';
import { computeTransitDisplayDatumStats } from '@/domain/transit/compute-transit-display-datum-stats';
import { getBearingDeg } from '@/domain/transit/distance';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';
import { formatDateKey } from '@/domain/transit/calendar-utils';
import { getTimetableEntryAttributes } from '@/domain/transit/timetable-entry-attributes';
import { buildTripInspectionTarget } from '@/domain/transit/trip-inspection-target';
import { getHeadsignDisplayNames } from '@/domain/transit/name-resolver/get-headsign-display-names';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import { RouteBadge } from '../badge/route-badge';
import { AgencyBadge } from '../badge/agency-badge';
import { StopTimeTimeInfo } from '../stop-time-time-info';
import {
  TransitDisplayPerRoute,
  type TransitDisplayRouteGroup,
} from './transit-display-per-route';
import { Separator } from '../ui/separator';
import { PlatformCodeLabel } from '../stop/platform-code-label';
import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import i18n from '@/i18n';

const BOARD_PANEL_BG = 'bg-[#f5f7fa] dark:bg-gray-800';

/**
 * Title text size per display size, one step larger than the rows so headings
 * (the board title and the filter toggles) read above the data rows.
 */
const TITLE_TEXT_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

/**
 * Title icon size class per display size; tracks {@link TITLE_TEXT_CLASS_BY_SIZE}.
 * A `size-*` class (not the lucide `size` prop) is required so the icon overrides
 * the ui/button base rule `[&_svg:not([class*='size-'])]:size-4`, which otherwise
 * pins button icons to 16px regardless of the prop.
 */
const TITLE_ICON_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'size-2.5', // 10px
  sm: 'size-3', // 12px
  md: 'size-4', // 16px
  lg: 'size-9', // 36px
  xl: 'size-15', // 60px
};

/** Row text size per display size; the larger the container, the larger the rows. */
const ROW_TEXT_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-xl',
  xl: 'text-2xl',
};

const TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE: Record<
  ExtendedDisplaySize,
  ExtendedDisplaySize
> = {
  xs: 'xs',
  sm: 'xs',
  md: 'xs',
  lg: 'sm',
  xl: 'md',
};

const DISTANCE_BADGE_SIZE_BY_SIZE: Record<ExtendedDisplaySize, ExtendedDisplaySize> = {
  xs: 'xs',
  sm: 'xs',
  md: 'sm',
  lg: 'md',
  xl: 'lg',
};

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
 * Header badge styling per display size, in two variants:
 * - `small`: the four stats badges ({@link StatsBadges}).
 * - `large`: the radius badge.
 *
 * `props.size` is the single input; consumers pick `small` / `large` internally.
 * Starting values -- tune here.
 */
const HEADER_STATS_ICONS_BY_SIZE: Record<
  ExtendedDisplaySize,
  { small: HeaderBadgeStyle; large: HeaderBadgeStyle }
> = {
  xs: {
    small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
    large: { size: 'xs', textClass: 'text-[10px]', iconClass: '[&>svg]:size-2.5' },
  },
  sm: {
    small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
    large: { size: 'xs', textClass: 'text-[10px]', iconClass: '[&>svg]:size-2.5' },
  },
  md: {
    small: { size: 'xs', textClass: 'text-[8px]', iconClass: '[&>svg]:size-2' },
    large: { size: 'xs', textClass: 'text-xs', iconClass: '[&>svg]:size-3' },
  },
  lg: {
    small: { size: 'sm', textClass: 'text-base', iconClass: '[&>svg]:size-4' },
    large: { size: 'sm', textClass: 'text-xl', iconClass: '[&>svg]:size-5' },
  },
  xl: {
    small: { size: 'md', textClass: 'text-2xl', iconClass: '[&>svg]:size-6' },
    large: { size: 'md', textClass: 'text-3xl', iconClass: '[&>svg]:size-8' },
  },
};

export interface TransitDisplays2Props {
  /** Raw displays (meta + unresolved board); rows are passed down and resolved at the leaf ({@link TransitDisplayEntry2}). */
  dataWithMeta: readonly TransitDisplayDataWithMetaData[];
  /** Build state + radius, for the empty-state message (no stops / no service). */
  status: TransitDisplayStatus;
  /** Display language chain forwarded down to the leaf ({@link TransitDisplayEntry2}) for name / color resolution. */
  dataLangs: readonly string[];
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Filter axis: which categories (departures / arrivals) the boards can be
 * narrowed to, in board order. The only filter axis for now -- route type and
 * direction are not user-selectable here.
 */
const FILTERABLE_CATEGORIES: readonly TransitDisplayCategory[] = ['departures', 'arrivals'];

/** Default category visibility: departures shown, arrivals hidden until toggled on. */
const DEFAULT_CATEGORIES: Record<TransitDisplayCategory, boolean> = {
  departures: true,
  arrivals: false,
};

/**
 * Renders each {@link TransitDisplayDataWithMetaData} as its own stacked board,
 * with a filter bar on top for choosing which categories (departures / arrivals)
 * to show. Unlike the classic view, rows are not pre-resolved via
 * buildTransitDisplayDatumForUi; the raw board and dataLangs are passed down and
 * resolved at the leaf ({@link TransitDisplayEntry2}). The filter is
 * presentation-only local state: it narrows the rendered displays, it does not
 * change how they are built or fetched.
 */
export function TransitDisplays2({
  dataWithMeta,
  status,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplays2Props) {
  const { t } = useTranslation();
  const [shownCategories, setShownCategories] =
    useState<Record<TransitDisplayCategory, boolean>>(DEFAULT_CATEGORIES);

  // No boards to show because the dataset itself is empty: either no stops within
  // the radius (`no-stops`) or stops exist but none have service today
  // (`no-service`). Show the reason instead of a blank view.
  if (status.state === 'no-stops' || status.state === 'no-service') {
    return (
      <div className="text-muted-foreground px-4 py-6 text-center text-sm">
        {t(status.state === 'no-service' ? 'transitDisplay2.noService' : 'transitDisplay2.empty', {
          radius: status.radius,
        })}
      </div>
    );
  }

  const presentCategories = FILTERABLE_CATEGORIES.filter((category) =>
    dataWithMeta.some((display) => display.meta.category === category),
  );

  const visibleData = dataWithMeta.filter((display) => shownCategories[display.meta.category]);

  // Group single-route boards by their route (collapses the cluster's dep / arr
  // boards for one route into a single TransitDisplayPerRoute card) and keep
  // multi-route boards as standalone TransitDisplay2 renders. Map-based
  // aggregation so we do not rely on sort-order continuity of same-route boards.
  type GroupedItem =
    | { kind: 'single'; group: TransitDisplayRouteGroup }
    | { kind: 'multi'; board: TransitDisplayDataWithMetaData };
  const singleBoardsByRouteId = new Map<string, TransitDisplayDataWithMetaData[]>();
  const groupedDisplays: GroupedItem[] = [];
  for (const d of visibleData) {
    if (hasMultipleRoutes(d)) {
      groupedDisplays.push({ kind: 'multi', board: d });
      continue;
    }
    const route = d.meta.routes[0];
    if (!route) {
      // No route metadata to group by; render as a standalone board.
      groupedDisplays.push({ kind: 'multi', board: d });
      continue;
    }
    let boards = singleBoardsByRouteId.get(route.route_id);
    if (!boards) {
      boards = [];
      singleBoardsByRouteId.set(route.route_id, boards);
      // Push once with the live boards reference; subsequent boards.push(d)
      // is visible through groupedDisplays as well.
      groupedDisplays.push({ kind: 'single', group: { route, data: boards } });
    }
    boards.push(d);
  }

  const toggleCategory = (category: TransitDisplayCategory) => {
    setShownCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div
      className={cn(
        // 'font-dotgothic16',
        'px-4',
      )}
    >
      {/* Filter */}
      <div
        className={cn(
          //
          'px-0',
        )}
      >
        {presentCategories.length > 0 && (
          <TransitDisplayCategoryFilter
            categories={presentCategories}
            shownCategories={shownCategories}
            size={size}
            onToggleCategory={toggleCategory}
          />
        )}
      </div>

      {/* Panels */}
      <div
        className={cn(
          //
          // 'font-dotgothic16',
          'space-y-4',
          // 'px-0',
        )}
      >
        {groupedDisplays.map((item, index) => {
          if (item.kind === 'single') {
            return (
              <TransitDisplayPerRoute
                key={`single__${item.group.route.route_id}__${index}`}
                group={item.group}
                dataLangs={dataLangs}
                now={now}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            );
          }
          // Multi-route board: rendered standalone with the existing TransitDisplay2.
          // Key combines board identity (category + route types) with the map
          // index, since a `custom` route grouping can collapse two groups to
          // the same present route types.
          const board = item.board;
          return (
            <TransitDisplay2
              key={`multi__${board.meta.category}__${board.meta.routeTypes.join('-')}__${index}`}
              transitDisplayDataWithMetaData={board}
              dataLangs={dataLangs}
              now={now}
              mapCenter={mapCenter}
              infoLevel={infoLevel}
              size={size}
              onStopSelected={onStopSelected}
              onInspectTrip={onInspectTrip}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Filter toggle button box metrics (border width + padding) per display size, so
 * the frame and inset scale with the size-scaled label. The buttons always
 * contain an arrow svg, so horizontal padding uses `has-[>svg]:px-*` to override
 * the ui/button size variant's own `has-[>svg]:px-3`; `py-*` sets the height feel.
 * Border color is applied separately (the shown / hidden state classes).
 */
const FILTER_BUTTON_BOX_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'border has-[>svg]:px-1 py-0',
  sm: 'border-2 has-[>svg]:px-1.5 py-0',
  md: 'border-4 has-[>svg]:px-2 py-0',
  lg: 'border-6 has-[>svg]:px-4 py-0',
  xl: 'border-8 has-[>svg]:px-8 py-0',
};

const FILTER_BUTTON_BASE_CLASS =
  'h-auto min-w-0 grow basis-0 rounded-sm font-bold tracking-[0.18em] uppercase hover:bg-info/20';

const FILTER_BUTTON_SHOWN_CLASS = cn(
  BOARD_PANEL_BG,
  'border-neutral-600 text-neutral-700 hover:text-neutral-900 dark:border-neutral-300 dark:text-neutral-200 dark:hover:text-neutral-100',
);
const FILTER_BUTTON_HIDDEN_CLASS = cn(
  BOARD_PANEL_BG,
  'border-neutral-300 text-neutral-400 hover:text-neutral-600 dark:border-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300',
);

const FILTER_BOX_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'py-2 px-3 gap-2',
  sm: 'py-2 px-3 gap-2.5',
  md: 'py-2 px-3 gap-3',
  lg: 'py-3 px-8 gap-8',
  xl: 'py-4 px-12 gap-12',
};

interface TransitDisplayCategoryFilterProps {
  /** Categories that have a board, in board order; one toggle is rendered per entry. */
  categories: readonly TransitDisplayCategory[];
  /** Current shown / hidden state per category. */
  shownCategories: Record<TransitDisplayCategory, boolean>;
  /** Display size; scales the toggle label text like the board rows. */
  size: ExtendedDisplaySize;
  onToggleCategory: (category: TransitDisplayCategory) => void;
}

/**
 * Filter bar: one toggle per category, styled to match the boards (same
 * theme-aware panel face) rather than the generic chip filter. A prominent
 * toggle means the category is shown; a dimmed one means it is hidden.
 */
function TransitDisplayCategoryFilter({
  categories,
  shownCategories,
  size,
  onToggleCategory,
}: TransitDisplayCategoryFilterProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('transitDisplay2.filter.label')}
      className={cn(
        'mb-2 flex items-center rounded-sm',
        'border-0',
        FILTER_BOX_SIZE[size],
        // BOARD_FRAME_COLOR,
        // BOARD_PANEL_BG,
      )}
    >
      {categories.map((category) => {
        const isShown = shownCategories[category];
        const isArrival = category === 'arrivals';
        return (
          // Shared ui/button (ghost) reused for structure and focus handling,
          // restyled to the board palette: a prominent toggle means the category
          // is shown, a dimmed one means it is hidden.
          <Button
            key={category}
            variant="ghost"
            size="default"
            onClick={() => onToggleCategory(category)}
            className={cn(
              FILTER_BUTTON_BASE_CLASS,
              FILTER_BUTTON_BOX_BY_SIZE[size],
              TITLE_TEXT_CLASS_BY_SIZE[size],
              isShown ? FILTER_BUTTON_SHOWN_CLASS : FILTER_BUTTON_HIDDEN_CLASS,
            )}
          >
            {isArrival ? (
              <ArrowRight
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            ) : (
              <ArrowUp
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            )}
            <span className="truncate">
              {t(
                isArrival ? 'transitDisplay2.filter.arrivals' : 'transitDisplay2.filter.departures',
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export interface TransitDisplay2Props {
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
  const { size: badgeSize, textClass, iconClass } = HEADER_STATS_ICONS_BY_SIZE[size].small;

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
          icon={<Route />}
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
 * `transit-display` view carries the split-flap look instead). The board is a
 * theme-aware panel with a soft rounded border.
 *
 * Layout: a header band (title on the left, radius on the right) above the rows,
 * or an empty fallback when the board has no entries.
 */
export function TransitDisplay2({
  transitDisplayDataWithMetaData,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplay2Props) {
  const { meta, data: transitDisplayData, stats } = transitDisplayDataWithMetaData;

  const infoLevelFlag = useInfoLevel(infoLevel);
  const { t } = useTranslation();

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
  // const sortedRoutes = meta.routes; // Keep original order.

  const hasMultiRoutes = meta.routes.length >= 2;

  // A board that mixes route types: rows then show their own trip route-type emoji.
  // const hasMultiRoutes = meta.routeTypes.length >= 2;
  return (
    // Each board is a theme-aware panel with a soft rounded border; stacked
    // boards are separated by their own surface and margin.
    <section
      className={cn(
        'overflow-hidden',
        'rounded-sm border-0',
        BOARD_PANEL_BG,
        // BOARD_FRAME_COLOR,
      )}
    >
      {/* Board meta in brief: category, route type(s), direction(s), row cap, radius. */}
      {infoLevelFlag.isVerboseEnabled && (
        <div className="flex flex-col items-end gap-0.5 text-[8px]">
          <p className="m-0 w-full min-w-0 text-right">
            [{meta.category} / rt {meta.routeTypes.join(',')} / r {meta.routes.length} / dir{' '}
            {meta.directions.join(',')} / (max:
            {meta.max}/{meta.radius}m)]
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
      <div
        className={cn(
          'flex flex-col gap-1',
          // 'mb-2',
          'py-1 pr-2 pl-4',
          // 'rounded border',
          // BOARD_PANEL_BG,
          // BOARD_PANEL_BG,
          // BOARD_FRAME_COLOR,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-0">
          {/* Left side:  Title — board basis arrow (up = departures, right = arrivals) + mode + phrase.
              The arrow is decorative; the phrase already states departures/arrivals. */}
          <h3
            className={cn(
              'flex min-w-0 items-center gap-2 font-bold tracking-[0.18em] uppercase',
              TITLE_TEXT_CLASS_BY_SIZE[size],
            )}
          >
            {isArrivalBoard ? (
              <ArrowRight
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            ) : (
              <ArrowUp
                strokeWidth={4}
                aria-hidden
                className={cn('shrink-0', TITLE_ICON_CLASS_BY_SIZE[size])}
              />
            )}
            {routeTypeIcon}
            <span className="truncate">{title}</span>

            {/* Routes (show when only a single route) */}
            {/* {!hasMultiRoutes && (
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
                      size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
                      // size={HEADER_STATS_ICONS_BY_SIZE[size].large.size}
                      showBorder={true}
                    />
                  );
                })}
              </div>
            )} */}
          </h3>

          {/* Right side: stats badges + radius, grouped and right-aligned. */}
          <div className="flex shrink-0 items-center gap-1">
            <IconTextBadge
              size={HEADER_STATS_ICONS_BY_SIZE[size].large.size}
              icon={<Radio />}
              text={`${meta.radius.toLocaleString(i18n.language)}m`}
              textClassName={HEADER_STATS_ICONS_BY_SIZE[size].large.textClass}
              iconClassName={HEADER_STATS_ICONS_BY_SIZE[size].large.iconClass}
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
                  // size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
                  size={HEADER_STATS_ICONS_BY_SIZE[size].large.size}
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
          // 'border',
          BOARD_PANEL_BG,
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
                <TransitDisplayEntry2
                  data={row}
                  meta={meta}
                  dataLangs={dataLangs}
                  now={now}
                  mapCenter={mapCenter}
                  infoLevel={infoLevel}
                  size={size}
                  // hasMultiRoutes={hasMultiRoutes}
                  // headsignMaxLength={20}
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

export interface TransitDisplay2EntryProps {
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
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry2({
  data,
  meta,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  // hasMultiRoutes,
  headsignMaxLength: _headsignMaxLength,
  onStopSelected,
  onInspectTrip,
}: TransitDisplay2EntryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

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
        'my-0.5 px-0 pt-0 pb-0',
        ROW_TEXT_CLASS_BY_SIZE[size],
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
      <div className="flex-2 border-0 pt-1 pl-4">
        {/* 1st row: Route info (Route name, Headsign, ...) */}
        <div className="flex items-center gap-2">
          <RouteBadge
            route={timetableEntry.routeDirection.route}
            dataLang={dataLangs}
            agencyLangs={routeAgencyLangs}
            infoLevel={infoLevel}
            size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
            showBorder={true}
          />
          <TimetableEntryAttributesLabels
            size={TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE[size]}
            attributes={getTimetableEntryAttributes(timetableEntry)}
            showDisplayLastStop={true}
            showDisplayFirstStop={true}
            showDisplayPickupUnavailable={infoLevelFlag.isVerboseEnabled}
            showDisplayDropOffUnavailable={infoLevelFlag.isVerboseEnabled}
          />
        </div>
        {/* 2nd row: Headsign (destination) */}
        <div className="border-0 pt-1">{headsign}</div>
      </div>

      {/* 3rd column: 2 rows - Route agency / Stop */}
      <div className="flex-1 border-0 px-2 pt-1">
        {/* 1st row: Route agency */}
        <div className="flex items-center gap-2 border-0 px-0 py-0">
          {/* Agency name */}
          {routeAgency && (
            <AgencyBadge
              //
              agency={routeAgency}
              size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
              // size={'xs'}
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
              size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
              showDirection
            />
          )}
        </div>
        {/* 2nd row: Stop */}
        <div className="border-0 pt-1">
          <span className="block min-w-0 leading-tight wrap-break-word whitespace-normal">
            {stopName}
            {stopWithContext.stop.platform_code !== undefined && (
              <PlatformCodeLabel
                className="ml-1 inline-block align-[0.15em]"
                code={stopWithContext.stop.platform_code}
                size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
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
