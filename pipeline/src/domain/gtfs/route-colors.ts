/**
 * Pure pipeline-side resolution for GTFS route colors.
 *
 * Keeps route color fallback policy separate from SQLite extraction and
 * JSON assembly so the behavior can be tested in isolation.
 */

export interface ResolvePipelineRouteColorsInput {
  routeId: string;
  rawColor: string;
  rawTextColor: string;
  routeColorFallbacks: Record<string, string>;
}

export interface PipelineResolvedRouteColors {
  color: string;
  textColor: string;
  colorUnset: boolean;
  usedFallback: boolean;
}

export function resolvePipelineRouteColors({
  routeId,
  rawColor,
  rawTextColor,
  routeColorFallbacks,
}: ResolvePipelineRouteColorsInput): PipelineResolvedRouteColors {
  const colorUnset = !rawColor;
  const defaultColor = routeColorFallbacks['*'] ?? '';
  const fallbackColor = routeColorFallbacks[routeId] || defaultColor;
  const color = colorUnset ? fallbackColor : rawColor;
  const usedFallback = colorUnset && color !== rawColor;
  const textColor = rawTextColor;

  return {
    color,
    textColor,
    colorUnset,
    usedFallback,
  };
}
