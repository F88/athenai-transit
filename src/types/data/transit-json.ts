/**
 * Wire-format types for the pre-built JSON files in public/data/.
 *
 * These represent the pipeline output schema — pre-aggregated and
 * abbreviated for file-size efficiency. {@link GtfsRepository} converts
 * these into application-level domain types (see types/app/transit.ts).
 *
 * Field names are abbreviated to reduce file size:
 *   i = id, n = name, a = lat, o = lon, l = location_type / long_name,
 *   s = short_name / start_date, e = end_date, t = route_type / exception_type,
 *   r = route_id, h = headsign, d = days / departures / date,
 *   c = route_color, tc = route_text_color, ai = agency_id
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

/** translations.json */
export interface TranslationsJson {
  /** trip_headsign -> { language -> translation } */
  headsigns: Record<string, Record<string, string>>;
  /** stop_headsign -> { language -> translation } */
  stop_headsigns: Record<string, Record<string, string>>;
  /** stop_id -> { language -> translation } */
  stop_names: Record<string, Record<string, string>>;
  /** route_id -> { language -> translation } */
  route_names: Record<string, Record<string, string>>;
  /** agency_id -> { language -> translation } */
  agency_names: Record<string, Record<string, string>>;
  /** agency_id -> { language -> short name translation } */
  agency_short_names: Record<string, Record<string, string>>;
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
