import type { RouteShape } from '../../types/app/map';

/**
 * Filters route shapes to those that should be rendered on the map.
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
  outline: {
    weight: number;
    opacity: number;
  } | null;
}

const ROUTE_WEIGHT = {
  default: 4,
  highlighted: 6,
  outlineExtra: 4,
} as const;

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
