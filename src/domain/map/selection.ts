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
 * Extracts route IDs from a stop's departure context for selection highlighting.
 */
export function extractRouteIdsForStop(departures: StopWithContext[], stopId: string): Set<string> {
  const ctx = departures.find((d) => d.stop.stop_id === stopId);
  if (!ctx) {
    return new Set();
  }
  if (ctx.departures.length > 0) {
    return new Set(ctx.departures.map((e) => e.routeDirection.route.route_id));
  }
  return new Set(ctx.routes.map((r) => r.route_id));
}

/**
 * Builds a lookup map from stop ID to timetable entries.
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
 * Returns the route IDs from a stop's active departure groups.
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
 * Resolves selected route IDs from a route click or stop departures.
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
