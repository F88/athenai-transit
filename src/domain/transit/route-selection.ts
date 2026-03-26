import type { RouteShape } from '../../types/app/map';
import type { Route, RouteType, Stop } from '../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
  TimetableEntry,
} from '../../types/app/transit-composed';

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
  // Prefer active departures; fall back to StopWithMeta.routes
  // when all services have ended for the day (departures is empty).
  if (ctx.departures.length > 0) {
    return new Set(ctx.departures.map((e) => e.routeDirection.route.route_id));
  }
  return new Set(ctx.routes.map((r) => r.route_id));
}

/**
 * Builds a lookup map from stop ID to its timetable entries.
 *
 * Extracts only the `departures` from each {@link StopWithContext}, discarding
 * `stop` and `routeTypes` which are already available via other props.
 *
 * @param contexts - Array of stop departure contexts.
 * @returns A Map keyed by stop_id containing ContextualTimetableEntry arrays.
 */
export function buildTimetableEntriesMap(
  contexts: StopWithContext[],
): Map<string, ContextualTimetableEntry[]> {
  const map = new Map<string, ContextualTimetableEntry[]>();
  for (const d of contexts) {
    map.set(d.stop.stop_id, d.departures);
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
 * @param timetableEntriesMap - Map of stop IDs to their timetable entries.
 * @returns A Set of route IDs for the selected stop, or null if no stop is selected
 *          or the stop has no departures.
 */
export function getRouteIdsForStop(
  stopId: string | null,
  timetableEntriesMap: Map<string, TimetableEntry[]>,
): Set<string> | null {
  if (!stopId) {
    return null;
  }
  const entries = timetableEntriesMap.get(stopId);
  if (!entries || entries.length === 0) {
    return null;
  }
  return new Set(entries.map((e) => e.routeDirection.route.route_id));
}

/**
 * Resolves the set of selected route IDs from either a directly selected
 * route or a selected stop's departures.
 *
 * @param selectedRouteId - Directly selected route ID (from shape click), or null.
 * @param selectedStopId - Selected stop ID, or null.
 * @param timetableEntriesMap - Map of stop IDs to timetable entries.
 * @returns Set of route IDs to highlight, or null if nothing is selected.
 */
export function resolveSelectedRouteIds(
  selectedRouteId: string | null,
  selectedStopId: string | null,
  timetableEntriesMap: Map<string, TimetableEntry[]>,
): Set<string> | null {
  if (selectedRouteId) {
    return new Set([selectedRouteId]);
  }
  return getRouteIdsForStop(selectedStopId, timetableEntriesMap);
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
  /** Default line width (non-bus, or bus without freq data). */
  default: 4,
  /** Highlighted (selected) route line width. */
  highlighted: 6,
  /** Extra width added to the fill weight for the outline stroke. */
  outlineExtra: 4,
} as const;

/**
 * Compute line weight based on route type and daily departure frequency.
 *
 * - Non-bus routes (rail, subway, tram): fixed default weight (4).
 * - Bus routes: weight determined by daily departure count.
 *   250+ → 10, 100-249 → 6, 50-99 → 4, 0-49 → 3.
 *
 * Based on actual data distribution (1,202 bus routes):
 * 71% have freq < 50, 15% 50-99, 11% 100-249, 3% 250+.
 *
 * @param routeType - GTFS route_type (0=tram, 1=subway, 2=rail, 3=bus).
 * @param freq - Departures per day, or undefined if not available.
 * @returns Line weight in pixels.
 */
function getFreqBasedWeight(routeType: number, freq: number | undefined): number {
  if (routeType !== 3 || freq === undefined) {
    return ROUTE_WEIGHT.default;
  }
  if (freq >= 250) {
    return 10;
  }
  if (freq >= 100) {
    return 6;
  }
  if (freq >= 50) {
    return 4;
  }
  return 3;
}

/**
 * Compute the style for a highlighted (selected) route shape.
 *
 * Weight is the greater of freq-based weight or the minimum
 * highlight width. Outline is added on top.
 *
 * @param routeType - GTFS route_type.
 * @param freq - Departures per day, or undefined if not available.
 * @returns Fill and outline style for highlighted state.
 */
function getHighlightedRouteShapeStyle(
  routeType: number,
  freq: number | undefined,
): RouteShapeStyle {
  const weight = Math.max(getFreqBasedWeight(routeType, freq), ROUTE_WEIGHT.highlighted);
  return {
    weight,
    opacity: 1.0,
    outline: {
      weight: weight + ROUTE_WEIGHT.outlineExtra,
      opacity: 1.0,
    },
  };
}

/**
 * Computes the polyline style for a route shape based on selection state.
 *
 * Returns one of three states:
 * - No selection (`selectedRouteIds` is null): default style without outline.
 *   When `freq` is available, weight is scaled by frequency.
 * - Selected and route matches: highlighted style with prominent outline
 * - Selected but route does not match: dimmed style without outline
 *
 * @param selectedRouteIds - Set of selected route IDs, or null if nothing is selected.
 * @param routeId - The route ID of the shape to style.
 * @param freq - Departures per day for this route (from insights), or undefined.
 * @returns Fill and outline style values.
 */
export function getRouteShapeStyle(
  selectedRouteIds: Set<string> | null,
  routeId: string,
  routeType: number,
  freq?: number,
): RouteShapeStyle {
  if (selectedRouteIds === null) {
    return {
      weight: getFreqBasedWeight(routeType, freq),
      opacity: 1.0,
      outline: null,
    };
  }

  if (selectedRouteIds.has(routeId)) {
    return getHighlightedRouteShapeStyle(routeType, freq);
  }

  return {
    weight: getFreqBasedWeight(routeType, freq),
    opacity: 0.15,
    outline: null,
  };
}
