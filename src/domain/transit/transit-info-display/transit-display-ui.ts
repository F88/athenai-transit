import type { InfoLevel } from '../../../types/app/settings';
import type { FilteredTimetableEntriesState } from '../../../types/app/transit';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';
import {
  CATEGORIES,
  DIRECTIONS,
  type TransitDisplayDataWithMetaData,
} from './build-transit-display-data';

/**
 * Per-board row cap by info level: terser levels show fewer departures, the
 * more detailed levels show more. Used as the `maxEntries` passed to
 * {@link buildTransitDisplayDataSet}.
 */
const MAX_ENTRIES_BY_INFO_LEVEL: Record<InfoLevel, number> = {
  simple: 10,
  normal: 10,
  detailed: 20,
  verbose: 20,
  // verbose: 10,
};

/** Resolves the per-board row cap for the given info level. */
export function transitDisplayMaxEntriesFor(infoLevel: InfoLevel): number {
  return MAX_ENTRIES_BY_INFO_LEVEL[infoLevel];
}

/**
 * Per-board row cap for per-route boards (1 route per board, produced by
 * `splitByRoute: true`). Smaller than the multi-route default since a long
 * list dilutes the "next several departures of THIS line" intent.
 */
const MAX_ENTRIES_PER_ROUTE_BY_INFO_LEVEL: Record<InfoLevel, number> = {
  simple: 3,
  normal: 5,
  detailed: 10,
  verbose: 10,
  // verbose: 10,
};

/** Resolves the per-route per-board row cap for the given info level. */
export function transitDisplayMaxEntriesPerRouteFor(infoLevel: InfoLevel): number {
  return MAX_ENTRIES_PER_ROUTE_BY_INFO_LEVEL[infoLevel];
}

/**
 * UI ordering for the raw displays (sorted on `meta`, before rows are resolved),
 * independent of how they were built or merged (the container concatenates a
 * no-split and a split call, so the raw order is not canonical). Axes:
 *   1. route type, by `ROUTE_TYPE_DISPLAY_ORDER`
 *   2. route, by `meta.routes[0].route_id` alphabetical -- ONLY when both
 *      boards have a single route (`routes.length === 1`). Single-route boards
 *      have a stable `routes[0]` shared across the cluster's dep / arr, so
 *      comparing by route keeps every board of the same route adjacent (Issue
 *      #296). The id is agency-prefixed in v2 sources (e.g. `kobus:9`), so
 *      agency clustering falls out naturally. For multi-route boards
 *      (`routes.length > 1`) the route axis is skipped: `meta.routes` is
 *      derived from filtered boardCandidates, so dep / arr from the same
 *      cluster can land on different `routes[0]`; using it as a sort key
 *      would mis-order arrivals before departures.
 *   3. direction, in `DIRECTIONS` order (none, 0, 1) -- ONLY when the route
 *      axis is also being used (both boards single-route) AND both boards
 *      have a single direction. Reasoning: a single direction value can still
 *      differ between dep and arr inside a multi-route cluster (a route
 *      present only in one category can shift `directions[0]`), so the
 *      direction axis is trusted only alongside single-route, where `routes`
 *      and `directions` are both stable across the cluster's dep / arr.
 *   4. category, departures before arrivals -- the final tiebreaker, and the
 *      only inner axis when both route and direction are skipped.
 *
 * A full comparator (not a stable sort on one key), so reordering by route
 * type can never disturb the inner-axis order set up earlier.
 */
export function sortTransitDisplayDataWithMetaData(
  rawDisplays: readonly TransitDisplayDataWithMetaData[],
): TransitDisplayDataWithMetaData[] {
  const orderKey = (d: TransitDisplayDataWithMetaData) => {
    const direction = d.meta.directions[0];
    return {
      routeType: ROUTE_TYPE_DISPLAY_ORDER.indexOf(d.meta.routeTypes[0]),
      // Per-axis skip flags. When the board carries multiple values on an
      // axis (routes or directions), `meta` is derived from filtered
      // boardCandidates, so dep / arr from the same cluster can land on
      // different head values for that axis; comparing by it would mis-order
      // arrivals before departures. Evaluated independently so each axis can
      // remain usable on its own merit.
      hasMultipleRoutes: hasMultipleRoutes(d),
      hasMultipleDirections: hasMultipleDirections(d),
      routeId: d.meta.routes[0]?.route_id ?? '',
      direction: DIRECTIONS.indexOf(direction === 'none' ? undefined : direction),
      category: CATEGORIES.indexOf(d.meta.category),
    };
  };
  return [...rawDisplays].sort((a, b) => {
    const ka = orderKey(a);
    const kb = orderKey(b);
    const skipRouteAxis = ka.hasMultipleRoutes || kb.hasMultipleRoutes;
    // Direction axis is also skipped whenever the route axis is skipped:
    // multi-route boards may have a single direction value that still differs
    // between dep and arr (a route present only in one category can shift
    // `directions[0]`), so trusting it would mis-order arrivals before
    // departures. `hasMultipleDirections` covers the case where `splitByRoute`
    // is true but `splitByDirection` is false (rare but possible).
    const skipDirectionAxis = skipRouteAxis || ka.hasMultipleDirections || kb.hasMultipleDirections;
    return (
      ka.routeType - kb.routeType ||
      (skipRouteAxis ? 0 : ka.routeId.localeCompare(kb.routeId)) ||
      (skipDirectionAxis ? 0 : ka.direction - kb.direction) ||
      ka.category - kb.category
    );
  });
}

/**
 * Combined display state of the nearby-stops collection. Expressed only in
 * terms of the per-stop {@link FilteredTimetableEntriesState} values; it makes
 * no assumption about the time period those values were computed over.
 *
 * - `no-stops`: no stops at all.
 * - `some-in-service`: at least one stop is in service (`boardable` /
 *   `drop-off-only`) -- there are boards to render.
 * - `all-service-ended`: none in service, but at least one is `service-ended`.
 * - `all-filtered-out`: none in service or service-ended, but at least one is
 *   `filter-hidden`.
 * - `all-no-service`: every stop is `no-service`.
 */
export type TransitDisplayStopsState =
  | 'no-stops'
  | 'some-in-service'
  | 'all-service-ended'
  | 'all-filtered-out'
  | 'all-no-service';
export type TransitDisplayStatus = {
  radius: number;
  state: TransitDisplayStopsState;
};

/**
 * Derive the collection display state from the per-stop
 * {@link FilteredTimetableEntriesState} of the in-radius stops. Purely
 * combinatorial over the per-stop values. Precedence:
 *
 * 1. empty -> `no-stops`
 * 2. any `boardable` / `drop-off-only` -> `some-in-service`
 * 3. any `service-ended` -> `all-service-ended`
 * 4. any `filter-hidden` -> `all-filtered-out`
 * 5. otherwise (all `no-service`) -> `all-no-service`
 */
export function deriveTransitDisplayStopsState(
  states: readonly FilteredTimetableEntriesState[],
): TransitDisplayStopsState {
  if (states.length === 0) {
    return 'no-stops';
  }
  if (states.some((state) => state === 'boardable' || state === 'drop-off-only')) {
    return 'some-in-service';
  }
  if (states.some((state) => state === 'service-ended')) {
    return 'all-service-ended';
  }
  if (states.some((state) => state === 'filter-hidden')) {
    return 'all-filtered-out';
  }
  return 'all-no-service';
}

/**
 * Whether the given display covers multiple routes on its single board
 * (i.e. a multi-route board, built with `splitByRoute: false` and serving
 * more than one route at this stop). Implementation reads `meta.routes`
 * (O(1)); the same count could be derived from `data.data` but with O(n).
 */
export function hasMultipleRoutes(d: TransitDisplayDataWithMetaData): boolean {
  return d.meta.routes.length > 1;
}

/**
 * Whether the display was built as a multi-route display (routes folded
 * together) rather than one-display-per-route. Determined by the build policy
 * (`meta.selection.splitByRoute`), NOT by how many routes are present -- a
 * multi-route display with a single present route is still multi-route. Use
 * this (not {@link hasMultipleRoutes}, a count) to choose the per-route vs
 * multi-route renderer in the dashboard.
 */
export function isMultiRouteDisplay(d: TransitDisplayDataWithMetaData): boolean {
  return !d.meta.selection.splitByRoute;
}

/**
 * Whether the given display covers multiple directions on its single board
 * (i.e. a multi-direction board, built with `splitByDirection: false` and
 * carrying trips of more than one direction at this stop). Implementation
 * reads `meta.directions` (O(1)).
 */
export function hasMultipleDirections(d: TransitDisplayDataWithMetaData): boolean {
  return d.meta.directions.length > 1;
}
