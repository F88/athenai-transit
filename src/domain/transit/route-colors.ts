import type { Route } from '@/types/app/transit';
import { convertGtfsColor, type GtfsColorFormat } from './gtfs-color';

/** GTFS default route color when `route_color` is omitted. */
const DEFAULT_ROUTE_COLOR = 'FFFFFF';
/** GTFS default text color when `route_text_color` is omitted. */
const DEFAULT_ROUTE_TEXT_COLOR = '000000';

/** Adjusted route badge colors for the current theme context. */
export interface AdjustedRouteColors {
  /** Primary route color to use for fills / strokes. */
  color: string;
  /** Text color paired with {@link color}. */
  textColor: string;
}

function normalizeRouteColor(color: string, fallback: string): string {
  return color || fallback;
}

function formatRouteColor(color: string, format: GtfsColorFormat): string {
  return convertGtfsColor(color, format) ?? color;
}

/**
 * Swap route colors when the route fill is too close to the current
 * theme background.
 *
 * GTFS provides both `route_color` and `route_text_color`. When the
 * fill color would visually disappear against the active theme, the UI
 * uses the text color as the main accent and keeps the original route
 * color as the paired text/border color.
 *
 * @param route - Route colors from GTFS (`route_color` and `route_text_color`).
 * @param isRouteColorLowContrast - Whether `route.route_color` is too close
 *   to the current theme background.
 * @param format - Output format. `'raw'` returns GTFS-style hex without
 *   `#`; `'css-hex'` returns CSS-ready `#RRGGBB` strings.
 * @returns Route colors in the order the UI should render them.
 */
export function getAdjustedRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  isRouteColorLowContrast: boolean,
  format: GtfsColorFormat = 'raw',
): AdjustedRouteColors {
  const routeColor = normalizeRouteColor(route.route_color, DEFAULT_ROUTE_COLOR);
  const routeTextColor = normalizeRouteColor(route.route_text_color, DEFAULT_ROUTE_TEXT_COLOR);

  if (isRouteColorLowContrast) {
    return {
      color: formatRouteColor(routeTextColor, format),
      textColor: formatRouteColor(routeColor, format),
    };
  }

  return {
    color: formatRouteColor(routeColor, format),
    textColor: formatRouteColor(routeTextColor, format),
  };
}
