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

/**
 * Treat identical route/text colors as unset, except for explicit
 * white-on-white values which are preserved for historical reasons.
 */
export function isRouteColorUnset(rawColor: string, rawTextColor: string): boolean {
  return !rawColor || (rawColor === rawTextColor && rawColor !== 'FFFFFF');
}

export function resolvePipelineRouteColors({
  routeId,
  rawColor,
  rawTextColor,
  routeColorFallbacks,
}: ResolvePipelineRouteColorsInput): PipelineResolvedRouteColors {
  const colorUnset = isRouteColorUnset(rawColor, rawTextColor);
  const defaultColor = routeColorFallbacks['*'] ?? '';
  const fallbackColor = routeColorFallbacks[routeId] || defaultColor;
  const color = colorUnset ? fallbackColor : rawColor;
  const usedFallback = colorUnset && color !== rawColor;
  const textColor = usedFallback ? 'FFFFFF' : rawTextColor;

  return {
    color,
    textColor,
    colorUnset,
    usedFallback,
  };
}
