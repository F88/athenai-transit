import type { Agency } from '../../types/app/transit';
import type { ResolvedDisplayNames } from './get-display-names';
import { resolveDisplayNamesWithTranslatableText } from './i18n/resolve-display-names-with-translatable-text';

/**
 * Agency name source type.
 *
 * - `'original'` — agency_name (GTFS canonical) and agency_names
 * - `'short'` — agency_short_name and agency_short_names
 * - `'long'` — agency_long_name and agency_names
 */
export type AgencySource = 'original' | 'short' | 'long';

/**
 * Result of {@link getAgencyDisplayNames}.
 */
export interface AgencyDisplayNames {
  /** Effective agency name resolved by `prefer` strategy. */
  resolved: ResolvedDisplayNames;
  /** Which source was used for `resolved`. */
  resolvedSource: AgencySource;
  /** agency_name (GTFS canonical) resolved with agency_names translations. */
  name: ResolvedDisplayNames;
  /** agency_short_name resolved for the requested language chain. */
  shortName: ResolvedDisplayNames;
  /** agency_long_name resolved for the requested language chain. */
  longName: ResolvedDisplayNames;
}

/**
 * Compute display names for an agency based on preference.
 *
 * Resolves `agency_short_name` and `agency_name` independently via
 * {@link resolveDisplayNamesWithTranslatableText}, then selects the effective
 * one based on `prefer`. Each source keeps its own `subNames`; they are never mixed.
 *
 * @param agency - The agency to compute names for.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary display resolution.
 * @param agencyLangs - Agency languages for subNames sort priority.
 * @param prefer - Which agency source to use as primary. Defaults to `'short'`.
 * @returns Effective agency display names, plus individual short/long resolved names.
 */
export function getAgencyDisplayNames(
  agency: Readonly<Agency>,
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
  prefer: AgencySource = 'short',
): AgencyDisplayNames {
  const name = resolveDisplayNamesWithTranslatableText(
    { name: agency.agency_name, names: agency.agency_names },
    preferredDisplayLangs,
    agencyLangs,
  );
  const shortName = resolveDisplayNamesWithTranslatableText(
    { name: agency.agency_short_name, names: agency.agency_short_names },
    preferredDisplayLangs,
    agencyLangs,
  );
  const longName = resolveDisplayNamesWithTranslatableText(
    { name: agency.agency_long_name, names: agency.agency_long_names },
    preferredDisplayLangs,
    agencyLangs,
  );

  let resolved: ResolvedDisplayNames;
  let resolvedSource: AgencySource;

  switch (prefer) {
    case 'original':
      if (name.name) {
        resolved = name;
        resolvedSource = 'original';
      } else {
        resolved = { name: agency.agency_id, subNames: [] };
        resolvedSource = 'original';
      }
      break;
    case 'long':
      if (longName.name) {
        resolved = longName;
        resolvedSource = 'long';
      } else if (shortName.name) {
        resolved = shortName;
        resolvedSource = 'short';
      } else if (name.name) {
        resolved = name;
        resolvedSource = 'original';
      } else {
        resolved = { name: agency.agency_id, subNames: [] };
        resolvedSource = 'long';
      }
      break;
    case 'short':
      if (shortName.name) {
        resolved = shortName;
        resolvedSource = 'short';
      } else if (longName.name) {
        resolved = longName;
        resolvedSource = 'long';
      } else if (name.name) {
        resolved = name;
        resolvedSource = 'original';
      } else {
        resolved = { name: agency.agency_id, subNames: [] };
        resolvedSource = 'short';
      }
      break;
  }

  return { resolved, resolvedSource, name, shortName, longName };
}

/**
 * Resolves an agency_id to its display name from a list of agencies.
 *
 * Convenience wrapper that looks up the agency by ID, then delegates
 * to {@link getAgencyDisplayNames}.
 *
 * @param agencyId - The agency_id to look up.
 * @param agencies - The list of agencies to search.
 * @param preferredDisplayLangs - Ordered language fallback chain for primary display resolution.
 * @param agencyLangs - Agency languages for subNames sort priority.
 * @param prefer - Which agency source to use as primary. Defaults to `'short'`.
 * @returns The display name, or undefined if not found.
 */
export function resolveAgencyDisplayName(
  agencyId: string,
  agencies: Agency[],
  preferredDisplayLangs: readonly string[],
  agencyLangs: readonly string[],
  prefer: AgencySource = 'short',
): string | undefined {
  const agency = agencies.find((a) => a.agency_id === agencyId);
  return agency
    ? getAgencyDisplayNames(agency, preferredDisplayLangs, agencyLangs, prefer).resolved.name
    : undefined;
}
