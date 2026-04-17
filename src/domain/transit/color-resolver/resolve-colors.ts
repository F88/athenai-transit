import { convertGtfsColor, type GtfsColorFormat } from '../gtfs-color';
import type { OptionalColorPair } from '../../../utils/color-pair';

export function formatResolvedColor(color: string, format: GtfsColorFormat): string {
  return convertGtfsColor(color, format) ?? color;
}

export function formatResolvedColorPair(
  colors: OptionalColorPair,
  format: GtfsColorFormat,
): OptionalColorPair {
  if (!colors.primaryColor && !colors.secondaryColor) {
    return {};
  }

  return {
    primaryColor: colors.primaryColor
      ? formatResolvedColor(colors.primaryColor, format)
      : undefined,
    secondaryColor: colors.secondaryColor
      ? formatResolvedColor(colors.secondaryColor, format)
      : undefined,
  };
}
