/**
 * Translate the display name of a headsign for a given language.
 *
 * Looks up the `headsign_names` record by the `lang` key.
 * Falls back to the raw `headsign` string when the requested
 * language is not available or `lang` is omitted.
 *
 * This is the lowest-level i18n function — it has
 * no knowledge of info levels or display formatting.
 *
 * @param headsign - Raw headsign string from timetable data.
 * @param headsignNames - Headsign translations from GTFS translations.txt
 *   (field_name=trip_headsign). Keyed by language (e.g. "ja", "ja-Hrkt", "en").
 * @param lang - BCP 47-ish language key matching translations.txt
 *               (e.g. `"en"`, `"ja-Hrkt"`). Defaults to primary name.
 * @returns The translated headsign string.
 */
export function translateHeadsign(
  headsign: string,
  headsignNames: Record<string, string>,
  lang?: string,
): string {
  if (lang && headsignNames[lang]) {
    return headsignNames[lang];
  }
  return headsign;
}
