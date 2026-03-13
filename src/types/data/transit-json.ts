/**
 * Wire-format types for the pre-built JSON files in public/data/.
 *
 * These represent the pipeline output schema — pre-aggregated and
 * abbreviated for file-size efficiency. {@link GtfsRepository} converts
 * these into application-level domain types (see types/app/transit.ts).
 *
 * Field names are abbreviated to reduce file size:
 *   i = id, n = name, m = names map, a = lat, o = lon, l = location_type / long_name,
 *   s = short_name / start_date, e = end_date, t = route_type / exception_type,
 *   r = route_id, h = headsign, d = days / departures / date,
 *   c = route_color, tc = route_text_color
 */

/** data-source-settings.json */
export interface SourceGroupJson {
  /** Unique group identifier (used as localStorage key). */
  id: string;
  /** Japanese display name for settings UI. */
  name_ja: string;
  /** UI grouping label (e.g. "bus", "train"). */
  category: string;
  /** `public/data/{prefix}/` folder names to load. */
  prefixes: string[];
}

/** stops.json */
export interface StopJson {
  i: string; // stop_id
  n: string; // stop_name
  m: Record<string, string>; // stop_names: language -> translation (all languages)
  a: number; // stop_lat
  o: number; // stop_lon
  l: number; // location_type
}

/** routes.json */
export interface RouteJson {
  i: string; // route_id
  s: string; // route_short_name
  l: string; // route_long_name
  t: number; // route_type
  c: string; // route_color (hex without #, e.g. "F1B34E")
  tc: string; // route_text_color (hex without #)
  m: Record<string, string>; // route_names: language -> translation
  ai: string; // agency_id (prefixed)
}

/** agency.json */
export interface AgencyJson {
  i: string; // agency_id (prefixed)
  n: string; // agency_name
  m: Record<string, string>; // agency_names: language -> translation
  u: string; // agency_url
  l: string; // agency_lang
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

/** translations.json */
export interface TranslationsJson {
  /** trip_headsign -> { language -> translation } */
  headsigns: Record<string, Record<string, string>>;
  /** stop_headsign -> { language -> translation } */
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
}
