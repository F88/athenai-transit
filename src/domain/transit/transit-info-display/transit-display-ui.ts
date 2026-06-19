import type { InfoLevel } from '../../../types/app/settings';
import type { FilteredTimetableEntriesState } from '../../../types/app/transit';
import type { StopWithContext } from '../../../types/app/transit-composed';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';
import {
  getFilteredTimetableEntriesState,
  getTimetableEntriesState,
} from '../timetable-service-state';
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
 * Display state for the nearby-stops collection. `no-stops` is the only
 * collection-specific value; the rest reuse {@link FilteredTimetableEntriesState}
 * so the judgment shares the same vocabulary the nearby-stop list uses
 * (`filter-hidden` cannot arise here -- there is no stop-level UI filter in
 * this path -- but the type keeps the union aligned).
 */
export type TransitDisplayStopsState = 'no-stops' | FilteredTimetableEntriesState;
export type TransitDisplayStatus = {
  radius: number;
  state: TransitDisplayStopsState;
};

/**
 * Resolve the display state for the nearby stops.
 *
 * Per-stop state is derived with the same {@link getFilteredTimetableEntriesState}
 * helper the nearby-stop list uses, then aggregated. This matters because the
 * boards are built from each stop's *upcoming* entries (`stopTimes`) while
 * `stopServiceState` is a *full-day* signal: a stop that ran earlier today but
 * has no upcoming trips is still `boardable` for the day, so without the
 * upcoming axis it would resolve to a content state and render blank boards.
 *
 * There is no stop-level UI filter here, so the post-filter axis equals the
 * pre-filter upcoming axis (no `filter-hidden`). Aggregation keeps the
 * most-serviceable stop, so a single stop with upcoming departures shows
 * boards rather than an empty-state message. Precedence:
 *
 * 1. no stops in radius -> `no-stops`
 * 2. any stop boardable / drop-off-only (has upcoming entries) -> that state
 * 3. any stop `service-ended` (service today but nothing upcoming) -> `service-ended`
 * 4. otherwise (all `no-service`) -> `no-service`
 */
export function resolveTransitDisplayState(
  stops: readonly StopWithContext[],
): TransitDisplayStopsState {
  if (stops.length === 0) {
    return 'no-stops';
  }
  const perStopStates = stops.map((stop) => {
    const upcomingState = getTimetableEntriesState([...stop.stopTimes]);
    return getFilteredTimetableEntriesState(stop.stopServiceState, upcomingState, upcomingState);
  });
  if (perStopStates.includes('boardable')) {
    return 'boardable';
  }
  if (perStopStates.includes('drop-off-only')) {
    return 'drop-off-only';
  }
  if (perStopStates.includes('service-ended')) {
    return 'service-ended';
  }
  return 'no-service';
}

/**
 * Whether the resolved state means there are boards to render (vs an
 * empty-state message). True for the content states (`boardable` /
 * `drop-off-only`); false for `no-stops` / `no-service` / `service-ended`.
 */
export function transitDisplayHasContent(state: TransitDisplayStopsState): boolean {
  return state === 'boardable' || state === 'drop-off-only';
}

/**
 * Aggregate the per-stop {@link FilteredTimetableEntriesState} of the in-radius
 * stops into the collection display state.
 *
 * STUB: the aggregation precedence -- in particular `service-ended` vs
 * `filter-hidden` when no stop has content -- is not specified yet. The body is
 * intentionally unimplemented pending that decision; do not wire it into the
 * display until the precedence is fixed.
 */
export function aggregateTransitDisplayState(
  perStopStates: readonly FilteredTimetableEntriesState[],
): TransitDisplayStopsState {
  throw new Error(
    `aggregateTransitDisplayState is not implemented yet (received ${perStopStates.length} states)`,
  );
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
