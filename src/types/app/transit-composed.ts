/**
 * Composed transit types for webapp use cases.
 *
 * These types combine the domain types from {@link transit.ts}
 * (Stop, Route, Agency, etc.) with additional context needed by
 * the webapp — spatial metadata, departure schedules, UI groupings,
 * and other enrichments that do not exist in the pipeline output.
 *
 * Unlike the stable domain types in transit.ts, these types evolve
 * as webapp features change. Adding fields, extending interfaces,
 * or introducing new composed types here is expected and encouraged.
 */

import type { Agency, Route, RouteType, Stop } from './transit';

/**
 * A route enriched with its agency metadata.
 */
export interface RouteWithMeta {
  route: Route;
  agency: Agency;
}

/**
 * A route paired with its agency and additional context.
 * Reserved for future expansion (e.g. route-level departures, statistics).
 */
export type RouteWithContext = RouteWithMeta;

/**
 * A stop enriched with metadata from spatial queries and timetable data.
 *
 * Agencies and routes are resolved from timetable data regardless of
 * active departures, enabling features like route shape highlighting
 * even when all services have ended for the day.
 */
export interface StopWithMeta {
  stop: Stop;
  /** Distance in meters from the query center point. */
  distance?: number;
  /** Agencies operating routes at this stop, resolved from timetable data. */
  agencies: Agency[];
  /** Routes serving this stop, resolved from timetable data (shared references, not copies). */
  routes: Route[];
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
  /** Headsign translations resolved from TranslationsJson. */
  headsign_names: Record<string, string>;
  departures: Date[];
}

/**
 * A stop paired with its route types and upcoming departure groups.
 *
 * Extends {@link StopWithMeta} with departure context.
 * Used by BottomSheet and MapView tooltip to display nearby stop info.
 * When all services have ended, `groups` is an empty array and the UI
 * shows "本日の運行は終了しました".
 *
 * `routeTypes` contains all GTFS route_type values serving this stop,
 * sorted in ascending order (e.g. `[0, 3]` for a tram+bus stop).
 */
export interface StopWithContext extends StopWithMeta {
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
 * A single departure in a full-day stop timetable.
 *
 * Returned by {@link TransitRepository.getFullDayDeparturesForStop}
 * and used directly by the timetable modal.
 */
export interface FullDayStopDeparture {
  /** Minutes from midnight of the service day. */
  minutes: number;
  route: Route;
  headsign: string;
  /** Headsign translations resolved from TranslationsJson. */
  headsign_names: Record<string, string>;
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

/**
 * Metadata about a transit data source identified by its prefix.
 *
 * Aggregates validity and version information from the pipeline output
 * (e.g. feed-info.json for GTFS, dct:issued for ODPT) into a
 * source-type-agnostic structure. The pipeline normalizes these
 * differences so the webapp can treat all sources uniformly.
 */
export interface SourceMeta {
  /** Source identifier (e.g. "minkuru", "kobus"). */
  prefix: string;
  /** Data validity start date (YYYYMMDD). */
  startDate: string;
  /** Data validity end date (YYYYMMDD). */
  endDate: string;
  /** Data version string. */
  version: string;
}
