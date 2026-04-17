import type { Route } from '@/types/app/transit';
import type { GtfsColorFormat } from '../gtfs-color';
import { suggestTextColor } from '../../../utils/color-contrast';
import { normalizeHexColor, type OptionalColorPair } from '../../../utils/color-pair';
import { formatResolvedColor, formatResolvedColorPair } from './resolve-colors';

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

/** Route colors resolved for UI rendering before theme-specific adjustment. */
export interface ResolvedRouteColors {
  /** Resolved route fill color. Undefined when GTFS provides no usable route color. */
  routeColor?: string;
  /** Resolved route text color. Undefined when no usable text color can be resolved. */
  routeTextColor?: string;
}

function toRawTextFallback(routeColor: string): string {
  return suggestTextColor(formatResolvedColor(routeColor, 'css-hex')) === 'white'
    ? 'FFFFFF'
    : '000000';
}

function resolveRawRouteTextColor(
  rawRouteColor: string | undefined,
  explicitRawRouteTextColor: string | undefined,
): string | undefined {
  if (!rawRouteColor) {
    return explicitRawRouteTextColor;
  }

  if (!explicitRawRouteTextColor) {
    return toRawTextFallback(rawRouteColor);
  }

  if (explicitRawRouteTextColor === rawRouteColor) {
    return toRawTextFallback(rawRouteColor);
  }

  return explicitRawRouteTextColor;
}

function resolveRawRouteColorPair(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
): OptionalColorPair {
  const rawRouteColor = normalizeHexColor(route.route_color);
  const explicitRawRouteTextColor = normalizeHexColor(route.route_text_color);

  return {
    primaryColor: rawRouteColor,
    secondaryColor: resolveRawRouteTextColor(rawRouteColor, explicitRawRouteTextColor),
  };
}

function toResolvedRouteColors(colors: OptionalColorPair): ResolvedRouteColors {
  return {
    routeColor: colors.primaryColor,
    routeTextColor: colors.secondaryColor,
  };
}

/**
 * Resolve GTFS route colors into a usable semantic route/text pair.
 *
 * Invalid GTFS color values are treated as omitted. When `route_color`
 * is usable but `route_text_color` is missing, the text color is
 * derived by contrast only as either `FFFFFF` or `000000`. Explicit
 * GTFS text colors are preserved as-is. Theme-aware fallback colors are
 * deliberately out of scope.
 */
export function resolveRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  format: GtfsColorFormat = 'raw',
): ResolvedRouteColors {
  const rawColors = resolveRawRouteColorPair(route);
  const resolvedColors = formatResolvedColorPair(rawColors, format);

  return toResolvedRouteColors(resolvedColors);
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
  const resolved = resolveRouteColors(route, format);
  const routeColor = resolved.routeColor ?? formatResolvedColor(DEFAULT_ROUTE_COLOR, format);
  const routeTextColor =
    resolved.routeTextColor ?? formatResolvedColor(DEFAULT_ROUTE_TEXT_COLOR, format);

  if (isRouteColorLowContrast) {
    return {
      color: routeTextColor,
      textColor: routeColor,
    };
  }

  return {
    color: routeColor,
    textColor: routeTextColor,
  };
}
