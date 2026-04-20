import type { CssColor, GtfsColor, GtfsColorFormat } from '../../../types/app/gtfs-color';
import { isEmptyColorPair, mapColorPair, type ColorPair } from '../../../utils/color/color-pair';
import { getContrastAssessment } from '../../../utils/color/color-contrast';

/** Default color used when a GTFS Color value is missing or invalid. */
export const DEFAULT_GTFS_COLOR = '333333' as GtfsColor;

function asGtfsColor(value: string): GtfsColor {
  return value as GtfsColor;
}

function asCssColor(value: string): CssColor {
  return value as CssColor;
}

/**
 * Normalize a GTFS Color into an optional canonical GTFS Color value.
 *
 * Valid GTFS Color values are trimmed and uppercased. Missing or
 * invalid inputs return `undefined`.
 *
 * @param color - Raw GTFS Color value without a leading `#`.
 * @returns An uppercase GTFS Color value, or `undefined` when the input is missing or invalid.
 */
export function normalizeOptionalGtfsColor(
  color: string | null | undefined,
): GtfsColor | undefined {
  if (!color) {
    return undefined;
  }

  const trimmed = color.trim();
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return undefined;
  }

  return asGtfsColor(trimmed.toUpperCase());
}

/**
 * Normalize a GTFS Color into a concrete canonical GTFS Color value.
 *
 * Valid GTFS Color values are trimmed and uppercased. Missing or
 * invalid inputs fall back to `defaultColor`.
 *
 * @param color - Raw GTFS Color value without a leading `#`.
 * @param defaultColor - Fallback GTFS Color to use when `color` is missing or invalid.
 * @returns A concrete uppercase GTFS Color value.
 */
export function normalizeGtfsColor(
  color: string | null | undefined,
  defaultColor: GtfsColor,
): GtfsColor {
  return normalizeOptionalGtfsColor(color) ?? defaultColor;
}

/**
 * Format a normalized GTFS Color into the requested representation.
 *
 * The input must already be a canonical GTFS Color value: six
 * uppercase hexadecimal digits without a leading `#`.
 *
 * @param normalizedGtfsColor - Canonical GTFS Color value such as `FFFFFF`.
 * @param format - Desired output representation.
 * @returns GTFS raw hex or CSS-ready `#RRGGBB`.
 */
export function resolveGtfsColor(normalizedGtfsColor: GtfsColor, format: 'raw'): GtfsColor;
export function resolveGtfsColor(normalizedGtfsColor: GtfsColor, format: 'css-hex'): CssColor;
export function resolveGtfsColor(
  normalizedGtfsColor: GtfsColor,
  format: GtfsColorFormat,
): GtfsColor | CssColor;
export function resolveGtfsColor(
  normalizedGtfsColor: GtfsColor,
  format: GtfsColorFormat,
): GtfsColor | CssColor {
  if (format === 'css-hex') {
    return asCssColor(`#${normalizedGtfsColor}`);
  }

  return normalizedGtfsColor;
}

/**
 * Determine whether a concrete GTFS color pair has severely low contrast.
 *
 * Both inputs are expected to already be concrete GTFS colors without a
 * leading `#`, such as `000000` or `FFFFFF`.
 *
 * @param primaryColor - First concrete GTFS color.
 * @param secondaryColor - Second concrete GTFS color.
 * @param minRatio - Threshold below which the pair is considered low contrast.
 * @returns `true` when the color pair is below the given contrast threshold.
 */
export function hasLowContrastBetweenGtfsColors(
  primaryColor: GtfsColor,
  secondaryColor: GtfsColor,
  minRatio: number,
): boolean {
  return getContrastAssessment(
    resolveGtfsColor(primaryColor, 'css-hex'),
    resolveGtfsColor(secondaryColor, 'css-hex'),
    minRatio,
  ).isLowContrast;
}

/**
 * Format an optional GTFS Color pair in the requested representation.
 *
 * Missing colors remain `undefined`. Present colors are assumed to be
 * normalized GTFS Color values and are formatted via
 * {@link resolveGtfsColor}.
 *
 * @param colors - Optional GTFS Color pair.
 * @param format - Desired output representation.
 * @returns The pair formatted in the requested representation.
 */
export function formatResolvedColorPair(
  colors: ColorPair<GtfsColor>,
  format: GtfsColorFormat,
): ColorPair<GtfsColor | CssColor> {
  if (isEmptyColorPair(colors)) {
    return {};
  }

  return mapColorPair<GtfsColor, GtfsColor | CssColor>(colors, (color) =>
    resolveGtfsColor(color, format),
  );
}
