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
 * @param lang - BCP 47-ish language key or ordered fallback chain
 *               (e.g. `"en"`, `["zh-Hant", "zh-Hans", "en"]`).
 *               Defaults to primary name when omitted.
 * @returns The translated stop name string.
 */
export function translateStopName(stop: Stop, lang?: string | readonly string[]): string {
  if (lang) {
    const langs = typeof lang === 'string' ? [lang] : lang;
    const keys = Object.keys(stop.stop_names);
    for (const l of langs) {
      // Case-insensitive match per BCP 47 (RFC 5646 §2.1.1).
      const lLower = l.toLowerCase();
      const key = keys.find((k) => k.toLowerCase() === lLower);
      if (key != null && stop.stop_names[key]) {
        return stop.stop_names[key];
      }
    }
  }
  return stop.stop_name;
}
