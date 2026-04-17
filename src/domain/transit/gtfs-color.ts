/** Return format for GTFS color values. */
export type GtfsColorFormat = 'raw' | 'css-hex';

/**
 * Convert a GTFS Color field value into the requested representation.
 *
 * GTFS `Color` values are six-digit hexadecimal strings without a
 * leading `#`. UI code often needs the same value as a CSS color.
 * This helper keeps that representation change in one place.
 *
 * @param color - GTFS color value such as `FFFFFF`. Empty values are
 *   returned as `undefined` so callers can decide whether to apply a
 *   field-specific default.
 * @param format - Desired output representation.
 * @returns GTFS raw hex or CSS-ready `#RRGGBB`, or `undefined` when
 *   the input is empty.
 */
export function convertGtfsColor(
  color: string | null | undefined,
  format: GtfsColorFormat,
): string | undefined {
  if (!color) {
    return undefined;
  }
  if (format === 'css-hex') {
    return `#${color}`;
  }
  return color;
}
