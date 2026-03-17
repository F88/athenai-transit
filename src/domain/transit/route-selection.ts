import type { RouteShape } from '../../types/app/map';
import type { Route, RouteType, Stop } from '../../types/app/transit';
import type { DepartureGroup, StopWithContext } from '../../types/app/transit-composed';

/** Selection info for a stop. */
export interface StopSelectionInfo {
  type: 'stop';
  stop: Stop;
  routeTypes: RouteType[];
  routeIds: Set<string>;
}

/** Selection info for a route shape. */
export interface RouteSelectionInfo {
  type: 'route';
  route: Route;
  routeType: RouteType;
  routeIds: Set<string>;
}

/** Describes the currently selected item for the indicator display. */
export type SelectionInfo = StopSelectionInfo | RouteSelectionInfo;

/**
 * Extracts route IDs from a stop's departure context for **selection highlighting**.
 *
 * When active departures exist, returns only the routes with upcoming departures.
 * When all services have ended (groups is empty), falls back to
 * {@link StopWithMeta.routes} so that route shapes remain highlighted.
 *
 * Unlike {@link getRouteIdsForStop} which is departure-only and returns null
 * when no departures exist, this function always returns a Set (possibly empty)
 * because selection highlighting should work regardless of service hours.
 *
 * @param departures - Array of nearby stop departure contexts.
 * @param stopId - The stop ID to look up.
 * @returns Set of route IDs serving the stop, or an empty set if not found.
 */
export function extractRouteIdsForStop(departures: StopWithContext[], stopId: string): Set<string> {
  const ctx = departures.find((d) => d.stop.stop_id === stopId);
  if (!ctx) {
    return new Set();
  }
  // Prefer active departure groups; fall back to StopWithMeta.routes
  // when all services have ended for the day (groups is empty).
  if (ctx.groups.length > 0) {
    return new Set(ctx.groups.map((g) => g.route.route_id));
  }
  return new Set(ctx.routes.map((r) => r.route_id));
}

/**
 * Builds a lookup map from stop ID to its departure groups.
 *
 * Extracts only the `groups` from each {@link StopWithContext}, discarding
 * `stop` and `routeTypes` which are already available via other props.
 *
 * @param departures - Array of stop departure contexts.
 * @returns A Map keyed by stop_id containing only DepartureGroup arrays.
 */
export function buildDepartureGroupsMap(
  departures: StopWithContext[],
): Map<string, DepartureGroup[]> {
  const map = new Map<string, DepartureGroup[]>();
  for (const d of departures) {
    map.set(d.stop.stop_id, d.groups);
  }
  return map;
}

/**
 * Returns the set of route IDs from a stop's **active departure groups**.
 *
 * Used by departure-related views (BottomSheet, timetable) where only
 * routes with current departures are relevant. Returns null when no
 * departures exist — callers use this to distinguish "no data" from
 * "has data but empty".
 *
 * For selection highlighting that works even after services end,
 * use {@link extractRouteIdsForStop} instead.
 *
 * @param stopId - The selected stop ID, or null if no stop is selected.
 * @param departureGroupsMap - Map of stop IDs to their departure groups.
 * @returns A Set of route IDs for the selected stop, or null if no stop is selected
 *          or the stop has no departures.
 */
export function getRouteIdsForStop(
  stopId: string | null,
  departureGroupsMap: Map<string, DepartureGroup[]>,
): Set<string> | null {
  if (!stopId) {
    return null;
  }
  const groups = departureGroupsMap.get(stopId);
  if (!groups || groups.length === 0) {
    return null;
  }
  return new Set(groups.map((g) => g.route.route_id));
}

/**
 * Resolves the set of selected route IDs from either a directly selected
 * route or a selected stop's departures.
 *
 * @param selectedRouteId - Directly selected route ID (from shape click), or null.
 * @param selectedStopId - Selected stop ID, or null.
 * @param departureGroupsMap - Map of stop IDs to departure groups.
 * @returns Set of route IDs to highlight, or null if nothing is selected.
 */
export function resolveSelectedRouteIds(
  selectedRouteId: string | null,
  selectedStopId: string | null,
  departureGroupsMap: Map<string, DepartureGroup[]>,
): Set<string> | null {
  if (selectedRouteId) {
    return new Set([selectedRouteId]);
  }
  return getRouteIdsForStop(selectedStopId, departureGroupsMap);
}

/**
 * Filters route shapes to those that should be rendered.
 *
 * Applies two filters:
 * 1. `visibleRouteShapes` — user toggle for route types (bus, subway, etc.)
 * 2. `hideUnselected` — when true and something is selected (stop or route),
 *    only shapes matching `selectedRouteIds` are kept.
 *
 * @param shapes - All available route shapes.
 * @param visibleRouteShapes - Set of visible route types.
 * @param selectedRouteIds - Set of selected route IDs (from stop or route selection), or null if nothing is selected.
 * @param hideUnselected - Whether to hide routes not in `selectedRouteIds`.
 * @returns Filtered array of route shapes to render.
 */
export function filterVisibleRouteShapes(
  shapes: RouteShape[],
  visibleRouteShapes: Set<number>,
  selectedRouteIds: Set<string> | null,
  hideUnselected: boolean,
): RouteShape[] {
  return shapes.filter((shape) => {
    if (!visibleRouteShapes.has(shape.routeType)) {
      return false;
    }
    if (hideUnselected) {
      if (selectedRouteIds === null) {
        return false;
      }
      return selectedRouteIds.has(shape.routeId);
    }
    return true;
  });
}

/** Style values for a route shape polyline. */
export interface RouteShapeStyle {
  weight: number;
  opacity: number;
  /** Outline style, or null if outline should be skipped. */
  outline: {
    weight: number;
    opacity: number;
  } | null;
}

/** Route shape weight constants. */
const ROUTE_WEIGHT = {
  /** Default and dimmed route line width. */
  default: 4,
  /** Highlighted (selected) route line width. */
  highlighted: 6,
  /** Extra width added to the fill weight for the outline stroke. */
  outlineExtra: 4,
} as const;

/**
 * Computes the polyline style for a route shape based on selection state.
 *
 * Returns one of three states:
 * - No selection (`selectedRouteIds` is null): default style without outline
 * - Selected and route matches: highlighted style with prominent outline
 * - Selected but route does not match: dimmed style without outline
 *
 * @param selectedRouteIds - Set of selected route IDs, or null if nothing is selected.
 * @param routeId - The route ID of the shape to style.
 * @returns Fill and outline style values.
 */
export function getRouteShapeStyle(
  selectedRouteIds: Set<string> | null,
  routeId: string,
): RouteShapeStyle {
  if (selectedRouteIds === null) {
    return {
      weight: ROUTE_WEIGHT.default,
      opacity: 1.0,
      outline: null,
    };
  }

  if (selectedRouteIds.has(routeId)) {
    return {
      weight: ROUTE_WEIGHT.highlighted,
      opacity: 1.0,
      outline: {
        weight: ROUTE_WEIGHT.highlighted + ROUTE_WEIGHT.outlineExtra,
        opacity: 1.6,
      },
    };
  }

  return {
    weight: ROUTE_WEIGHT.default,
    opacity: 0.15,
    outline: null,
  };
}
