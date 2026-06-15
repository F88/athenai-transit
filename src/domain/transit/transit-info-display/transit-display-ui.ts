import type { InfoLevel } from '../../../types/app/settings';
import type { StopWithContext } from '../../../types/app/transit-composed';
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
 *   3. direction, in `DIRECTIONS` order (none, 0, 1) -- ONLY when both boards
 *      have a single direction (`directions.length === 1`). Same reasoning as
 *      the route axis: a single direction means split-by-direction was applied
 *      and dep / arr share `directions[0]`; multi-direction boards have a
 *      shifted `directions[0]` between dep and arr (whether a no-direction
 *      route appears in only one category etc.), so the axis is skipped.
 *      Skipping route and direction is decided per axis (not jointly), so a
 *      future "splitByDirection: true + splitByRoute: false" composition
 *      keeps the direction axis usable while route is skipped.
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
      hasMultipleRoutes: d.meta.routes.length > 1,
      hasMultipleDirections: d.meta.directions.length > 1,
      routeId: d.meta.routes[0]?.route_id ?? '',
      direction: DIRECTIONS.indexOf(direction === 'none' ? undefined : direction),
      category: CATEGORIES.indexOf(d.meta.category),
    };
  };
  return [...rawDisplays].sort((a, b) => {
    const ka = orderKey(a);
    const kb = orderKey(b);
    const skipRouteAxis = ka.hasMultipleRoutes || kb.hasMultipleRoutes;
    const skipDirectionAxis = ka.hasMultipleDirections || kb.hasMultipleDirections;
    return (
      ka.routeType - kb.routeType ||
      (skipRouteAxis ? 0 : ka.routeId.localeCompare(kb.routeId)) ||
      (skipDirectionAxis ? 0 : ka.direction - kb.direction) ||
      ka.category - kb.category
    );
  });
}

export type TransitDisplayStopsState = 'ready' | 'no-stops' | 'no-service';
export type TransitDisplayStatus = {
  radius: number;
  state: TransitDisplayStopsState;
};

export function resolveTransitDisplayState(
  stops: readonly StopWithContext[],
): TransitDisplayStopsState {
  if (stops.length === 0) {
    return 'no-stops';
  }
  if (stops.every((stop) => stop.stopServiceState === 'no-service')) {
    return 'no-service';
  }
  return 'ready';
}
