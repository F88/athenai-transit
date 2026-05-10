/**
 * Pure converters that bridge non-standard GTFS CSV row shapes to the
 * standard schema used by the build-gtfs-db.ts importer.
 *
 * No I/O, no DB. Each function is a value-in / value-out transform so
 * callers can compose, test, and swap formats without spinning up a
 * SQLite instance. Companion to `pipeline/src/lib/pipeline/gtfs-csv-parser.ts`
 * (which handles RFC 4180 line splitting).
 */

// ---------------------------------------------------------------------------
// translations.txt — legacy GTFS-JP 3-column form
// ---------------------------------------------------------------------------

/**
 * Standard GTFS translations row produced by conversion.
 *
 * `record_id` and `record_sub_id` are intentionally omitted because
 * legacy rows never carry them; the standard pattern of `field_value`
 * matching is used instead so the translation applies to every row in
 * `table_name` whose `field_name` value equals `field_value`.
 */
export interface StandardTranslationRow {
  table_name: string;
  field_name: string;
  language: string;
  translation: string;
  field_value: string;
}

/**
 * Headers of the GTFS-JP legacy 3-column translations.txt format,
 * exact-match in this order. Any deviation should fall back to the
 * standard 6-column importer (or fail loudly).
 */
export const GTFS_JP_LEGACY_TRANSLATION_HEADERS = ['trans_id', 'lang', 'translation'] as const;

/**
 * Detect whether a translations.txt header row matches the GTFS-JP
 * legacy 3-column form (`trans_id, lang, translation`). The match is
 * strict on length and column order so that any drift surfaces as a
 * clear mismatch rather than silently misinterpreting columns.
 */
export function isGtfsJpLegacyTranslationsHeader(headers: readonly string[]): boolean {
  if (headers.length !== GTFS_JP_LEGACY_TRANSLATION_HEADERS.length) {
    return false;
  }
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] !== GTFS_JP_LEGACY_TRANSLATION_HEADERS[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Translatable (table, field) pairs that a legacy GTFS-JP 3-column
 * translation row can target. Listed in classify priority order — an
 * emitted row appears in this order when a single `trans_id` matches
 * multiple tables.
 *
 * Source: GTFS Static spec text-translatable fields
 * (https://gtfs.org/documentation/schedule/reference/). Limited to
 * tables/fields that are translatable per spec; non-translatable
 * columns (IDs, lat/lon, timestamps, codes) are excluded.
 */
export const GTFS_TRANSLATABLE_FIELDS: readonly { table: string; field: string }[] = [
  { table: 'agency', field: 'agency_name' },
  { table: 'agency', field: 'agency_url' },
  { table: 'agency', field: 'agency_fare_url' },
  { table: 'agency', field: 'agency_email' },
  { table: 'agency', field: 'agency_phone' },
  { table: 'stops', field: 'stop_name' },
  { table: 'stops', field: 'tts_stop_name' },
  { table: 'stops', field: 'stop_desc' },
  { table: 'stops', field: 'stop_url' },
  { table: 'stops', field: 'platform_code' },
  { table: 'routes', field: 'route_short_name' },
  { table: 'routes', field: 'route_long_name' },
  { table: 'routes', field: 'route_desc' },
  { table: 'routes', field: 'route_url' },
  { table: 'trips', field: 'trip_headsign' },
  { table: 'trips', field: 'trip_short_name' },
  { table: 'stop_times', field: 'stop_headsign' },
  { table: 'feed_info', field: 'feed_publisher_name' },
  { table: 'feed_info', field: 'feed_publisher_url' },
  { table: 'feed_info', field: 'feed_contact_email' },
  { table: 'feed_info', field: 'feed_contact_url' },
  { table: 'pathways', field: 'signposted_as' },
  { table: 'pathways', field: 'reversed_signposted_as' },
  { table: 'levels', field: 'level_name' },
  { table: 'attributions', field: 'organization_name' },
  { table: 'attributions', field: 'attribution_url' },
  { table: 'attributions', field: 'attribution_email' },
  { table: 'attributions', field: 'attribution_phone' },
] as const;

/**
 * Lookup sets used by `convertGtfsJpLegacyTranslationRow` to classify a
 * legacy `trans_id` value across every translatable (table, field)
 * pair listed in {@link GTFS_TRANSLATABLE_FIELDS}.
 *
 * `byTableField` keys use the format `${table}.${field}` (e.g.
 * `stops.stop_name`, `routes.route_long_name`). Each value is the set
 * of distinct CSV values for that column in the same feed.
 *
 * Missing keys (file or column not present in the feed) are treated as
 * empty sets — the caller does not need to populate every entry; only
 * the ones it can produce from the source CSVs.
 */
export interface GtfsJpLegacyTranslationSets {
  byTableField: Map<string, Set<string>>;
}

/**
 * Convert a single GTFS-JP legacy 3-column translation row into zero or
 * more standard 6-column rows.
 *
 * The legacy 3-column form (`trans_id, lang, translation`) carries no
 * table/field identifier of its own; the only information about which
 * GTFS column the translation applies to is the literal value of
 * `trans_id`. This converter implements the value-based interpretation
 * of the spec: a translation row applies to **every** translatable
 * column whose value equals `trans_id`. That is, the same row may
 * legitimately produce multiple standard rows when the same string
 * appears in more than one table — for example, a terminal stop name
 * that also appears verbatim as a `trip_headsign` or `stop_headsign`.
 *
 * Classification: each (table, field) in
 * {@link GTFS_TRANSLATABLE_FIELDS} is checked in declared order; one
 * standard row is emitted for every set that contains `trans_id`. The
 * order of emitted rows matches the order in
 * `GTFS_TRANSLATABLE_FIELDS` so callers and tests have a stable shape.
 *
 * Returns an **empty array** when:
 * - any of the three required fields is empty (malformed row), or
 * - the `trans_id` does not match any of the provided lookup sets
 *   (orphan row — the source feed declares a translation for a value
 *   that does not appear in the feed's other CSVs).
 *
 * The caller can use `result.length === 0` to skip the row, and may
 * distinguish malformed vs. orphan by re-checking the input fields.
 */
export function convertGtfsJpLegacyTranslationRow(
  legacyRow: {
    trans_id: string;
    lang: string;
    translation: string;
  },
  sets: GtfsJpLegacyTranslationSets,
): StandardTranslationRow[] {
  const transId = legacyRow.trans_id.trim();
  const lang = legacyRow.lang.trim();
  const translation = legacyRow.translation.trim();

  if (transId === '' || lang === '' || translation === '') {
    return [];
  }

  const normalizedLang = normalizeGtfsJpLegacyLanguageCode(lang);
  const out: StandardTranslationRow[] = [];
  for (const { table, field } of GTFS_TRANSLATABLE_FIELDS) {
    const set = sets.byTableField.get(`${table}.${field}`);
    if (set !== undefined && set.has(transId)) {
      out.push({
        table_name: table,
        field_name: field,
        language: normalizedLang,
        translation,
        field_value: transId,
      });
    }
  }
  return out;
}

/**
 * Normalize legacy GTFS-JP language code variants to BCP 47 form.
 *
 * BCP 47 specifies that script subtags (the 4-letter codes after the
 * primary language tag, e.g. `Hrkt` for Hiragana/Katakana) use Title
 * Case (first letter uppercase, rest lowercase). The legacy `ja-HrKt`
 * mixes case and is non-conforming; map it to the canonical
 * `ja-Hrkt`.
 *
 * Unknown values are returned unchanged so that future, conformant
 * codes pass through without surprise.
 */
export function normalizeGtfsJpLegacyLanguageCode(lang: string): string {
  switch (lang) {
    case 'ja-HrKt':
      return 'ja-Hrkt';
    default:
      return lang;
  }
}
