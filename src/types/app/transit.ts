/**
 * Transit domain types converted from pipeline wire format.
 *
 * These types correspond to the abbreviated JSON types in
 * {@link types/data/transit-json.ts} (e.g. StopJson -> Stop) with
 * human-readable field names. The conversion is performed by
 * {@link AthenaiRepository.mergeSources} at initialization time.
 *
 * These types are stable and rarely change — they reflect the
 * pipeline's output schema. For webapp-specific composed types
 * (e.g. StopWithMeta, TimetableEntry), see {@link transit-composed.ts}.
 */

/**
 * App-level route type values used across normalized transit sources.
 *
 * The numeric values are based on GTFS `route_type` for interoperability,
 * but this type is not GTFS-only and is not a strict GTFS compliance type.
 * Non-GTFS sources (for example, ODPT JSON) are normalized into this same
 * value space before being consumed by the web app.
 *
 * `-1` is an app-defined "unknown/unresolved" sentinel used when a stop is
 * shown without enough operational context to resolve a concrete route type.
 *
 * 0: tram, 1: subway, 2: rail, 3: bus,
 * 4: ferry, 5: cable tram, 6: gondola, 7: funicular,
 * 11: trolleybus, 12: monorail,
 * -1: unknown/unresolved (app-defined)
 */
export type AppRouteTypeValue = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 11 | 12;

/**
 * Route type metadata used by webapp UI (story, filter labels, and icon previews).
 */
export interface AppRouteType {
  value: AppRouteTypeValue;
  emoji: string;
  color: string;
  label: string;
}

/**
 * Service state derived from a collection of {@link TimetableEntry}.
 *
 * Applicable to any subset of entries — full-day, upcoming, filtered by
 * route/headsign, or any other slice. The meaning depends on the scope
 * of the entries passed to the resolver.
 *
 * - `boardable`: At least one boardable entry exists.
 * - `drop-off-only`: Entries exist but none are boardable.
 * - `no-service`: No entries in the collection.
 */
export type TimetableEntriesState = 'boardable' | 'drop-off-only' | 'no-service';

/**
 * High-level service state of a stop on a given service day.
 *
 * This is a {@link TimetableEntriesState} scoped to a stop's full-day entries.
 *
 * - `boardable`: At least one boardable entry exists today (normal case).
 * - `drop-off-only`: Entries exist but none are boardable.
 * - `no-service`: No entries for this stop today (orphan stop or off-schedule).
 */
export type StopServiceState = TimetableEntriesState;

/**
 * Input signals used to derive a {@link StopServiceState}.
 *
 * Deliberately a narrow structural type (not the full `TimetableQueryMeta`)
 * so the repository can call {@link getStopServiceState} while constructing
 * the meta without a circular type dependency.
 */
export interface StopServiceStateInput {
  /** Whether at least one boardable entry exists in the full service day. */
  isBoardableOnServiceDay: boolean;
  /** Total number of entries in the full service day (pre now/limit filtering). */
  totalEntries: number;
}

/**
 * A boarding location, derived from GTFS-JP stops.txt + translations.txt.
 *
 * `stop_names` is an app-specific field that merges translations.txt
 * entries (ja, ja-Hrkt, en, etc.) into the stop record for efficient lookup.
 * It does not exist in the original GTFS-JP stops.txt schema.
 *
 * GTFS-JP location_type reference:
 *   - 0 (標柱/platform): actual boarding pole referenced by stop_times.
 *   - 1 (停留所/station): parent grouping node (excluded from app data).
 */
export interface Stop {
  stop_id: string;
  stop_name: string;
  /** Merged from translations.txt. Not a GTFS-JP standard field. */
  stop_names: Record<string, string>;
  stop_lat: number;
  stop_lon: number;
  location_type: number; // 0: stop/platform, 1: station
  agency_id: string;

  // --- optional fields (omitted when source does not provide them) ---

  /**
   * GTFS wheelchair_boarding.
   * 0 = no info, 1 = accessible, 2 = not accessible.
   * For child stops (l=0), value 0 inherits from parent_station.
   */
  wheelchair_boarding?: 0 | 1 | 2;
  /**
   * GTFS parent_station — FK to a parent stop (location_type=1).
   * Present on stops that belong to a station complex.
   */
  parent_station?: string;
  /**
   * GTFS platform_code — platform identifier within a station.
   * e.g. "1", "A", "北口".
   */
  platform_code?: string;
}

/**
 * A bus/rail route, derived from GTFS-JP routes.txt.
 *
 * Contains a subset of fields needed for UI display.
 */
export interface Route {
  route_id: string;
  route_type: AppRouteTypeValue;
  agency_id: string;
  route_short_name: string;
  /** Merged from translations.txt. Not a GTFS-JP standard field. */
  route_short_names: Record<string, string>;
  route_long_name: string;
  /** Merged from translations.txt. Not a GTFS-JP standard field. */
  route_long_names: Record<string, string>;
  route_color: string; // hex without #, e.g. "F1B34E"
  route_text_color: string; // hex without #
}

/**
 * A transit agency/operator, derived from GTFS agency.txt + translations.txt.
 */
export interface Agency {
  agency_id: string;
  /** Data source canonical name (GTFS agency_name / ODPT provider). */
  agency_name: string;
  /** Long display name base value (from agency-attributes.ts). */
  agency_long_name: string;
  /** Short display name base value (from agency-attributes.ts). */
  agency_short_name: string;
  /** Multilingual translations of agency_name (GTFS translations.txt). */
  agency_names: Record<string, string>;
  /** Multilingual long display names (from agency-attributes.ts). */
  agency_long_names: Record<string, string>;
  /** Multilingual short display names (from agency-attributes.ts). */
  agency_short_names: Record<string, string>;
  agency_url: string;
  agency_lang: string;
  agency_timezone: string;
  agency_fare_url: string;
  /** Brand colors (from agency-attributes.ts). */
  agency_colors: { bg: string; text: string }[];
}

/**
 * GTFS feed metadata, derived from feed_info.txt.
 *
 * Provides data validity period and version information
 * for freshness checking and display in the UI.
 */
export interface FeedInfo {
  feed_publisher_name: string;
  feed_publisher_url: string;
  feed_lang: string;
  feed_start_date: string; // YYYYMMDD
  feed_end_date: string; // YYYYMMDD
  feed_version: string;
}

/**
 * A single trip/run of a route (GTFS trips.txt).
 *
 * Not currently used at app runtime. Retained as a reference type
 * for the pipeline's input schema.
 */
export interface Trip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
}

/**
 * Arrival/departure time at a stop for a specific trip (GTFS stop_times.txt).
 *
 * Times may exceed "24:00:00" for overnight trips that extend past midnight.
 *
 * Not currently used at app runtime. Retained as a reference type
 * for the pipeline's input schema.
 */
export interface StopTime {
  trip_id: string;
  arrival_time: string; // HH:MM:SS
  departure_time: string; // HH:MM:SS
  stop_id: string;
  stop_sequence: number;
}

/**
 * Service calendar defining which days a service operates (GTFS calendar.txt).
 *
 * Day-of-week fields are 0 or 1. Date range is inclusive on both ends.
 * Exceptions (holidays, special days) are handled by calendar_dates.txt.
 *
 * Not currently used at app runtime. Retained as a reference type
 * for the pipeline's input schema.
 */
export interface Calendar {
  service_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  start_date: string; // YYYYMMDD
  end_date: string; // YYYYMMDD
}
