import { useMemo } from 'react';
import {
  buildMapSelectionLayers,
  type MapSelectionLayersParams,
  type MapSelectionLayersResult,
} from '../domain/map/map-selection-layers';

/**
 * Memoized React wrapper around map selection layer preparation.
 */
export function useMapSelectionLayers(params: MapSelectionLayersParams): MapSelectionLayersResult {
  const {
    inBoundStops,
    radiusStops,
    routeStops,
    routeShapes,
    routeTypeMap,
    visibleStopTypes,
    visibleRouteShapes,
    selectionInfo,
  } = params;

  return useMemo(
    () =>
      buildMapSelectionLayers({
        inBoundStops,
        radiusStops,
        routeStops,
        routeShapes,
        routeTypeMap,
        visibleStopTypes,
        visibleRouteShapes,
        selectionInfo,
      }),
    [
      inBoundStops,
      radiusStops,
      routeStops,
      routeShapes,
      routeTypeMap,
      visibleStopTypes,
      visibleRouteShapes,
      selectionInfo,
    ],
  );
}
