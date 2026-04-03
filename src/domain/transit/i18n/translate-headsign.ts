import type { TranslatableText } from '../../../types/app/transit-composed';

/**
 * Result of {@link translateHeadsign}.
 */
export interface TranslatedHeadsignNames {
  /** trip_headsign resolved for the requested language. */
  tripName: string;
  /** stop_headsign resolved for the requested language. Empty when not provided. */
  stopName: string;
}

/**
 * Translate the headsign names of a RouteDirection for a given language.
 *
 * Resolves both trip_headsign and stop_headsign for the requested language.
 * Falls back to the raw text when the requested language is not available
 * or `lang` is omitted.
 *
 * Follows the same pattern as {@link translateRouteName} which resolves
 * both `route_short_name` and `route_long_name`.
 *
 * This is the lowest-level i18n function — it has
 * no knowledge of info levels, display formatting, or effective
 * headsign selection.
 *
 * @param tripHeadsign - Trip-level headsign with translations.
 * @param stopHeadsign - Stop-level headsign with translations (optional).
 * @param lang - BCP 47-ish language key matching translations.txt
 *               (e.g. `"en"`, `"ja-Hrkt"`). Defaults to primary name.
 * @returns The translated headsign names.
 */
export function translateHeadsign(
  tripHeadsign: TranslatableText,
  stopHeadsign: TranslatableText | undefined,
  lang?: string,
): TranslatedHeadsignNames {
  const tripName = (lang && tripHeadsign.names[lang]) || tripHeadsign.name;
  const stopName = stopHeadsign ? (lang && stopHeadsign.names[lang]) || stopHeadsign.name : '';
  return { tripName, stopName };
}
