/**
 * Inject the base value into a translation names record under its
 * feed language key.
 *
 * GTFS base values (e.g. `trip_headsign`, `stop_name`) are in the
 * language declared by `feed_lang` (feed_info.txt). When
 * `translations.txt` does not provide an explicit entry for that
 * language, the resolver cannot find the base value as a language
 * candidate — causing incorrect fallback to other languages
 * (e.g. English shown when Japanese is expected).
 *
 * This function bridges the gap: if `originLang` is a concrete
 * language code and `names` does not already contain that key, the
 * base value is injected so the resolver treats it as a candidate
 * for that language.
 *
 * Explicit translations (from `translations.txt`) always take
 * priority — if `names` already has a matching key, the record is
 * returned unchanged.
 *
 * ### `"mul"` (multilingual) handling
 *
 * GTFS allows `feed_lang = "mul"` (ISO 639-2) for datasets where
 * original text is in multiple languages (e.g. Switzerland:
 * `Genève`, `Zürich`, `Biel/Bienne` coexist in one feed). In such
 * feeds, base values have no single definable language, and
 * `translations.txt` is expected to supply translations for each
 * language. When `originLang` is `"mul"`, no injection occurs — the
 * base value remains language-unknown and the resolver falls back
 * through the normal priority chain.
 *
 * ### GTFS spec reference
 *
 * - `feed_lang` (feed_info.txt, Required): "Default language used
 *   for the text in this dataset."
 * - `agency_lang` (agency.txt, Optional): "Primary language used by
 *   this transit agency." — a display-settings hint, NOT the
 *   language of text fields.
 * - `translations.txt` `language` field: "If the language is the
 *   same as in `feed_info.feed_lang`, the original value of the
 *   field will be assumed to be the default value to use in
 *   languages without specific translations."
 *
 * @param names - Existing translation entries keyed by language.
 * @param baseValue - The raw GTFS field value (e.g. trip_headsign, stop_name).
 * @param originLang - The language of the base value. Typically
 *   `feed_lang` for most GTFS text fields, or `agency_lang` for
 *   agency-specific fields. When `undefined`, empty, or `"mul"`
 *   (multilingual), no injection occurs.
 * @returns The original `names` if no injection is needed, or a new
 *   record with the base value added under the `originLang` key.
 */
export function injectOriginLang(
  names: Readonly<Record<string, string>>,
  baseValue: string,
  originLang: string | undefined,
): Record<string, string> {
  if (!originLang || originLang.toLowerCase() === 'mul') {
    return names as Record<string, string>;
  }

  // Case-insensitive check: do not overwrite an explicit translation.
  // BCP 47 language tags are case-insensitive (RFC 5646 §2.1.1).
  const originLangLower = originLang.toLowerCase();
  for (const key of Object.keys(names)) {
    if (key.toLowerCase() === originLangLower) {
      return names as Record<string, string>;
    }
  }

  return { ...names, [originLang]: baseValue };
}
