import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { Agency, Route } from '@/types/app/transit';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { RouteFilter } from '@/components/filter/route-filter';
import { RadiusToggleButton } from '@/components/transit-display/radius-toggle-button';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import {
  type TransitDisplayCategory,
  type TransitDisplayDataWithMetaData,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import {
  isMultiRouteDisplay,
  type TransitDisplayStatus,
} from '@/domain/transit/transit-info-display/transit-display-ui';
import { useReconcileIdSet } from '@/hooks/use-reconcile-id-set';
import { cn } from '@/lib/utils';
import type { InfoLevel } from '@/types/app/settings';
import { TransitDisplayCategoryFilter } from './transit-display-category-filter';
import { TransitDisplayMultiRoutes } from './transit-display-multi-routes';
import { TransitDisplayPerRoute, type TransitDisplayRouteGroup } from './transit-display-per-route';

/**
 * Per-`size` style bundle for `TransitDisplayDashboard`: the controls row and
 * the wrapper around the category filter. Looked up via
 * {@link TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE}. (The category filter owns its
 * own size styles in `transit-display-category-filter.tsx`.)
 */
interface TransitDisplayDashboardSizeStyle {
  controls: {
    padding: string;
    categoryFilter: {
      padding: string;
    };
  };
  message: {
    textClass: string;
  };
}

const TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE: Record<
  ExtendedDisplaySize,
  TransitDisplayDashboardSizeStyle
> = {
  xs: {
    controls: { padding: 'pb-2', categoryFilter: { padding: 'px-1 py-0' } },
    message: { textClass: 'text-[10px]' },
  },
  sm: {
    controls: { padding: 'pb-2', categoryFilter: { padding: 'px-1.5 py-0' } },
    message: { textClass: 'text-xs' },
  },
  md: {
    controls: { padding: 'pb-2', categoryFilter: { padding: 'px-2 py-0' } },
    message: { textClass: 'text-base' },
  },
  lg: {
    controls: { padding: 'pb-2', categoryFilter: { padding: 'px-0 py-0' } },
    message: { textClass: 'text-2xl' },
  },
  xl: {
    controls: { padding: 'pb-2', categoryFilter: { padding: 'px-8 py-0' } },
    message: { textClass: 'text-4xl' },
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
  enableRouteFilter: boolean;
  /** Selectable coverage radii (m) for this view, in cycle order. */
  coverageRadiusOptions: readonly number[];
  /** Currently selected coverage radius (m); highlights the matching option. */
  selectedCoverageRadius: number;
  /** Fired with the picked coverage radius (m); the container rebuilds the boards at it. */
  onCoverageRadiusChange: (radiusMeters: number) => void;
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
  enableRouteFilter,
  coverageRadiusOptions,
  selectedCoverageRadius,
  onCoverageRadiusChange,
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
      if (isMultiRouteDisplay(display)) {
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

  // Set view of route ids currently present as pills; the source of truth for
  // which `activeRouteFilters` entries are still meaningful. When the pill set
  // shrinks (category toggle, dataWithMeta swap, ...), reconcile drops any
  // tracked id that is no longer offered as a pill -- preventing stale ids
  // from keeping the filter "on" with nothing the user can click to recover.
  const pillRouteIds = useMemo<Set<string>>(
    () => new Set(routesForRouteGroups.map((r) => r.route_id)),
    [routesForRouteGroups],
  );
  useReconcileIdSet(activeRouteFilters, pillRouteIds, setActiveRouteFilters);

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
      if (isMultiRouteDisplay(display)) {
        return true;
      }
      return display.meta.routes.some((r) => activeRouteFilters.has(r.route_id));
    });
  }, [categoryFilteredData, activeRouteFilters]);

  // Only offer toggles for categories that actually have a board, so the bar
  // mirrors what is on screen rather than always showing both.
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
    if (isMultiRouteDisplay(d)) {
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

  const style = TRANSIT_DISPLAY_DASHBOARD_STYLE_BY_SIZE[size];

  return (
    <div
      className={cn(
        'px-4',
        // debug
        // 'font-dotgothic16',
      )}
    >
      {/* Controls */}
      <div
        className={cn(
          'space-y-0',
          style.controls.padding,
          // debug
          // 'bg-orange-400',
        )}
      >
        <div className="flex items-stretch gap-2 pb-2">
          <RadiusToggleButton
            options={coverageRadiusOptions}
            selected={selectedCoverageRadius}
            onSelect={onCoverageRadiusChange}
            size={size}
          />
          {presentCategories.length > 0 && (
            <div className={cn('min-w-0 flex-1', style.controls.categoryFilter.padding)}>
              <TransitDisplayCategoryFilter
                categories={presentCategories}
                shownCategories={shownCategories}
                size={size}
                onToggleCategory={toggleCategory}
              />
            </div>
          )}
        </div>

        {enableRouteFilter && routesForRouteGroups.length > 0 && (
          <div
            className={cn(
              'pb-2',
              // debug
              // 'bg-green-600',
            )}
          >
            <RouteFilter
              routes={routesForRouteGroups}
              activeFilters={activeRouteFilters}
              onToggleFilter={toggleRouteFilter}
              dataLangs={dataLangs}
              agencies={allAgencies}
              size={size}
            />
          </div>
        )}
      </div>

      {/* Panels */}
      <div
        className={cn(
          'space-y-4',
          // debug
          // 'bg-pink-100',
        )}
      >
        {status.state === 'no-stops' && (
          <div className={cn('text-muted-foreground py-6 text-center', style.message.textClass)}>
            {t('transitDisplay2.noStop', { radius: status.radius })}
          </div>
        )}
        {status.state === 'no-service' && (
          <div className={cn('text-muted-foreground py-6 text-center', style.message.textClass)}>
            {t('transitDisplay2.noService')}
          </div>
        )}
        {status.state === 'ready' &&
          groupedDisplays.map((item) => {
            if (item.kind === 'single') {
              // Single-route group: keyed by route_id alone. `singleBoardsByRouteId`
              // already deduped by route_id when groupedDisplays was built, so this
              // is unique within the rendered list and stable across filter changes.
              return (
                <TransitDisplayPerRoute
                  key={`single__${item.group.route.route_id}`}
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
            // Multi-route board: keyed by (category, sorted route_id set). Distinct
            // groupings always carry a distinct route_id set, so this stays unique
            // even if a `custom` policy collapses two groupings to the same
            // route_type set. Stable across filter-driven reorderings.
            const board = item.board;
            const routeIdsKey = board.meta.routes
              .map((r) => r.route_id)
              .sort()
              .join('-');
            return (
              <TransitDisplayMultiRoutes
                key={`multi__${board.meta.category}__${routeIdsKey}`}
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
