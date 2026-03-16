import type { Agency } from '../../../types/app/transit';

/**
 * Result of {@link translateAgencyName}.
 */
export interface TranslatedAgencyName {
  /** Full agency name, translated if available. */
  name: string;
  /** Short agency name, translated if available. Empty string when not present. */
  shortName: string;
}

/**
 * Translate the display names of an agency for a given language.
 *
 * Looks up `agency_names` and `agency_short_names` by `lang` key.
 * Falls back to primary names when the requested language is not
 * available or `lang` is omitted.
 *
 * @param agency - The agency to translate names for.
 * @param lang - BCP 47-ish language key (e.g. `"en"`, `"ja-Hrkt"`).
 * @returns The translated name and short name.
 */
export function translateAgencyName(agency: Agency, lang?: string): TranslatedAgencyName {
  const name = (lang && agency.agency_names[lang]) || agency.agency_name;
  const shortName = (lang && agency.agency_short_names[lang]) || agency.agency_short_name;
  return { name, shortName };
}
