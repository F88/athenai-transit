import type { Agency } from '@/types/app/transit';
import { convertGtfsColor, type GtfsColorFormat } from '../gtfs-color';

/** Agency colors resolved for UI rendering from curated app-side attributes. */
export interface ResolvedAgencyColors {
  /** Resolved primary agency background color. */
  agencyColor?: string;
  /** Resolved text color paired with the primary agency color. */
  agencyTextColor?: string;
}

function normalizeAgencyColor(color: string | null | undefined): string | undefined {
  if (!color || !/^[0-9A-Fa-f]{6}$/.test(color)) {
    return undefined;
  }
  return color;
}

function formatAgencyColor(color: string, format: GtfsColorFormat): string {
  return convertGtfsColor(color, format) ?? color;
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

  const rawAgencyColor = normalizeAgencyColor(primary.bg);
  const rawAgencyTextColor = normalizeAgencyColor(primary.text);

  if (!rawAgencyColor && !rawAgencyTextColor) {
    return {};
  }

  return {
    agencyColor: rawAgencyColor ? formatAgencyColor(rawAgencyColor, format) : undefined,
    agencyTextColor: rawAgencyTextColor ? formatAgencyColor(rawAgencyTextColor, format) : undefined,
  };
}
