import type { Route } from '../../../types/app/transit';

/**
 * Result of {@link translateRouteName}.
 */
export interface TranslatedRouteNames {
  /** `route_short_name`, translated if available. Currently passed through as-is. */
  shortName: string;
  /** `route_long_name`, translated for the requested language. */
  longName: string;
}

/**
 * Translate the names of a route for a given language.
 *
 * GTFS translations.txt provides translations for `route_long_name`
 * (e.g. "大江戸線" → "Oedo Line"). Looks up the `lang` key in
 * `route.route_names` and falls back to `route_long_name` when the
 * requested language is not available or `lang` is omitted.
 *
 * `route_short_name` has no translations in the current GTFS spec,
 * so it is returned as-is. Both fields may be empty strings
 * depending on the transit type (bus vs train).
 *
 * This is the lowest-level i18n function — it has
 * no knowledge of info levels or display formatting.
 *
 * @param route - The route to translate names for.
 * @param lang - BCP 47-ish language key matching translations.txt
 *               (e.g. `"en"`, `"ja-Hrkt"`). Defaults to primary name.
 * @returns The translated route names.
 */
export function translateRouteName(route: Route, lang?: string): TranslatedRouteNames {
  const translatedLongName = lang ? route.route_names[lang] : undefined;
  return {
    shortName: route.route_short_name,
    longName: translatedLongName ?? route.route_long_name,
  };
}
