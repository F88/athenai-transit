import { useMemo, useState } from 'react';

import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { Agency, Route } from '@/types/app/transit';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import {
  type TransitDisplayCategory,
  type TransitDisplayDataWithMetaData,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import {
  hasMultipleRoutes,
  type TransitDisplayStatus,
} from '@/domain/transit/transit-info-display/transit-display-ui';
import type { InfoLevel } from '@/types/app/settings';
import { cn } from '@/lib/utils';
import { RouteFilter } from '@/components/filter/route-filter';
import { TransitDisplay } from './transit-display';
import { TransitDisplayPerRoute, type TransitDisplayRouteGroup } from './transit-display-per-route';

const BOARD_PANEL_BG = 'bg-[#f5f7fa] dark:bg-gray-800';

/**
 * Per-`size` style bundle for `TransitDisplayDashboard`. Looked up via
 * {@link TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE}.
 */
interface TransitDisplayDashboardSizeStyle {
  /** Section title (also used by the filter toggles). */
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
  /** One filter toggle button (the `departures` / `arrivals` chip). */
  filterButton: {
    /**
     * Border / padding utility classes. `has-[>svg]:px-*` overrides the
     * ui/button size variant's `has-[>svg]:px-3` so the inset scales with the
     * size-scaled label.
     */
    boxClass: string;
  };
  /** Outer filter row that holds the filter toggle buttons. */
  filterBox: {
    /** Padding + gap utility classes for the row. */
    boxClass: string;
  };
}

const TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE: Record<
  ExtendedDisplaySize,
  TransitDisplayDashboardSizeStyle
> = {
  xs: {
    title: { textClass: 'text-[10px]', iconClass: 'size-2.5' },
    filterButton: { boxClass: 'border has-[>svg]:px-1 py-0' },
    filterBox: { boxClass: 'py-2 px-3 gap-2' },
  },
  sm: {
    title: { textClass: 'text-xs', iconClass: 'size-3' },
    filterButton: { boxClass: 'border-2 has-[>svg]:px-1.5 py-0' },
    filterBox: { boxClass: 'py-2 px-3 gap-2.5' },
  },
  md: {
    title: { textClass: 'text-base', iconClass: 'size-4' },
    filterButton: { boxClass: 'border-4 has-[>svg]:px-2 py-0' },
    filterBox: { boxClass: 'py-2 px-3 gap-3' },
  },
  lg: {
    title: { textClass: 'text-2xl', iconClass: 'size-9' },
    filterButton: { boxClass: 'border-6 has-[>svg]:px-4 py-0' },
    filterBox: { boxClass: 'py-3 px-8 gap-8' },
  },
  xl: {
    title: { textClass: 'text-4xl', iconClass: 'size-15' },
    filterButton: { boxClass: 'border-8 has-[>svg]:px-8 py-0' },
    filterBox: { boxClass: 'py-4 px-12 gap-12' },
  },
};

export interface TransitDisplayDashboardProps {
  /** Raw displays (meta + unresolved board); rows are passed down and resolved at the leaf ({@link TransitDisplayEntry}). */
  dataWithMeta: readonly TransitDisplayDataWithMetaData[];
  /** Build state + radius, for the empty-state message (no stops / no service). */
  status: TransitDisplayStatus;
  /** Display language chain forwarded down to the leaf ({@link TransitDisplayEntry}) for name / color resolution. */
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
 * resolved at the leaf ({@link TransitDisplayEntry}). The filter is
 * presentation-only local state: it narrows the rendered displays, it does not
 * change how they are built or fetched.
 */
export function TransitDisplayDashboard({
  dataWithMeta,
  status,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayDashboardProps) {
  const { t } = useTranslation();
  const [shownCategories, setShownCategories] =
    useState<Record<TransitDisplayCategory, boolean>>(DEFAULT_CATEGORIES);
  const [activeRouteFilters, setActiveRouteFilters] = useState<Set<string>>(new Set());

  const toggleRouteFilter = (routeId: string) => {
    setActiveRouteFilters((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  // Boards passing the category filter.
  const categoryFilteredData = useMemo(
    () => dataWithMeta.filter((display) => shownCategories[display.meta.category]),
    [dataWithMeta, shownCategories],
  );

  // Routes that become per-route cards (TransitDisplayRouteGroup): collected
  // only from single-route boards in `categoryFilteredData`, deduped by
  // route_id and sorted ascending. Feeds the `RouteFilter` pill row.
  // Multi-route boards are skipped here (and exempt from the route filter
  // in `routeFilteredData`) since they cannot be reduced to a single route.
  const routesForRouteGroups = useMemo<Route[]>(() => {
    const byId = new Map<string, Route>();
    for (const display of categoryFilteredData) {
      if (hasMultipleRoutes(display)) {
        continue;
      }
      for (const route of display.meta.routes) {
        if (!byId.has(route.route_id)) {
          byId.set(route.route_id, route);
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.route_id.localeCompare(b.route_id));
  }, [categoryFilteredData]);

  // All agencies referenced by `dataWithMeta`, deduped by `agency_id`. Source
  // for `RouteFilter`'s display name resolution -- collected from the full
  // dataset (not the filtered view) so the agency lookup never breaks when a
  // category / route filter narrows the visible boards.
  const allAgencies = useMemo<Agency[]>(() => {
    const byId = new Map<string, Agency>();
    for (const display of dataWithMeta) {
      for (const candidate of display.data.data) {
        for (const agency of candidate.stop.agencies) {
          if (!byId.has(agency.agency_id)) {
            byId.set(agency.agency_id, agency);
          }
        }
      }
    }
    return Array.from(byId.values());
  }, [dataWithMeta]);

  // Apply the route filter on top of `categoryFilteredData`. When no route is
  // active, the filter is "off" and every board passes through (matches the
  // TimetableHeadsignFilter convention).
  //
  // Multi-route boards are always kept: the filter pill set is built from
  // single-route boards only (see `routesForRouteGroups`), so a multi-route
  // board's routes never appear in `activeRouteFilters` and a naive `some`
  // check would always drop them.
  const routeFilteredData = useMemo(() => {
    if (activeRouteFilters.size === 0) {
      return categoryFilteredData;
    }
    return categoryFilteredData.filter((display) => {
      if (hasMultipleRoutes(display)) {
        return true;
      }
      return display.meta.routes.some((r) => activeRouteFilters.has(r.route_id));
    });
  }, [categoryFilteredData, activeRouteFilters]);

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

  // Group single-route boards by their route (collapses the cluster's dep / arr
  // boards for one route into a single TransitDisplayPerRoute card) and keep
  // multi-route boards as standalone TransitDisplay renders. Map-based
  // aggregation so we do not rely on sort-order continuity of same-route boards.
  type GroupedItem =
    | { kind: 'single'; group: TransitDisplayRouteGroup }
    | { kind: 'multi'; board: TransitDisplayDataWithMetaData };
  const singleBoardsByRouteId = new Map<string, TransitDisplayDataWithMetaData[]>();
  const groupedDisplays: GroupedItem[] = [];
  for (const d of routeFilteredData) {
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
        {routesForRouteGroups.length > 0 && (
          <RouteFilter
            routes={routesForRouteGroups}
            activeFilters={activeRouteFilters}
            onToggleFilter={toggleRouteFilter}
            dataLangs={dataLangs}
            agencies={allAgencies}
            size={size}
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
          // Multi-route board: rendered standalone with the existing TransitDisplay.
          // Key combines board identity (category + route types) with the map
          // index, since a `custom` route grouping can collapse two groups to
          // the same present route types.
          const board = item.board;
          return (
            <TransitDisplay
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
  const style = TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE[size];
  return (
    <div
      role="group"
      aria-label={t('transitDisplay2.filter.label')}
      className={cn(
        'mb-2 flex items-center rounded-sm',
        'border-0',
        style.filterBox.boxClass,
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
              style.filterButton.boxClass,
              style.title.textClass,
              isShown ? FILTER_BUTTON_SHOWN_CLASS : FILTER_BUTTON_HIDDEN_CLASS,
            )}
          >
            {isArrival ? (
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
