/**
 * Extract TranslationsJson from GTFS SQLite database (v2).
 *
 * Same structure as v1 — TranslationsJson is an unchanged section.
 * Logic copied from v1 extractTranslations with minor cleanup.
 */

import type Database from 'better-sqlite3';

import type { TranslationsJson } from '../../../../../../src/types/data/transit-json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a map of record_key -> { language -> translation } from translation rows.
 * Supports both GTFS-JP (record_id-based) and standard GTFS (field_value-based).
 */
function buildNamesMap(
  rows: Array<{ key: string; language: string; translation: string }>,
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    let names = map.get(row.key);
    if (!names) {
      names = {};
      map.set(row.key, names);
    }
    names[row.language] = row.translation;
  }
  return map;
}

/**
 * Build a lookup map from translation rows: { text: { lang: translation } }.
 */
function buildTranslationMap(
  rows: Array<{ headsign_text: string; language: string; translation: string }>,
): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!map[row.headsign_text]) {
      map[row.headsign_text] = {};
    }
    map[row.headsign_text][row.language] = row.translation;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Extract translations from the GTFS database.
 *
 * Only GTFS translations.txt data is extracted. Provider-derived
 * display names (long/short) are managed on the App side.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @returns TranslationsJson with prefixed IDs.
 */
export function extractTranslationsV2(db: Database.Database, prefix: string): TranslationsJson {
  // trip_headsign translations
  const tripHeadsignRows = db
    .prepare(
      `SELECT DISTINCT COALESCE(tr.trip_headsign, t.field_value) as headsign_text,
        t.language, t.translation
       FROM translations t
       LEFT JOIN trips tr ON t.record_id IS NOT NULL AND tr.trip_id = t.record_id
       WHERE t.table_name = 'trips' AND t.field_name = 'trip_headsign'
         AND COALESCE(tr.trip_headsign, t.field_value) IS NOT NULL`,
    )
    .all() as Array<{ headsign_text: string; language: string; translation: string }>;

  const tripHeadsigns = buildTranslationMap(tripHeadsignRows);

  // stop_headsign translations
  const stopHeadsignRows = db
    .prepare(
      `SELECT DISTINCT COALESCE(st.stop_headsign, t.field_value) as headsign_text,
        t.language, t.translation
       FROM translations t
       LEFT JOIN stop_times st ON t.record_id IS NOT NULL
         AND st.trip_id = t.record_id
         AND CAST(st.stop_sequence AS TEXT) = t.record_sub_id
       WHERE t.table_name = 'stop_times' AND t.field_name = 'stop_headsign'
         AND COALESCE(st.stop_headsign, t.field_value) IS NOT NULL`,
    )
    .all() as Array<{ headsign_text: string; language: string; translation: string }>;

  const stopHeadsigns = buildTranslationMap(stopHeadsignRows);

  // stop_name translations (keyed by prefixed stop_id)
  // v2: no location_type filter — include all stops
  const stopNameRows = db
    .prepare(
      `SELECT s.stop_id, t.language, t.translation
       FROM translations t
       JOIN stops s ON (
         s.stop_id = t.record_id
         OR (t.record_id IS NULL AND s.stop_name = t.field_value)
       )
       WHERE t.table_name = 'stops'
         AND t.field_name = 'stop_name'`,
    )
    .all() as Array<{ stop_id: string; language: string; translation: string }>;

  const stopNamesMap = buildNamesMap(
    stopNameRows.map((r) => ({ key: r.stop_id, language: r.language, translation: r.translation })),
  );
  const stopNames: Record<string, Record<string, string>> = {};
  for (const [stopId, names] of stopNamesMap) {
    stopNames[`${prefix}:${stopId}`] = names;
  }

  // route_long_name translations (keyed by prefixed route_id)
  const routeLongNameRows = db
    .prepare(
      `SELECT r.route_id, t.language, t.translation
       FROM translations t
       JOIN routes r ON (r.route_id = t.record_id
         OR (t.record_id IS NULL AND r.route_long_name = t.field_value))
       WHERE t.table_name = 'routes' AND t.field_name = 'route_long_name'`,
    )
    .all() as Array<{ route_id: string; language: string; translation: string }>;

  const routeLongNamesMap = buildNamesMap(
    routeLongNameRows.map((r) => ({
      key: r.route_id,
      language: r.language,
      translation: r.translation,
    })),
  );
  const routeLongNames: Record<string, Record<string, string>> = {};
  for (const [routeId, names] of routeLongNamesMap) {
    routeLongNames[`${prefix}:${routeId}`] = names;
  }

  // route_short_name translations (keyed by prefixed route_id)
  const routeShortNameRows = db
    .prepare(
      `SELECT r.route_id, t.language, t.translation
       FROM translations t
       JOIN routes r ON (r.route_id = t.record_id
         OR (t.record_id IS NULL AND r.route_short_name = t.field_value))
       WHERE t.table_name = 'routes' AND t.field_name = 'route_short_name'`,
    )
    .all() as Array<{ route_id: string; language: string; translation: string }>;

  const routeShortNamesMap = buildNamesMap(
    routeShortNameRows.map((r) => ({
      key: r.route_id,
      language: r.language,
      translation: r.translation,
    })),
  );
  const routeShortNames: Record<string, Record<string, string>> = {};
  for (const [routeId, names] of routeShortNamesMap) {
    routeShortNames[`${prefix}:${routeId}`] = names;
  }

  // agency_name translations (keyed by prefixed agency_id)
  const agencyNameRows = db
    .prepare(
      `SELECT a.agency_id, t.language, t.translation
       FROM translations t
       JOIN agency a ON (a.agency_id = t.record_id
         OR (t.record_id IS NULL AND a.agency_name = t.field_value))
       WHERE t.table_name = 'agency' AND t.field_name = 'agency_name'`,
    )
    .all() as Array<{ agency_id: string; language: string; translation: string }>;

  const agencyNamesMap = buildNamesMap(
    agencyNameRows.map((r) => ({
      key: r.agency_id,
      language: r.language,
      translation: r.translation,
    })),
  );
  // agency_names: GTFS translations for the canonical agency_name
  const agencyNames: Record<string, Record<string, string>> = {};
  for (const [agencyId, names] of agencyNamesMap) {
    agencyNames[`${prefix}:${agencyId}`] = { ...names };
  }

  const tripHeadsignCount = Object.keys(tripHeadsigns).length;
  const stopHeadsignCount = Object.keys(stopHeadsigns).length;
  const stopNameCount = Object.keys(stopNames).length;
  const routeLongNameCount = Object.keys(routeLongNames).length;
  const routeShortNameCount = Object.keys(routeShortNames).length;
  const agencyNameCount = Object.keys(agencyNames).length;
  console.log(
    `  [${prefix}] translations: ${tripHeadsignCount} trip_headsigns, ${stopHeadsignCount} stop_headsigns, ${stopNameCount} stop_names, ${routeLongNameCount} route_long_names, ${routeShortNameCount} route_short_names, ${agencyNameCount} agency_names`,
  );

  return {
    agency_names: agencyNames,
    route_long_names: routeLongNames,
    route_short_names: routeShortNames,
    stop_names: stopNames,
    trip_headsigns: tripHeadsigns,
    stop_headsigns: stopHeadsigns,
  };
}
