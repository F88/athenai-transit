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
 * Convert a single GTFS-JP legacy 3-column translation row into a
 * standard 6-column row.
 *
 * Assumption: every legacy row describes a `stops.stop_name` translation.
 * This is verified for the only known consumer (tokai-kisen) and is a
 * safe assumption for the format because the legacy row carries no
 * table/field identifier of its own. If a future source uses the
 * legacy format for other fields, this converter must be extended.
 *
 * Returns `null` when any of the three required fields is empty (the
 * caller can use this to skip the row instead of inserting incomplete
 * data).
 */
export function convertGtfsJpLegacyTranslationRow(legacyRow: {
  trans_id: string;
  lang: string;
  translation: string;
}): StandardTranslationRow | null {
  const transId = legacyRow.trans_id.trim();
  const lang = legacyRow.lang.trim();
  const translation = legacyRow.translation.trim();

  if (transId === '' || lang === '' || translation === '') {
    return null;
  }

  return {
    table_name: 'stops',
    field_name: 'stop_name',
    language: normalizeGtfsJpLegacyLanguageCode(lang),
    translation,
    field_value: transId,
  };
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
