/**
 * Composed transit types for webapp use cases.
 *
 * These types combine the domain types from {@link transit.ts}
 * (Stop, Route, Agency, etc.) with additional context needed by
 * the webapp — spatial metadata, stop time schedules, UI groupings,
 * and other enrichments that do not exist in the pipeline output.
 *
 * Unlike the stable domain types in transit.ts, these types evolve
 * as webapp features change. Adding fields, extending interfaces,
 * or introducing new composed types here is expected and encouraged.
 */

import type { StopServiceState } from './transit';
import type { Agency, Route, AppRouteTypeValue, Stop } from './transit';

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
  routeTypes: AppRouteTypeValue[];
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
 * Reserved for future expansion (e.g. route-level stop times, statistics).
 */
export type RouteWithContext = RouteWithMeta;

/**
 * A stop enriched with metadata from spatial queries and timetable data.
 *
 * Agencies and routes are resolved from timetable data regardless of
 * active stop times, enabling features like route shape highlighting
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
    /** Total stop times per day for this service group. */
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
        /**
         * Operational density within 300m: per-route max stop-time count,
         * summed across unique routes. Counts all `d`-field entries
         * including non-boardable terminal arrivals — this is a measure
         * of how many vehicles operate in the neighborhood, not how many
         * are boardable. See `StopGeoJson.cn[groupKey].freq` in
         * `transit-v2-json.ts` for the canonical definition.
         */
        freq: number;
        /** Number of other stops within 300m. */
        stopCount: number;
      }
    >;
  };
}

/**
 * A stop paired with its route types and upcoming {@link ContextualTimetableEntry} items.
 *
 * Extends {@link StopWithMeta} with stop time context.
 * Used by BottomSheet and MapView tooltip to display nearby stop info.
 * When all services have ended, `stopTimes` is an empty array and the UI
 * shows "本日の運行は終了しました".
 *
 * `routeTypes` contains all GTFS route_type values serving this stop,
 * sorted in ascending order (e.g. `[0, 3]` for a tram+bus stop).
 */
export interface StopWithContext extends StopWithMeta {
  routeTypes: AppRouteTypeValue[];
  stopTimes: ContextualTimetableEntry[];
  /**
   * High-level service state of the stop on the current service day.
   *
   * Derived from `TimetableQueryMeta` via `getStopServiceState(meta)`.
   * Use this field to tell apart `'boardable'`, `'drop-off-only'`, and
   * `'no-service'` when rendering stop labels, filters, or placeholders.
   */
  stopServiceState: StopServiceState;
}

/**
 * Metadata for a stop time view pattern (T1-T7).
 *
 * Each view defines a different grouping/sorting strategy for
 * displaying stop times in the BottomSheet card.
 */
export interface StopTimeViewMeta {
  /** Unique identifier, e.g. 'stop', 'route-headsign'. */
  id: string;
  /** Emoji icon for the toggle button (empty string allowed). */
  icon: string;
  /** i18n key for the short toggle button label. */
  labelKey: string;
  /** i18n key for the short description. */
  titleKey: string;
  /** i18n key for the detailed description. */
  descriptionKey: string;
  /** Whether this view is implemented. false = greyed out, not selectable. */
  enabled: boolean;
  /** Whether this view appears in the UI. false = hidden entirely. */
  visible: boolean;
}

/**
 * Stop service availability for a specific stop time.
 *
 * Describes whether passengers can board (pickup) or alight (drop-off)
 * at a stop for a given stop time. Values align with GTFS
 * pickup_type/drop_off_type but are used as app-level domain types.
 *
 * - 0 = available (scheduled service)
 * - 1 = not available
 * - 2 = phone required (must phone agency)
 * - 3 = coordinate required (must coordinate with driver)
 */
export type StopServiceType = 0 | 1 | 2 | 3;

/**
 * Text value with per-language translations, not yet resolved to a
 * specific language.
 *
 * Used to carry a raw GTFS field value together with its translations
 * from translations.txt. The language resolution is performed by
 * `translateXxx` functions in the i18n layer; this type simply holds
 * the data.
 *
 * Designed as a generic building block — currently used by
 * {@link RouteDirection} for headsign data, but applicable to
 * stop names, route names, and other translatable fields.
 */
export interface TranslatableText {
  /** Original text (raw value from data source). */
  name: string;
  /** Translations keyed by language (e.g. "ja", "en", "ja-Hrkt"). */
  names: Record<string, string>;
}

/**
 * App-internal representation of a trip pattern.
 *
 * Converted from {@link TripPatternJson} (the JSON schema shared with
 * the pipeline) in the Repository layer. This decouples the webapp's
 * business logic from the pipeline's JSON structure, so future changes
 * to TripPatternJson (e.g. adding per-stop attributes) can be absorbed
 * in the Repository without touching downstream consumers.
 */
export interface TripPattern {
  /** Route ID (prefixed). */
  route_id: string;
  /** Trip headsign (GTFS trip_headsign). May be empty. */
  headsign: string;
  /** GTFS direction_id (0 or 1). Undefined when not provided. */
  direction?: 0 | 1;
  /**
   * Ordered per-stop records from origin to destination.
   *
   * Each element bundles stop ID and per-stop attributes from the
   * pipeline's {@link TripPatternJson.stops} object array.
   * JSON short names (`sh`, `sd`) are mapped to descriptive names.
   */
  stops: {
    /** Stop ID (prefixed). */
    id: string;
    /**
     * GTFS `stop_times.stop_headsign` for this stop.
     *
     * Per GTFS spec, overrides the trip-level headsign at this stop.
     * Undefined when not provided by the source.
     */
    headsign?: string;
    /**
     * Cumulative distance along the route shape from origin to this stop.
     *
     * Sourced from GTFS `stop_times.shape_dist_traveled`.
     * Currently not present in any source data; reserved for future use.
     */
    shapeDistTraveled?: number;
  }[];
}

/**
 * Route and direction context for a trip pattern.
 *
 * Combines the route, headsign data (trip-level and stop-level),
 * and direction into a single composite type. Used by
 * {@link TimetableEntry} and {@link ContextualTimetableEntry}.
 *
 * Both `tripHeadsign` and `stopHeadsign` carry their own translations
 * because GTFS translations.txt uses separate `field_name` values
 * (`trip_headsign` vs `stop_headsign`), which may produce different
 * translations for the same text.
 *
 * Effective headsign selection (`stopHeadsign ?? tripHeadsign`) is
 * performed by the display name resolver, not by this type.
 * Follows the same pattern as {@link Route} providing both
 * `route_short_name` and `route_long_name` for the resolver to choose.
 */
export interface RouteDirection {
  /** The route serving this trip pattern. */
  route: Route;
  /**
   * Trip-level headsign (GTFS trip_headsign) with translations.
   * `name` may be empty when the source does not provide trip_headsign.
   */
  tripHeadsign: TranslatableText;
  /**
   * Stop-level headsign (GTFS stop_headsign) with translations.
   * Per GTFS spec, overrides tripHeadsign at a specific stop.
   * Undefined when the source does not provide stop_headsign for this stop.
   */
  stopHeadsign?: TranslatableText;
  /**
   * Trip direction (0 or 1). Distinguishes opposite directions on
   * the same route (e.g. inbound vs outbound).
   * Undefined when the source does not provide direction_id.
   */
  direction?: 0 | 1;
}

/**
 * Internal locator for reconstructing a specific trip instance from runtime timetable data.
 *
 * The runtime app data does not currently expose GTFS `trip_id`, so repositories use this
 * locator to identify one concrete run within a trip pattern.
 */
export interface TripLocator {
  /** Repository-specific trip pattern identifier. */
  patternId: string;
  /** Service identifier used by the timetable arrays. */
  serviceId: string;
  /** Zero-based index into the aligned timetable arrays for this service. */
  tripIndex: number;
}

/** One reconstructed stop-time record inside a trip snapshot. */
export interface TripStopTime {
  /**
   * Enriched stop metadata for this stop-time position when it can be resolved.
   *
   * Optional because trip reconstruction may still succeed even when stop-level
   * metadata cannot be resolved logically from the merged stop index.
   * Consumers must treat this as an enrichment layer and fall back to
   * `timetableEntry` when rendering required trip information.
   */
  stopMeta?: StopWithMeta;

  /** Route types serving this stop, precomputed for UI convenience. */
  routeTypes: AppRouteTypeValue[];

  /**
   * Core stop-time event reconstructed from timetable data.
   *
   * This is the canonical source for schedule, boarding, headsign, and
   * pattern-position fields when `stopMeta` is unavailable.
   */
  timetableEntry: TimetableEntry;
}

/**
 * Reconstructed whole-trip payload for a selected timetable entry.
 *
 * This is an app-level runtime snapshot, not a direct representation of one
 * GTFS `trips.txt` row. The repository rebuilds it from multiple sources:
 *
 * - {@link TripLocator} identifies the concrete runtime trip instance.
 * - {@link WithServiceDate} provides the GTFS service day needed to interpret
 *   minutes-from-midnight values, including overnight trips.
 * - `route`, `tripHeadsign`, and `direction` provide trip-level metadata
 *   derived from the merged route/trip-pattern model.
 * - `stopTimes` contains the per-stop schedule rows reconstructed from
 *   timetable rows and trip pattern positions, with optional stop metadata
 *   enrichment. Rows may be omitted when the repository cannot bind a
 *   pattern entry to the requested `(serviceId, tripIndex)`, so the array
 *   may be empty or sparse — see {@link TripStopTime.timetableEntry}'s
 *   `patternPosition` for the originating stop index.
 *
 * Because this type is reconstructed for app use, it must not be treated as a
 * mirror of GTFS `trips.txt`. Fields that exist in raw GTFS but are not
 * emitted into app-data-v2 (for example `trip_short_name`) will not appear
 * here unless the repository explicitly models them.
 */
export interface TripSnapshot extends WithServiceDate {
  /** Locator used to reconstruct this trip instance. */
  locator: TripLocator;
  /** Route serving this trip. */
  route: Route;
  /** Trip-level headsign with translations. */
  tripHeadsign: TranslatableText;
  /** Direction ID when the source provides one. */
  direction?: 0 | 1;

  /**
   * Per-stop schedule rows reconstructed for this trip.
   *
   * The array is sorted by `timetableEntry.patternPosition.stopIndex`,
   * but it may be empty or sparse: when the repository cannot resolve a
   * pattern entry against the requested `(serviceId, tripIndex)` (no
   * matching service column, out-of-range trip index, etc.), that entry
   * is dropped. Callers must therefore not treat `stopTimes.length` as
   * the pattern's stop count, and should not assume `stopTimes[i]`
   * corresponds to `stopIndex === i`.
   */
  stopTimes: TripStopTime[];
}

/** Reconstructed whole-trip payload enriched with the currently selected stop event. */
export interface SelectedTripSnapshot extends TripSnapshot {
  /** Current stop index of the selected entry. */
  currentStopIndex: number;
  /** Stop-level record corresponding to the clicked entry. */
  selectedStop: TripStopTime;
}

/** Minimal payload required to open trip inspection for a specific stop event. */
export interface TripInspectionTarget extends WithServiceDate {
  /** Locator used to reconstruct the concrete trip instance. */
  tripLocator: TripLocator;
  /** Pattern position of the selected stop within the reconstructed trip. */
  stopIndex: number;
  /**
   * Departure minutes at the selected stop.
   *
   * Added so trip-inspection candidates can be compared and ordered without
   * reloading the source timetable entries.
   */
  departureMinutes: number;
}

/**
 * Minimal query required to list trip-inspection targets at a stop on
 * the current service day. The result is unfiltered: every active trip
 * stopping at `stopId` on `serviceDate` is returned, and the caller is
 * expected to identify the currently selected trip.
 */
export interface TripInspectionGroupQuery extends WithServiceDate {
  /** Physical stop whose departures (across all trips) should be listed. */
  stopId: string;
}

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
  /** Minimal locator for reconstructing the concrete trip instance for this entry. */
  readonly tripLocator: TripLocator;

  /** Schedule: departure and arrival times. */
  schedule: {
    /** Departure minutes from midnight of the service day. */
    departureMinutes: number;
    /** Arrival minutes from midnight of the service day. */
    arrivalMinutes: number;
  };

  /** Route and direction context for this entry. */
  routeDirection: RouteDirection;

  /** Boarding availability at this stop. */
  boarding: {
    /** Pickup (boarding) availability. */
    pickupType: StopServiceType;
    /** Drop-off (alighting) availability. */
    dropOffType: StopServiceType;
  };

  /**
   * Position of this stop within the trip pattern's stop sequence.
   *
   * **Issue #47 / duplicate stop_id within pattern**: For 6-shape and circular
   * routes where the same physical stop_id appears at multiple positions in
   * one pattern, each position is represented by a separate `TimetableEntry`
   * with its own `stopIndex`. Consumers MUST treat these as independent
   * entries and not merge by stop_id alone — `stopIndex` is the unique
   * positional identifier within the pattern.
   *
   * Example: 都営大江戸線 都庁前 in pattern `toaran:p72` produces entries
   * with `stopIndex=0` (origin departure) and `stopIndex=28` (mid-trip
   * pass-through after the loop). Both refer to the same physical stop_id
   * but are distinct boarding events.
   *
   * `stopIndex` corresponds 1:1 to the `si` field on `TimetableGroupV2Json`.
   */
  patternPosition: {
    /** 0-based index of this stop in the pattern (matches `TimetableGroupV2Json.si`). */
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
     * to the terminal. Derived from `InsightsBundle.tripPatternStats.rd[stopIndex]`.
     */
    remainingMinutes: number;
    /**
     * Estimated total travel time (minutes) for the entire trip pattern,
     * from origin to terminal. Derived from
     * `InsightsBundle.tripPatternStats.rd[0]` (the remaining duration at
     * the origin equals the total duration).
     */
    totalMinutes: number;
    /**
     * Total trips per day for this trip pattern in the entry's
     * service group. Derived from
     * `InsightsBundle.tripPatternStats[group][patternId].freq`.
     *
     * Pattern-level: counts each trip once (not once per stop event),
     * so for a 6-shape or circular pattern an entry at the origin and
     * an entry at a mid-pass-through position both report the same
     * value. Distinct from `stopStats.freq`, which counts stop-level
     * events and may double-count duplicate occurrences.
     */
    freq: number;
  };
}

/**
 * Base date context for converting minutes-from-midnight into concrete `Date` values.
 *
 * Timetable values in this app are represented as minutes from the start of a
 * service day, not as standalone wall-clock `Date` objects. This base date is
 * needed to interpret those values correctly, especially for times that roll
 * past midnight into the next calendar day.
 *
 * Defined as an independent interface for reuse across multiple types:
 * {@link ContextualTimetableEntry} (NearbyStop), and future types for
 * route display, trip details, and survival indicators.
 */
export interface WithServiceDate {
  /**
   * Base service-day date for this entry, anchored at local midnight.
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
 * TimetableEntry with base-date context for accurate datetime computation.
 *
 * Extends {@link TimetableEntry} with {@link WithServiceDate} so consumers can
 * turn timetable minutes into concrete `Date` values via
 * `minutesToDate(serviceDate, departureMinutes)`. Without this context,
 * overnight entries can be interpreted against the wrong calendar day.
 *
 * Returned by `getUpcomingTimetableEntries`. The timetable modal
 * (`getFullDayTimetableEntries`) continues to use plain {@link TimetableEntry}.
 *
 * Follows the naming pattern of {@link StopWithContext} (domain type + contextual metadata).
 */
export interface ContextualTimetableEntry extends TimetableEntry, WithServiceDate {}
