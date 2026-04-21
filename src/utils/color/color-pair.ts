/**
 * Optional pair of related colors used by UI and domain helpers.
 *
 * `primaryColor` and `secondaryColor` are intentionally semantic-light
 * so callers can map them onto route/agency specific names as needed.
 */
export interface ColorPair<TColor = string> {
  primaryColor?: TColor;
  secondaryColor?: TColor;
}

/**
 * Map each present color in a pair while preserving missing members.
 *
 * @param colors - Source color pair.
 * @param mapColor - Mapper applied to each present member.
 * @returns A new pair with mapped color values.
 */
export function mapColorPair<TInputColor, TOutputColor>(
  colors: ColorPair<TInputColor>,
  mapColor: (color: TInputColor, role: keyof ColorPair<TInputColor>) => TOutputColor,
): ColorPair<TOutputColor> {
  return {
    primaryColor:
      colors.primaryColor !== undefined ? mapColor(colors.primaryColor, 'primaryColor') : undefined,
    secondaryColor:
      colors.secondaryColor !== undefined
        ? mapColor(colors.secondaryColor, 'secondaryColor')
        : undefined,
  };
}
