import type { Agency } from '@/types/app/transit';
import type { CssColor, GtfsColor, GtfsColorFormat } from '../../../types/app/gtfs-color';
import type { ColorPair } from '../../../utils/color/color-pair';
import { formatResolvedColorPair, normalizeOptionalGtfsColor } from './resolve-gtfs-color';

/** Agency colors resolved for UI rendering from curated app-side attributes. */
export interface ResolvedAgencyColors<TColor = string> {
  /** Resolved primary agency background color. */
  agencyColor?: TColor;
  /** Resolved text color paired with the primary agency color. */
  agencyTextColor?: TColor;
}

function toResolvedAgencyColors<TColor>(colors: ColorPair<TColor>): ResolvedAgencyColors<TColor> {
  return {
    agencyColor: colors.primaryColor,
    agencyTextColor: colors.secondaryColor,
  };
}

/**
 * Resolve the agency's primary curated brand color pair.
 *
 * Agency colors come from app-side curated attributes, not GTFS route
 * metadata. The primary pair is preserved as-is after validation; no
 * same-color special handling or fallback derivation is applied here.
 */
export function resolveAgencyColors(
  agency: Pick<Agency, 'agency_colors'>,
  format: GtfsColorFormat = 'raw',
): ResolvedAgencyColors<GtfsColor | CssColor> {
  const primary = agency.agency_colors[0];
  if (!primary) {
    return {};
  }

  const rawAgencyColor = normalizeOptionalGtfsColor(primary.bg);
  const rawAgencyTextColor = normalizeOptionalGtfsColor(primary.text);
  const rawColors = {
    primaryColor: rawAgencyColor,
    secondaryColor: rawAgencyTextColor,
  } satisfies ColorPair<GtfsColor>;

  if (format === 'css-hex') {
    return toResolvedAgencyColors(formatResolvedColorPair(rawColors, 'css-hex'));
  }

  return toResolvedAgencyColors(formatResolvedColorPair(rawColors, 'raw'));
}
