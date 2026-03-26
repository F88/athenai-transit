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
 * Metadata about a transit data source identified by its prefix.
 *
 * Aggregates validity and version information from the pipeline output
 * (e.g. feed-info.json for GTFS, dct:issued for ODPT) into a
 * source-type-agnostic structure. The pipeline normalizes these
 * differences so the webapp can treat all sources uniformly.
 */
export interface SourceMeta {
  /** Source identifier (e.g. "minkuru", "kobus"). Corresponds to the data prefix. */
  id: string;
  /** Human-readable source name (e.g. "都バス", "京王バス"). Derived from agency_short_name. */
  name: string;
  /** Data version string (format varies by source). */
  version: string;
  /** Data validity period from feed-info. */
  validity: {
    /** Start date (YYYYMMDD). */
    startDate: string;
    /** End date (YYYYMMDD). */
    endDate: string;
  };
  /** GTFS route_type values present in this source (deduplicated, sorted ascending). */
  routeTypes: RouteType[];
  /** Keywords for search and categorization (e.g. ["コミュニティバス", "深夜バス"]). */
  keywords: string[];
  // /** Operating regions (e.g. ["東京都", "杉並区"]). Requires pipeline region support. */
  // regions: string[];
  /** Summary statistics for this source. */
  stats: {
    /** Number of stops. */
    stopCount: number;
    /** Number of routes. */
    routeCount: number;
  };
}

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
  /**
   * Per-stop operational statistics from InsightsBundle.
   * Undefined when insights data is not loaded.
   * Values are for the current service group (e.g. weekday, Saturday).
   */
  stats?: {
    /** Total departures per day for this service group. */
    freq: number;
    /** Number of distinct routes serving this stop. */
    routeCount: number;
    /** Number of distinct route types (bus, subway, etc.) serving this stop. */
    routeTypeCount: number;
    /** Earliest departure time (minutes from midnight). */
    earliestDeparture: number;
    /** Latest departure time (minutes from midnight). Values >= 1440 = overnight past midnight. */
    latestDeparture: number;
  };
}

/**
 * A stop paired with its route types and upcoming {@link ContextualTimetableEntry} items.
 *
 * Extends {@link StopWithMeta} with departure context.
 * Used by BottomSheet and MapView tooltip to display nearby stop info.
 * When all services have ended, `departures` is an empty array and the UI
 * shows "本日の運行は終了しました".
 *
 * `routeTypes` contains all GTFS route_type values serving this stop,
 * sorted in ascending order (e.g. `[0, 3]` for a tram+bus stop).
 */
export interface StopWithContext extends StopWithMeta {
  routeTypes: RouteType[];
  departures: ContextualTimetableEntry[];
  /**
   * Whether at least one boardable entry exists in the full service day.
   *
   * From {@link TimetableQueryMeta.isBoardableOnServiceDay}. Independent
   * of `departures` (which only contains upcoming entries).
   * A stop with `isBoardableOnServiceDay === false` is drop-off only.
   */
  isBoardableOnServiceDay: boolean;
  /**
   * Geographic metrics from GlobalInsightsBundle.
   * Undefined when global insights data is not loaded.
   */
  geo?: {
    /**
     * Distance (km) to the nearest stop served by a different route.
     * Higher = more isolated (transit desert). 0 = colocated or no alternative.
     */
    nearestRoute: number;
    /**
     * Distance (km) to the nearest stop with a different parent_station.
     * Reveals "walkable portals" between station complexes.
     * Undefined when parent_station data is not available.
     */
    walkablePortal?: number;
    /**
     * Connectivity within 300m radius, keyed by service group (e.g. "ho").
     * Measures transfer convenience across all sources.
     * Undefined when no routes operate within 300m.
     */
    connectivity?: Record<
      string,
      {
        /** Number of unique routes within 300m. */
        routeCount: number;
        /** Sum of unique routes' daily departures. */
        freq: number;
        /** Number of other stops within 300m. */
        stopCount: number;
      }
    >;
  };
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
 * Stop service availability for a specific departure.
 *
 * Describes whether passengers can board (pickup) or alight (drop-off)
 * at a stop for a given departure. Values align with GTFS
 * pickup_type/drop_off_type but are used as app-level domain types.
 *
 * - 0 = available (scheduled service)
 * - 1 = not available
 * - 2 = phone required (must phone agency)
 * - 3 = coordinate required (must coordinate with driver)
 */
export type StopServiceType = 0 | 1 | 2 | 3;

/**
 * A single entry in a stop's timetable.
 *
 * A single entry in a stop's timetable with arrival time,
 * boarding availability, and trip pattern context.
 *
 * Used directly by the timetable modal. NearbyStop uses
 * {@link ContextualTimetableEntry} which extends this with serviceDate.
 */
export interface TimetableEntry {
  /** Schedule: departure and arrival times. */
  schedule: {
    /** Departure minutes from midnight of the service day. */
    departureMinutes: number;
    /** Arrival minutes from midnight of the service day. */
    arrivalMinutes: number;
  };

  /**
   * Route and direction context.
   *
   * TODO: Extract as a composite type (e.g. RouteDirection) — this
   * combination of route + headsign + direction is reused across
   * TimetableEntry and other composed types.
   */
  routeDirection: {
    route: Route;
    headsign: string;
    /** Headsign translations resolved from TranslationsJson. */
    headsign_names: Record<string, string>;
    /**
     * Trip direction (0 or 1). Distinguishes opposite directions on
     * the same route (e.g. inbound vs outbound).
     * Undefined when the source does not provide direction_id.
     */
    direction?: 0 | 1;
  };

  /** Boarding availability at this stop. */
  boarding: {
    /** Pickup (boarding) availability. */
    pickupType: StopServiceType;
    /** Drop-off (alighting) availability. */
    dropOffType: StopServiceType;
  };

  /** Position of this stop within the trip pattern's stop sequence. */
  patternPosition: {
    /** 0-based index of this stop in the pattern. */
    stopIndex: number;
    /** Total number of stops in the pattern. */
    totalStops: number;
    /** Whether this stop is the last stop (terminal). */
    isTerminal: boolean;
    /** Whether this stop is the first stop (origin). */
    isOrigin: boolean;
  };

  /**
   * Analytics derived from InsightsBundle.
   * Undefined when insights data is not loaded.
   */
  insights?: {
    /**
     * Estimated remaining travel time (minutes) from this stop
     * to the terminal.
     */
    remainingMinutes: number;
  };
}

/**
 * Service date context for accurate minutes-to-Date conversion.
 *
 * GTFS departure/arrival times are minutes from midnight (e.g., 1625 = 27:05).
 * To convert to a correct Date, the service date (not wall-clock date) is needed.
 * Without it, overnight entries (>= 1440 min) from the previous service day
 * produce dates 1 day ahead.
 *
 * Defined as an independent interface for reuse across multiple types:
 * {@link ContextualTimetableEntry} (NearbyStop), and future types for
 * route display, trip details, and survival indicators.
 */
export interface WithServiceDate {
  /**
   * GTFS service date this entry belongs to, as midnight (00:00) local time.
   *
   * Date type for consistency with getServiceDay() and minutesToDate(),
   * which both operate on Date. Minutes are added from midnight,
   * so hours >= 24 roll into the next calendar day.
   *
   * Do not mutate — multiple entries may share the same Date instance.
   */
  readonly serviceDate: Date;
}

/**
 * TimetableEntry with service day context for accurate datetime computation.
 *
 * Extends {@link TimetableEntry} with {@link WithServiceDate} to enable
 * correct Date conversion via `minutesToDate(serviceDate, departureMinutes)`.
 * Without serviceDate, overnight entries from the previous service day
 * produce dates 1 day ahead.
 *
 * Returned by `getUpcomingTimetableEntries`. The timetable modal
 * (`getFullDayTimetableEntries`) continues to use plain {@link TimetableEntry}.
 *
 * Follows the naming pattern of {@link StopWithContext} (domain type + contextual metadata).
 */
export interface ContextualTimetableEntry extends TimetableEntry, WithServiceDate {}
