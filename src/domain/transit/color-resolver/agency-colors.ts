import type { Agency } from '@/types/app/transit';
import type { GtfsColorFormat } from '../gtfs-color';
import {
  formatResolvedColorPair,
  normalizeRawColor,
  type ResolvedColorPair,
} from './resolve-colors';

/** Agency colors resolved for UI rendering from curated app-side attributes. */
export interface ResolvedAgencyColors {
  /** Resolved primary agency background color. */
  agencyColor?: string;
  /** Resolved text color paired with the primary agency color. */
  agencyTextColor?: string;
}

function toResolvedAgencyColors(colors: ResolvedColorPair): ResolvedAgencyColors {
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
): ResolvedAgencyColors {
  const primary = agency.agency_colors[0];
  if (!primary) {
    return {};
  }

  const rawAgencyColor = normalizeRawColor(primary.bg);
  const rawAgencyTextColor = normalizeRawColor(primary.text);
  const resolved = formatResolvedColorPair(
    {
      primaryColor: rawAgencyColor,
      secondaryColor: rawAgencyTextColor,
    },
    format,
  );

  return toResolvedAgencyColors(resolved);
}
