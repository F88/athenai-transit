/**
 * Wire-format types for the pre-built JSON files in public/data/.
 *
 * These represent the pipeline output schema — pre-aggregated and
 * abbreviated for file-size efficiency. {@link GtfsRepository} converts
 * these into application-level domain types (see types/app/transit.ts).
 *
 * Field names are abbreviated to reduce file size:
 *   i = id, n = name, sn = short_name, a = lat, o = lon,
 *   l = location_type / long_name / agency_lang,
 *   s = short_name / start_date, e = end_date, t = route_type / exception_type,
 *   r = route_id, h = headsign, d = days / departures / date,
 *   c = route_color, tc = route_text_color, ai = agency_id,
 *   tz = timezone, fu = fare_url, cs = colors (brand)
 */

/** stops.json */
export interface StopJson {
  i: string; // stop_id
  n: string; // stop_name
  a: number; // stop_lat
  o: number; // stop_lon
  l: number; // location_type
  ai: string; // agency_id (prefixed)
}

/** routes.json */
export interface RouteJson {
  i: string; // route_id
  s: string; // route_short_name
  l: string; // route_long_name
  t: number; // route_type
  c: string; // route_color (hex without #, e.g. "F1B34E")
  tc: string; // route_text_color (hex without #)
  ai: string; // agency_id (prefixed)
}

/** agency.json */
export interface AgencyJson {
  i: string; // agency_id (prefixed)
  n: string; // agency_name (long, default lang)
  sn: string; // agency_short_name (default lang)
  u: string; // agency_url
  l: string; // agency_lang
  tz: string; // agency_timezone (IANA, e.g. "Asia/Tokyo")
  fu: string; // agency_fare_url
  cs: { b: string; t: string }[]; // brand colors: b=background, t=text
}

/** feed-info.json */
export interface FeedInfoJson {
  pn: string; // feed_publisher_name
  pu: string; // feed_publisher_url
  l: string; // feed_lang
  s: string; // feed_start_date "YYYYMMDD"
  e: string; // feed_end_date "YYYYMMDD"
  v: string; // feed_version
}

/**
 * translations.json — per-source translations extracted from
 * `translations.txt` (GTFS) or the equivalent ODPT dictionaries.
 *
 * Each field is a Map from a primary key to a per-language translation
 * record. The primary key shape depends on the field — see individual
 * field comments. Languages use BCP 47 codes as they appear in the
 * upstream `translations.txt` (e.g. `ja`, `en`, `ja-Hrkt`, `zh-Hans`).
 *
 * All fields are required. Sources without translations for a given
 * field emit an empty object (`{}`) rather than omitting the field,
 * so consumers do not need optional-chaining for the field itself.
 */
export interface TranslationsJson {
  /**
   * agency_id -> { language -> translation of `agency_name` }.
   *
   * Key is the **prefixed** agency_id (e.g. `kcbus:2000020261009`),
   * matching `AgencyV2Json.i`. Built from rows where
   * `translations.table_name = 'agency'` and
   * `translations.field_name = 'agency_name'`.
   */
  agency_names: Record<string, Record<string, string>>;

  /**
   * route_id -> { language -> translation of `route_long_name` }.
   *
   * Key is the **prefixed** route_id (e.g. `toaran:6`), matching
   * `RouteV2Json.i`. Built from rows where
   * `translations.table_name = 'routes'` and
   * `translations.field_name = 'route_long_name'`.
   *
   * Per GTFS spec `route_short_name` and `route_long_name` are both
   * first-class fields (one is required when the other is empty),
   * so this lives alongside {@link route_short_names} as an equal
   * peer rather than under a generic `route_names` umbrella.
   */
  route_long_names: Record<string, Record<string, string>>;

  /**
   * route_id -> { language -> translation of `route_short_name` }.
   *
   * Key is the **prefixed** route_id, same shape as
   * {@link route_long_names}. Built from rows where
   * `translations.table_name = 'routes'` and
   * `translations.field_name = 'route_short_name'`.
   *
   * Some feeds (e.g. kyoto-city-bus, keio-bus) translate the short
   * name (`市バス1` → `1 City Bus`) but not the long name; this
   * field captures that.
   */
  route_short_names: Record<string, Record<string, string>>;

  /**
   * stop_id -> { language -> translation of `stop_name` }.
   *
   * Key is the **prefixed** stop_id (e.g. `minkuru:0241-01`),
   * matching `StopV2Json.i`. Built from rows where
   * `translations.table_name = 'stops'` and
   * `translations.field_name = 'stop_name'`. Includes all
   * `location_type` values (the v2 pipeline does not filter to
   * platforms only).
   */
  stop_names: Record<string, Record<string, string>>;

  /**
   * trip_headsign text -> { language -> translation }.
   *
   * Keyed by the **headsign text itself** (not by trip_id), so
   * every trip that uses the same headsign string shares one entry.
   * Built from rows where `translations.table_name = 'trips'` and
   * `translations.field_name = 'trip_headsign'`, joined back to
   * `trips` to recover the headsign text when the row only
   * references `record_id`.
   *
   * Naming: this is the trip_headsign translations map; paired with
   * {@link stop_headsigns} for the stop_headsign override.
   */
  trip_headsigns: Record<string, Record<string, string>>;

  /**
   * stop_headsign text -> { language -> translation }.
   *
   * Keyed by the headsign text. `stop_headsign` is a per-stop_time
   * override of the trip-level headsign (used when a trip changes
   * destination mid-route, etc.) — this captures the translations
   * for those override strings.
   */
  stop_headsigns: Record<string, Record<string, string>>;
}

/** calendar.json */
export interface CalendarJson {
  services: CalendarServiceJson[];
  exceptions: CalendarExceptionJson[];
}

export interface CalendarServiceJson {
  i: string; // service_id
  d: number[]; // [mon,tue,wed,thu,fri,sat,sun] 0 or 1
  s: string; // start_date "YYYYMMDD"
  e: string; // end_date "YYYYMMDD"
}

export interface CalendarExceptionJson {
  i: string; // service_id
  d: string; // date "YYYYMMDD"
  t: number; // exception_type (1=added, 2=removed)
}

/**
 * shapes.json: route_id -> array of polylines.
 * Each polyline is an array of [lat, lon] pairs.
 */
export type ShapesJson = Record<string, [number, number][][]>;

/** timetable.json: stop_id -> schedule groups */
export type TimetableJson = Record<string, TimetableGroupJson[]>;

export interface TimetableGroupJson {
  r: string; // route_id
  h: string; // trip_headsign
  d: Record<string, number[]>; // service_id -> sorted departure minutes from midnight
  ai: string; // agency_id (prefixed)
}
