/**
 * Application-level transit domain types.
 *
 * Based on GTFS-JP input data but extended for app needs.
 * These are NOT direct mirrors of the GTFS-JP schema — some fields
 * are merged or omitted by the data pipeline.
 * Compact JSON representations (types/data/transit-json.ts) are converted into
 * these types during GtfsRepository initialization.
 */

/**
 * GTFS route_type values.
 *
 * 0: tram, 1: subway, 2: rail, 3: bus, 4: ferry,
 * 5: cable tram, 6: gondola, 7: funicular, 11: trolleybus, 12: monorail
 */
export type RouteType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 11 | 12;

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
}

/**
 * A bus/rail route, derived from GTFS-JP routes.txt.
 *
 * Contains a subset of fields needed for UI display.
 */
export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: RouteType;
  route_color: string; // hex without #, e.g. "F1B34E"
  route_text_color: string; // hex without #
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

/**
 * A stop enriched with metadata computed during spatial queries.
 *
 * Returned by `getStopsNearby` to carry computed values (e.g. distance)
 * alongside the base {@link Stop} without mutating the GTFS-derived type.
 */
export interface StopWithMeta {
  stop: Stop;
  /** Distance in meters from the query center point. */
  distance?: number;
}

/**
 * Departures grouped by route and headsign.
 *
 * Each group contains up to 3 upcoming departure times for a specific
 * route + headsign combination at a given stop.
 */
export interface DepartureGroup {
  route: Route;
  headsign: string;
  departures: Date[];
}

/**
 * A stop paired with its route types and upcoming departure groups.
 *
 * Used by BottomSheet and MapView tooltip to display nearby stop info.
 * When all services have ended, `groups` is an empty array and the UI
 * shows "本日の運行は終了しました".
 *
 * `routeTypes` contains all GTFS route_type values serving this stop,
 * sorted in ascending order (e.g. `[0, 3]` for a tram+bus stop).
 */
export interface StopWithContext {
  stop: Stop;
  routeTypes: RouteType[];
  groups: DepartureGroup[];
}

/**
 * Metadata for a departure view pattern (T1-T7).
 *
 * Each view defines a different grouping/sorting strategy for
 * displaying departures in the BottomSheet card.
 */
export interface DepartureViewMeta {
  /** Unique identifier, e.g. 'stop', 'route-headsign'. */
  id: string;
  /** Emoji icon for the toggle button (empty string allowed). */
  icon: string;
  /** Short label for the toggle button (empty string allowed). */
  label: string;
  /** Short description of the view. */
  title: string;
  /** Detailed description of the view. */
  description: string;
  /** Whether this view is implemented. false = greyed out, not selectable. */
  enabled: boolean;
  /** Whether this view appears in the UI. false = hidden entirely. */
  visible: boolean;
}

/**
 * A single departure flattened from {@link DepartureGroup}.
 *
 * Used by the T1 (Stop) view to display all departures in
 * chronological order regardless of route or headsign.
 */
export interface FlatDeparture {
  /** Route this departure belongs to (reference, not a copy). */
  route: Route;
  /** Headsign/destination (reference). */
  headsign: string;
  /** Scheduled departure time (reference). */
  departure: Date;
}
