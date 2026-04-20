import type { Route } from '@/types/app/transit';
import type { CssColor, GtfsColor, GtfsColorFormat } from '../../../types/app/gtfs-color';
import { suggestTextColor } from '../../../utils/color/color-contrast';
import type { ColorPair } from '../../../utils/color/color-pair';
import {
  formatResolvedColorPair,
  hasLowContrastBetweenGtfsColors,
  normalizeGtfsColor,
  normalizeOptionalGtfsColor,
  resolveGtfsColor,
} from './resolve-gtfs-color';

/** GTFS default route color when `route_color` is omitted. */
const DEFAULT_ROUTE_COLOR = '333333' as GtfsColor;
/** GTFS default text color when `route_text_color` is omitted. */
const DEFAULT_ROUTE_TEXT_COLOR = 'F1F1F1' as GtfsColor;
/** Only correct route/text pairs whose direct contrast ratio is below 1.2. */
const NORMALIZED_ROUTE_COLOR_PAIR_MIN_RATIO = 1.2;

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

/**
 * Normalized route colors formatted for the requested output representation.
 *
 * When `format` is `'raw'`, fields remain GTFS Color values. When
 * `format` is `'css-hex'`, fields become CSS-ready `#RRGGBB` strings.
 */
export interface FormattedNormalizedRouteColors<TColor = string> {
  /** Normalized route color in the requested representation. */
  routeColor: TColor;
  /** Normalized route text color in the requested representation. */
  routeTextColor: TColor;
}

/** Route colors resolved for UI rendering before theme-specific adjustment. */
export interface ResolvedRouteColors<TColor = string> {
  /** Resolved route fill color. Undefined when GTFS provides no usable route color. */
  routeColor?: TColor;
  /** Resolved route text color. Undefined when no usable text color can be resolved. */
  routeTextColor?: TColor;
}

function toRawTextFallback(routeColor: GtfsColor): GtfsColor {
  return suggestTextColor(resolveGtfsColor(routeColor, 'css-hex')) === 'white'
    ? ('FFFFFF' as GtfsColor)
    : ('000000' as GtfsColor);
}

/**
 * Normalize raw GTFS route color fields into concrete fallback-safe values.
 *
 * Invalid values are treated the same as omitted values. The route color
 * is fixed first and then preserved. The route text color is normalized
 * independently and only adjusted when the resulting pair has severely
 * low contrast.
 *
 * @param routeColor - Raw GTFS `route_color` value.
 * @param routeTextColor - Raw GTFS `route_text_color` value.
 * @returns Concrete raw GTFS colors without a leading `#`.
 */
export function normalizeRouteGtfsColors(
  routeColor: string | null | undefined,
  routeTextColor: string | null | undefined,
): NormalizedRouteGtfsColors {
  const normalizedRouteColor = normalizeGtfsColor(routeColor, DEFAULT_ROUTE_COLOR);
  let normalizedRouteTextColor = normalizeGtfsColor(routeTextColor, DEFAULT_ROUTE_TEXT_COLOR);

  if (
    hasLowContrastBetweenGtfsColors(
      normalizedRouteTextColor,
      normalizedRouteColor,
      NORMALIZED_ROUTE_COLOR_PAIR_MIN_RATIO,
    )
  ) {
    normalizedRouteTextColor = toRawTextFallback(normalizedRouteColor);
  }

  return {
    routeColor: normalizedRouteColor,
    routeTextColor: normalizedRouteTextColor,
  };
}

function resolveRawRouteTextColor(
  rawRouteColor: GtfsColor | undefined,
  explicitRawRouteTextColor: GtfsColor | undefined,
): GtfsColor | undefined {
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
): ColorPair<GtfsColor> {
  const rawRouteColor = normalizeOptionalGtfsColor(route.route_color);
  const explicitRawRouteTextColor = normalizeOptionalGtfsColor(route.route_text_color);

  return {
    primaryColor: rawRouteColor,
    secondaryColor: resolveRawRouteTextColor(rawRouteColor, explicitRawRouteTextColor),
  };
}

function toResolvedRouteColors<TColor>(colors: ColorPair<TColor>): ResolvedRouteColors<TColor> {
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
): ResolvedRouteColors<GtfsColor | CssColor> {
  const rawColors = resolveRawRouteColorPair(route);

  if (format === 'css-hex') {
    return toResolvedRouteColors(formatResolvedColorPair(rawColors, 'css-hex'));
  }

  return toResolvedRouteColors(formatResolvedColorPair(rawColors, 'raw'));
}

/**
 * Normalize route colors from a Route-like object and format them for UI use.
 *
 * @param route - Route colors from GTFS (`route_color` and `route_text_color`).
 * @param format - Output format. `'raw'` returns GTFS-style hex without `#`;
 *   `'css-hex'` returns CSS-ready `#RRGGBB` strings.
 * @returns Concrete normalized route colors in the requested representation.
 */
export function normalizeResolvedRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  format: GtfsColorFormat = 'raw',
): FormattedNormalizedRouteColors<GtfsColor | CssColor> {
  const normalized = normalizeRouteGtfsColors(route.route_color, route.route_text_color);

  if (format === 'css-hex') {
    return {
      routeColor: resolveGtfsColor(normalized.routeColor, 'css-hex'),
      routeTextColor: resolveGtfsColor(normalized.routeTextColor, 'css-hex'),
    };
  }

  return {
    routeColor: resolveGtfsColor(normalized.routeColor, 'raw'),
    routeTextColor: resolveGtfsColor(normalized.routeTextColor, 'raw'),
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
export function getAdjustedRouteColors(
  route: Pick<Route, 'route_color' | 'route_text_color'>,
  isRouteColorLowContrast: boolean,
  format: GtfsColorFormat = 'raw',
): AdjustedRouteColors<GtfsColor | CssColor> {
  const { routeColor, routeTextColor } =
    format === 'css-hex'
      ? normalizeResolvedRouteColors(route, 'css-hex')
      : normalizeResolvedRouteColors(route, 'raw');

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
