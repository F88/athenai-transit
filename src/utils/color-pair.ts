/**
 * Optional pair of related colors used by UI and domain helpers.
 *
 * `primaryColor` and `secondaryColor` are intentionally semantic-light
 * so callers can map them onto route/agency specific names as needed.
 */
export interface OptionalColorPair {
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Return the input unchanged when it is a valid six-digit hex color.
 *
 * @param color - Raw color string without a leading `#`.
 * @returns The original value when it is exactly six hex digits,
 *   otherwise `undefined`.
 */
export function normalizeHexColor(color: string | null | undefined): string | undefined {
  if (!color || !/^[0-9A-Fa-f]{6}$/.test(color)) {
    return undefined;
  }
  return color;
}
