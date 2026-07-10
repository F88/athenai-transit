/**
 * @deprecated v1-only wire-format types, retained for reference only.
 *
 * These stops / routes / agency / shapes / timetable bundle types are the v1
 * pipeline output shape. They are no longer produced or consumed by the v2
 * pipeline or app: v2 defines its own equivalents in `transit-v2-json.ts`, and
 * the shared sections that are unchanged between v1 and v2 (calendar / feed
 * info / translations) live in `transit-json.ts`. The v1 archive docs still
 * refer to these shapes, so they are kept here -- commented out -- rather than
 * deleted, to avoid confusion.
 *
 * Field names are abbreviated to reduce file size:
 *   i = id, n = name, sn = short_name, a = lat, o = lon,
 *   l = location_type / long_name / agency_lang,
 *   s = short_name / start_date, e = end_date, t = route_type,
 *   r = route_id, h = headsign, d = days / departures,
 *   c = route_color, tc = route_text_color, ai = agency_id,
 *   u = url, tz = timezone, fu = fare_url, cs = colors (brand)
 */

// /** stops.json */
// export interface StopJson {
//   i: string; // stop_id
//   n: string; // stop_name
//   a: number; // stop_lat
//   o: number; // stop_lon
//   l: number; // location_type
//   ai: string; // agency_id (prefixed)
// }
//
// /** routes.json */
// export interface RouteJson {
//   i: string; // route_id
//   s: string; // route_short_name
//   l: string; // route_long_name
//   t: number; // route_type
//   c: string; // route_color (hex without #, e.g. "F1B34E")
//   tc: string; // route_text_color (hex without #)
//   ai: string; // agency_id (prefixed)
// }
//
// /** agency.json */
// export interface AgencyJson {
//   i: string; // agency_id (prefixed)
//   n: string; // agency_name (long, default lang)
//   sn: string; // agency_short_name (default lang)
//   u: string; // agency_url
//   l: string; // agency_lang
//   tz: string; // agency_timezone (IANA, e.g. "Asia/Tokyo")
//   fu: string; // agency_fare_url
//   cs: { b: string; t: string }[]; // brand colors: b=background, t=text
// }
//
// /**
//  * shapes.json: route_id -> array of polylines.
//  * Each polyline is an array of [lat, lon] pairs.
//  */
// export type ShapesJson = Record<string, [number, number][][]>;
//
// /** timetable.json: stop_id -> schedule groups */
// export type TimetableJson = Record<string, TimetableGroupJson[]>;
//
// export interface TimetableGroupJson {
//   r: string; // route_id
//   h: string; // trip_headsign
//   d: Record<string, number[]>; // service_id -> sorted departure minutes from midnight
//   ai: string; // agency_id (prefixed)
// }

export {};
