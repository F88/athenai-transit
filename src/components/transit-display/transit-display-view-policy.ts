import { ROUTE_TYPE_DISPLAY_ORDER } from '@/domain/transit/route-type-display-order';
import type { StopTimeViewId } from '@/domain/transit/stop-time-views';
import { buildTransitDisplayDataSet } from '@/domain/transit/transit-info-display/build-transit-display-data';
import {
  sortTransitDisplayDataWithMetaData,
  transitDisplayMaxEntriesFor,
  transitDisplayMaxEntriesPerRouteFor,
} from '@/domain/transit/transit-info-display/transit-display-ui';
import type { InfoLevel } from '@/types/app/settings';
import type { AppRouteTypeValue } from '@/types/app/transit';
import type { StopWithContext } from '@/types/app/transit-composed';

/**
 * Route types whose boards are NOT split by direction: bus, trolleybus, and
 * ferry. Their `direction_id` is route-local / arbitrary, and at a shared stop
 * many routes converge (ferries especially fan out hub-and-spoke across several
 * pontoons), so a per-direction split would mix unrelated routes; the headsign
 * carries the destination instead. Everything else (rail / subway / tram /
 * monorail / ...) is split, where a line's direction is the meaningful axis.
 */
const NO_SPLIT_ROUTE_TYPES: readonly AppRouteTypeValue[] = [3, 11, 4];

/** Every other route type is split by direction, kept in display order. */
const DIRECTION_SPLIT_ROUTE_TYPES: readonly AppRouteTypeValue[] = ROUTE_TYPE_DISPLAY_ORDER.filter(
  (routeType) => !NO_SPLIT_ROUTE_TYPES.includes(routeType),
);

/**
 * Per-view build policy: which route types are rendered as multi-route boards
 * vs. per-route boards, and whether each side splits by direction.
 * Declarative so adding a new view is one entry instead of an if-else chain.
 * Two builder calls are issued -- one for `multiRoute` route types and one for
 * `perRoute` route types -- and their outputs are concatenated and re-sorted.
 */
export interface ViewPolicy {
  /** Multi-route boards (1 board can carry multiple routes; bus-style). */
  multiRoute: {
    /** Route types to build as multi-route boards. Empty = no multi-route boards. */
    routeTypes: readonly AppRouteTypeValue[];
    /** Whether to additionally split each multi-route board by direction. */
    splitByDirection: boolean;
  };
  /** Per-route boards (1 board = 1 route). */
  perRoute: {
    /** Route types to build as per-route boards. Empty = no per-route boards. */
    routeTypes: readonly AppRouteTypeValue[];
    /** Whether to additionally split each per-route board by direction. */
    splitByDirection: boolean;
  };
}

/**
 * Default transit-display / transit-display-2 policy: bus / trolleybus / ferry
 * as multi-route (folded), everything else as per-route + per-direction.
 */
export const TRANSIT_DISPLAY_POLICY: ViewPolicy = {
  multiRoute: { routeTypes: NO_SPLIT_ROUTE_TYPES, splitByDirection: false },
  perRoute: { routeTypes: DIRECTION_SPLIT_ROUTE_TYPES, splitByDirection: true },
};

/** Route-grouped view: every route type rendered per-route + per-direction. */
export const ROUTE_VIEW_POLICY: ViewPolicy = {
  multiRoute: { routeTypes: [], splitByDirection: false },
  perRoute: { routeTypes: ROUTE_TYPE_DISPLAY_ORDER, splitByDirection: true },
};

/**
 * View-id -> policy table. Views whose layout is owned by `TransitDisplaysContainer`
 * live here; views handled elsewhere (e.g. the stop-list view) are absent and
 * the container then renders nothing for the active board.
 * {@link TRANSIT_DISPLAY_VIEW_IDS} exposes the keys so callers (e.g.
 * `StopBrowser`) can ask "is this view owned by the container?" without
 * duplicating the list.
 */
export const VIEW_POLICY: Partial<Record<StopTimeViewId, ViewPolicy>> = {
  'transit-display': TRANSIT_DISPLAY_POLICY,
  'transit-display-2': TRANSIT_DISPLAY_POLICY,
  route: ROUTE_VIEW_POLICY,
};

/**
 * View IDs this container is responsible for (= keys of {@link VIEW_POLICY}).
 * Use this in upstream dispatch to decide whether to render
 * `TransitDisplaysContainer` vs a different surface (e.g. `StopGrid`).
 */
export const TRANSIT_DISPLAY_VIEW_IDS: readonly StopTimeViewId[] = Object.keys(
  VIEW_POLICY,
) as StopTimeViewId[];

/**
 * Run the two builder calls for one policy and merge their output in the UI
 * order. Pure function so it can be called from `useMemo` hooks with stable
 * dependencies (the result depends only on `nearbyStops`, `radiusMeters`,
 * `policy`, and `infoLevel`).
 */
export function buildBoardsForPolicy(
  nearbyStops: readonly StopWithContext[],
  radiusMeters: number,
  policy: ViewPolicy,
  infoLevel: InfoLevel,
) {
  const maxEntriesMultiRoute = transitDisplayMaxEntriesFor(infoLevel);
  const maxEntriesPerRoute = transitDisplayMaxEntriesPerRouteFor(infoLevel);

  const multiRouteRaw = buildTransitDisplayDataSet(nearbyStops, radiusMeters, {
    maxEntries: maxEntriesMultiRoute,
    routeTypeGrouping: { kind: 'custom', groups: policy.multiRoute.routeTypes.map((t) => [t]) },
    splitByRoute: false,
    splitByDirection: policy.multiRoute.splitByDirection,
  });
  const perRouteRaw = buildTransitDisplayDataSet(nearbyStops, radiusMeters, {
    maxEntries: maxEntriesPerRoute,
    routeTypeGrouping: { kind: 'custom', groups: policy.perRoute.routeTypes.map((t) => [t]) },
    splitByRoute: true,
    splitByDirection: policy.perRoute.splitByDirection,
  });

  return sortTransitDisplayDataWithMetaData([...multiRouteRaw, ...perRouteRaw]);
}
