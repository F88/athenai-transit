import type { Stop } from '../../../types/app/transit';

/**
 * Translate the display name of a stop for a given language.
 *
 * Looks up the stop's `stop_names` record by the `lang` key.
 * Falls back to `stop_name` (the GTFS primary name) when
 * the requested language is not available or `lang` is omitted.
 *
 * This is the lowest-level i18n function — it has
 * no knowledge of info levels or display formatting.
 *
 * @param stop - The stop to translate a name for.
 * @param lang - BCP 47-ish language key matching translations.txt
 *               (e.g. `"en"`, `"ja-Hrkt"`). Defaults to primary name.
 * @returns The translated stop name string.
 */
export function translateStopName(stop: Stop, lang?: string): string {
  if (lang && stop.stop_names[lang]) {
    return stop.stop_names[lang];
  }
  return stop.stop_name;
}
