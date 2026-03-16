import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { translateAgencyName } from './i18n/translate-agency-name';

/**
 * Result of {@link getAgencyDisplayNames}.
 */
export interface AgencyDisplayNames {
  /** Primary display name (short name preferred, falls back to full name). */
  name: string;
}

/**
 * Compute the display name for an agency based on info level and language.
 *
 * Prefers `agency_short_name` for compact display, falling back to
 * `agency_name` when short name is empty. Translates via
 * {@link translateAgencyName} when a language key is provided.
 *
 * @param agency - The agency to compute names for.
 * @param infoLevel - Current info verbosity level.
 * @param lang - Optional language key for i18n translation.
 * @returns The resolved display name.
 */
export function getAgencyDisplayNames(
  agency: Agency,
  infoLevel: InfoLevel,
  lang?: string,
): AgencyDisplayNames {
  const translated = translateAgencyName(agency, lang);
  const name = translated.shortName || translated.name || agency.agency_id;
  void infoLevel; // Reserved for future level-specific name formatting
  return { name };
}

/**
 * Resolves an agency_id to its display name from a list of agencies.
 *
 * Convenience wrapper that looks up the agency by ID, then delegates
 * to {@link getAgencyDisplayNames}.
 *
 * @param agencyId - The agency_id to look up.
 * @param agencies - The list of agencies to search.
 * @param infoLevel - Current info verbosity level.
 * @param lang - Optional language key for i18n translation.
 * @returns The display name, or undefined if not found.
 */
export function resolveAgencyDisplayName(
  agencyId: string,
  agencies: Agency[],
  infoLevel: InfoLevel,
  lang?: string,
): string | undefined {
  const agency = agencies.find((a) => a.agency_id === agencyId);
  return agency ? getAgencyDisplayNames(agency, infoLevel, lang).name : undefined;
}
