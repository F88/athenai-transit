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
 * no-split and a split call, so the raw order is not canonical). Four levels:
 *   1. route type, by `ROUTE_TYPE_DISPLAY_ORDER`
 *   2. within a route type: route, by `meta.routes[0].route_id` alphabetical.
 *      Boards spanning multiple routes are evaluated by `routes[0]`. The id is
 *      agency-prefixed in v2 sources (e.g. `kobus:9`), so this naturally keeps
 *      every route under the same agency adjacent. This groups boards of the
 *      same route together -- its departures / arrivals and both directions
 *      stay adjacent rather than getting interleaved with other routes' boards
 *      at multi-route stops (Issue #296). Alphabetical sort is independent of
 *      builder input order so the final ordering is fully derivable from meta.
 *   3. within a route: category, departures before arrivals
 *   4. within a category: direction, in `DIRECTIONS` order (none, 0, 1)
 *
 * A full comparator (not a stable sort on one key), so reordering by route type
 * can never disturb the route/category/direction order set up earlier.
 */
export function sortTransitDisplayDataWithMetaData(
  rawDisplays: readonly TransitDisplayDataWithMetaData[],
): TransitDisplayDataWithMetaData[] {
  const orderKey = (d: TransitDisplayDataWithMetaData) => {
    const direction = d.meta.directions[0];
    return {
      routeType: ROUTE_TYPE_DISPLAY_ORDER.indexOf(d.meta.routeTypes[0]),
      routeId: d.meta.routes[0]?.route_id ?? '',
      category: CATEGORIES.indexOf(d.meta.category),
      direction: DIRECTIONS.indexOf(direction === 'none' ? undefined : direction),
    };
  };
  return [...rawDisplays].sort((a, b) => {
    const ka = orderKey(a);
    const kb = orderKey(b);
    return (
      ka.routeType - kb.routeType ||
      ka.routeId.localeCompare(kb.routeId) ||
      ka.category - kb.category ||
      ka.direction - kb.direction
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
