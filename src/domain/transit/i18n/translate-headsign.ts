/**
 * Translate the display name of a headsign for a given language.
 *
 * Currently a passthrough — returns the raw headsign string as-is.
 * When headsign translations are added to the data pipeline
 * (translations.txt field_name=trip_headsign), this function will
 * look up a `headsign_names` record by the `lang` key, following
 * the same pattern as {@link translateStopName} and {@link translateRouteName}.
 *
 * This is the lowest-level i18n function — it has
 * no knowledge of info levels or display formatting.
 *
 * @param headsign - Raw headsign string from timetable data.
 * @param lang - BCP 47-ish language key (future use).
 * @returns The translated headsign string.
 */
export function translateHeadsign(headsign: string, lang?: string): string {
  // Headsign translations are not yet available in the data pipeline.
  // When headsign_names (Record<string, string>) is added to the
  // timetable data, this will look up by lang key like translateStopName.
  void lang;
  return headsign;
}
