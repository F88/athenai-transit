import type { RouteShape } from '../../types/app/map';
import type { AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { StopWithMeta } from '../../types/app/transit-composed';
import type { SelectionInfo } from './selection';
import { filterVisibleRouteShapes } from './route-shapes';
import { excludeStopsByIds, filterStopsByType } from './stop-filter';

export interface MapSelectionLayersParams {
  inBoundStops: StopWithMeta[];
  radiusStops: StopWithMeta[];
  routeStops: StopWithMeta[];
  routeShapes: RouteShape[];
  routeTypeMap: Map<string, AppRouteTypeValue[]>;
  visibleStopTypes: Set<number>;
  visibleRouteShapes: Set<number>;
  selectionInfo: SelectionInfo | null;
}

export interface MapSelectionLayersResult {
  selectedRouteIds: Set<string> | null;
  visibleShapes: RouteShape[];
  filteredNearbyStops: Stop[];
  filteredFarStops: Stop[];
  routeStopMarkers: Stop[];
  routeStopsRouteTypeMap: Map<string, AppRouteTypeValue[]>;
}

/**
 * Prepares route and stop layers derived from selection and visibility state.
 */
export function buildMapSelectionLayers({
  inBoundStops,
  radiusStops,
  routeStops,
  routeShapes,
  routeTypeMap,
  visibleStopTypes,
  visibleRouteShapes,
  selectionInfo,
}: MapSelectionLayersParams): MapSelectionLayersResult {
  const selectedRouteIds = selectionInfo?.routeIds ?? null;
  const hideUnselected = selectionInfo?.type === 'stop';

  const visibleShapes = filterVisibleRouteShapes(
    routeShapes,
    visibleRouteShapes,
    selectedRouteIds,
    hideUnselected,
  );

  const routeStopIds = new Set(routeStops.map((m) => m.stop.stop_id));

  const filteredNearbyStops = filterStopsByType(radiusStops, routeTypeMap, visibleStopTypes)
    .sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
    .map((m) => m.stop)
    .filter((s) => !routeStopIds.has(s.stop_id));

  const nearbyIds = new Set(radiusStops.map((s) => s.stop.stop_id));
  const filteredFarStops = filterStopsByType(
    excludeStopsByIds(inBoundStops, nearbyIds),
    routeTypeMap,
    visibleStopTypes,
  )
    .map((m) => m.stop)
    .filter((s) => !routeStopIds.has(s.stop_id));

  const routeStopMarkers = routeStops.map((m) => m.stop);

  const routeStopsRouteTypeMap = new Map<string, AppRouteTypeValue[]>();
  for (const m of routeStops) {
    const types = m.routes.map((r) => r.route_type);
    if (types.length > 0) {
      routeStopsRouteTypeMap.set(
        m.stop.stop_id,
        [...new Set(types)].sort((a, b) => a - b),
      );
    }
  }

  return {
    selectedRouteIds,
    visibleShapes,
    filteredNearbyStops,
    filteredFarStops,
    routeStopMarkers,
    routeStopsRouteTypeMap,
  };
}
