import { convertGtfsColor, type GtfsColorFormat } from '../gtfs-color';

/** Normalized raw GTFS-like color pair before output formatting. */
export interface RawColorPair {
  primaryColor?: string;
  secondaryColor?: string;
}

/** Shared formatted color pair used by color resolvers. */
export interface ResolvedColorPair {
  primaryColor?: string;
  secondaryColor?: string;
}

export function normalizeRawColor(color: string | null | undefined): string | undefined {
  if (!color || !/^[0-9A-Fa-f]{6}$/.test(color)) {
    return undefined;
  }
  return color;
}

export function formatResolvedColor(color: string, format: GtfsColorFormat): string {
  return convertGtfsColor(color, format) ?? color;
}

export function formatResolvedColorPair(
  colors: RawColorPair,
  format: GtfsColorFormat,
): ResolvedColorPair {
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
