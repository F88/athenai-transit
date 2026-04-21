import type { Route } from '@/types/app/transit';
import type { CssColor, GtfsColor, GtfsColorFormat } from '../../../types/app/gtfs-color';
import { NORMALIZED_COLOR_PAIR_MIN_RATIO } from './contrast-thresholds';
import { suggestTextColor } from '../../../utils/color/color-contrast';
import {
  hasLowContrastBetweenGtfsColors,
  normalizeGtfsColor,
  resolveGtfsColor,
} from './resolve-gtfs-color';

/** GTFS default route color when `route_color` is omitted. */
const DEFAULT_ROUTE_COLOR = '666666' as GtfsColor;
/** GTFS default text color when `route_text_color` is omitted. */
const DEFAULT_ROUTE_TEXT_COLOR = 'EEEEEE' as GtfsColor;

/** Adjusted route badge colors for the current theme context. */
export interface AdjustedRouteColors<TColor = string> {
  /** Primary route color to use for fills / strokes. */
  color: TColor;
  /** Text color paired with {@link color}. */
  textColor: TColor;
}

/**
 * Normalized route colors with defaults applied as concrete GTFS Color values.
 *
 * All fields use the GTFS Color type representation: six hexadecimal
 * digits without a leading `#`.
 *
 * This type is used at repository-load time so downstream code can
 * rely on concrete GTFS Color values even when the source feed omits
 * or invalidly encodes `route_color` / `route_text_color`.
 */
export interface NormalizedRouteGtfsColors {
  /** Normalized `route_color` as a GTFS Color value. */
  routeColor: GtfsColor;
  /** Normalized `route_text_color` as a GTFS Color value. */
  routeTextColor: GtfsColor;
}

/** Concrete route colors formatted for UI rendering. */
export interface ResolvedRouteColors<TColor = string> {
  /** Resolved route fill color. */
  routeColor: TColor;
  /** Resolved route text color paired with {@link routeColor}. */
  routeTextColor: TColor;
}

function toRawTextFallback(routeColor: GtfsColor): GtfsColor {
  return suggestTextColor(resolveGtfsColor(routeColor, 'css-hex')) === 'white'
    ? ('FFFFFF' as GtfsColor)
    : ('000000' as GtfsColor);
}

/**
 * Normalize raw GTFS route color fields into concrete GTFS Color values.
 *
 * Invalid values are treated the same as omitted values.
 * `route_color` is normalized first and then preserved as-is.
 * `route_text_color` is normalized with a default value, and is only
 * replaced when the resulting pair is nearly indistinguishable
 * (contrast ratio < 1.2). In that case, the text color is corrected
 * to either `FFFFFF` or `000000` based on the normalized route color.
 *
 * @param routeColor - Raw GTFS `route_color` value.
 * @param routeTextColor - Raw GTFS `route_text_color` value.
 * @returns Concrete raw GTFS colors without a leading `#`.
 */
export function normalizeRouteGtfsColors(
  routeColor: string | null | undefined,
  routeTextColor: string | null | undefined,
): NormalizedRouteGtfsColors {
  // Preserve the normalized route color once chosen; only the text side may be corrected.
  const normalizedRouteColor = normalizeGtfsColor(routeColor, DEFAULT_ROUTE_COLOR);
  let normalizedRouteTextColor = normalizeGtfsColor(routeTextColor, DEFAULT_ROUTE_TEXT_COLOR);

  // Only repair pairs that are almost indistinguishable in their raw GTFS form.
  if (
    hasLowContrastBetweenGtfsColors(
      normalizedRouteTextColor,
      normalizedRouteColor,
      NORMALIZED_COLOR_PAIR_MIN_RATIO,
    )
  ) {
    // Use a plain black/white fallback so the route badge remains readable.
    normalizedRouteTextColor = toRawTextFallback(normalizedRouteColor);
  }

  return {
    routeColor: normalizedRouteColor,
    routeTextColor: normalizedRouteTextColor,
  };
}

/**
 * Resolve route colors into a concrete semantic route/text pair for UI use.
 *
 * This API is intended for app-level {@link Route} objects whose route colors
 * have already been normalized by the repository layer. It still defensively
 * normalizes the incoming values so callers receive a concrete pair even if a
 * route object is malformed or constructed outside the repository.
 */
export function resolveRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  format: GtfsColorFormat = 'raw',
): ResolvedRouteColors<GtfsColor | CssColor> {
  const normalizedColors = normalizeRouteGtfsColors(route.route_color, route.route_text_color);

  if (format === 'css-hex') {
    return {
      routeColor: resolveGtfsColor(normalizedColors.routeColor, 'css-hex'),
      routeTextColor: resolveGtfsColor(normalizedColors.routeTextColor, 'css-hex'),
    };
  }

  return {
    routeColor: resolveGtfsColor(normalizedColors.routeColor, 'raw'),
    routeTextColor: resolveGtfsColor(normalizedColors.routeTextColor, 'raw'),
  };
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
export function getContrastAdjustedRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  isRouteColorLowContrast: boolean,
  format: GtfsColorFormat = 'raw',
): AdjustedRouteColors<GtfsColor | CssColor> {
  const { routeColor, routeTextColor } = resolveRouteColors(route, format);

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
