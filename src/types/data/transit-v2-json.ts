/**
 * Wire-format types for the next-generation pipeline output (v2).
 *
 * This file defines the target schema for the data JSON redesign.
 * The v1 types in transit-json.ts remain in use until the pipeline
 * and repository are migrated.
 *
 * ## v1 → v2 Summary
 *
 * ### Changed files
 *
 * | File           | Changes                                                |
 * | -------------- | ------------------------------------------------------ |
 * | routes.json    | + `desc` (route_desc). `route_url` moved to urls.json  |
 * | stops.json     | - `ai` removed. + `wb`, `pc`. `desc` in lookup.json    |
 * | shapes.json    | Point tuple `[lat, lon]` → `[lat, lon, dist?]`         |
 * | timetable.json | `r,h,ai` → `tp` (pattern FK). + `a`, `p?`, `do?`       |
 *
 * ### New files
 *
 * | File               | Purpose                                            |
 * | ------------------ | -------------------------------------------------- |
 * | trip-patterns.json | Route + headsign + direction + ordered stop list    |
 * | lookup.json        | Normalized lookup tables (URLs, descriptions, etc.) |
 *
 * ### Unchanged (import from transit-json.ts)
 *
 * agency.json, calendar.json, translations.json, feed-info.json
 *
 * ### Removed fields
 *
 * | File        | Field | Reason                                         |
 * | ----------- | ----- | ---------------------------------------------- |
 * | stops.json  | `ai`  | GTFS spec: stops have no agency_id              |
 * | routes.json | `u`   | Moved to urls.json for normalization            |
 * | timetable   | `r`   | Replaced by `tp` → TripPatternJson.r            |
 * | timetable   | `h`   | Replaced by `tp` → TripPatternJson.h            |
 * | timetable   | `ai`  | Replaced by `tp` → TripPatternJson.r → Route.ai |
 *
 * ### GTFS fields reviewed and excluded
 *
 * - trips.wheelchair_accessible — all sources: uniform value, per-departure
 *   array would be wasteful. Revisit if per-trip variation appears.
 * - trips.block_id — vehicle continuity info, outside app scope.
 * - stops.zone_id — fare calculation only.
 * - All jp_ extensions (agency_jp, office_jp, pattern_jp) — administrative
 *   data, deprecated in GTFS-JP v4.
 */

// -----------------------------------------------------------------------
// routes.json (v2)
// -----------------------------------------------------------------------

/**
 * routes.json (v2): versioned wrapper with route records.
 *
 * Compared to v1, adds `desc` (route_desc). route_url is moved
 * to urls.json for normalization.
 */
export interface RoutesV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  routes: RouteV2Json[];
}

export interface RouteV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  i: string;  // route_id
  s: string;  // route_short_name
  l: string;  // route_long_name
  t: number;  // route_type
  c: string;  // route_color (hex without #, e.g. "F1B34E")
  tc: string; // route_text_color (hex without #)
  ai: string; // agency_id (prefixed)
  /**
   * GTFS route_desc — description of the route.
   * Omitted when the source does not provide route_desc.
   */
  desc?: string;
  // route_url moved to urls.json
}

// -----------------------------------------------------------------------
// stops.json (v2)
// -----------------------------------------------------------------------

/**
 * stops.json (v2): versioned wrapper with stop records.
 *
 * Compared to v1, `ai` (agency_id) is removed. GTFS spec does not
 * define agency_id on stops.txt — stops are shared infrastructure.
 * Stop-to-agency relationships are resolved at runtime via
 * timetable -> trip pattern -> route -> agency.
 */
export interface StopsV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  stops: StopV2Json[];
}

export interface StopV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  i: string; // stop_id (prefixed)
  n: string; // stop_name
  a: number; // stop_lat
  o: number; // stop_lon
  l: number; // location_type
  // ai removed — GTFS stops.txt has no agency_id

  // stop_desc moved to lookup.json (stopDescs)

  /**
   * GTFS wheelchair_boarding.
   * 0 = no info, 1 = accessible, 2 = not accessible.
   * For child stops, 0 inherits from parent_station.
   * Omitted when the source does not provide wheelchair_boarding.
   */
  wb?: number;

  // parent_station excluded — parent (location_type=1) is not output
  // to JSON, so the FK reference would be broken. Revisit if parent
  // stops are added to the output.

  /**
   * GTFS platform_code — platform/pole identifier (e.g. "1", "2").
   * Omitted when the source does not provide platform_code.
   */
  pc?: string;
}

// -----------------------------------------------------------------------
// shapes.json (v2)
// -----------------------------------------------------------------------

/**
 * shapes.json (v2): route_id -> array of polylines with optional
 * cumulative distance.
 *
 * Each shape point is a tuple of `[lat, lon]` or `[lat, lon, dist]`.
 * The optional third element is GTFS shape_dist_traveled — the actual
 * distance traveled along the shape from the first point to this point.
 *
 * When present, shape_dist_traveled enables:
 * - Partial shape rendering (highlight only the segment a trip covers)
 * - Travel distance calculation for a trip pattern
 * - Disambiguation of overlapping segments on looping/inlining routes
 *
 * Currently no GTFS sources in this project provide shape_dist_traveled,
 * so all points use the `[lat, lon]` form. The type supports both forms
 * so the pipeline can populate distance data when sources provide it.
 *
 * @see GTFS spec shapes.txt — shape_dist_traveled field
 */
/**
 * A single shape point: `[lat, lon]` or `[lat, lon, dist]`.
 * The optional third element is GTFS shape_dist_traveled.
 */
export type ShapePointV2 = [number, number, number?];

export interface ShapesV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  /**
   * Route ID (prefixed) -> array of polylines.
   * A route may have multiple polylines when different trips on the
   * same route follow different geographic paths (distinct shape_ids).
   * Each polyline is an array of shape points ordered by
   * shape_pt_sequence. Consumers MUST NOT re-sort this array.
   */
  shapes: Record<string, ShapePointV2[][]>;
}

// -----------------------------------------------------------------------
// trip-patterns.json
// -----------------------------------------------------------------------

/**
 * trip-patterns.json: pattern_id -> trip pattern metadata.
 *
 * A trip pattern represents a unique combination of route, headsign,
 * direction, and ordered stop sequence. Multiple trips (departures)
 * share the same pattern when they follow the same stops in the same
 * order.
 *
 * Pattern IDs are generated by the pipeline and are only guaranteed
 * to be consistent within a single build. All JSON files from the
 * same build are referentially consistent.
 *
 * Generated by the pipeline from:
 * - GTFS: derived by grouping trips with identical stop_sequences
 * - ODPT: derived from stationOrder + destinationStation
 *
 * Derivable information (not stored, computed by consumers):
 * - Origin stop: `stops[0]`
 * - Terminal stop: `stops[stops.length - 1]`
 * - Number of stops: `stops.length`
 * - Circular route: `stops[0] === stops[stops.length - 1]`
 * - Whether a stop is on this pattern: `stops.includes(stopId)`
 * - Stop position in pattern: `stops.indexOf(stopId)`
 *
 * Agency is not stored here — resolve via `r` -> RouteJson.ai.
 * GTFS spec defines route:agency as 1:1 (routes.txt.agency_id).
 */
export interface TripPatternsJson {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  /** pattern_id -> trip pattern metadata */
  patterns: Record<string, TripPatternJson>;
}

export interface TripPatternJson {
  /** Schema version. Must be `2` for this format. */
  v: 2;

  /**
   * Route ID (prefixed). FK -> routes.json.
   * All trips in this pattern belong to this route.
   */
  r: string;

  /**
   * Trip headsign (destination display text from GTFS trip_headsign).
   *
   * May be empty when the GTFS source does not provide trip_headsign
   * (e.g. keio-bus). In that case, consumers can derive a display
   * name from the terminal stop: `stops[stops.length - 1]` ->
   * StopJson.n or translations.
   */
  h: string;

  /**
   * GTFS direction_id (0 or 1).
   *
   * Distinguishes trips that share the same route and headsign but
   * travel in opposite directions. Required for circular routes
   * such as the Oedo Line, where both inner and outer loops have
   * the same headsign ("都庁前") but different stop sequences.
   *
   * Omitted when the source does not provide direction_id (e.g. ODPT).
   * GTFS spec: "should not be used in routing; provides a way to
   * separate trips by direction when publishing time tables."
   */
  dir?: number;

  /**
   * Ordered stop IDs (prefixed) from origin to destination.
   *
   * - `stops[0]` is the first stop (origin).
   * - `stops[stops.length - 1]` is the terminal.
   * - The order represents the actual stop sequence of the trip.
   * - Consumers MUST NOT re-sort this array.
   *
   * Derived from GTFS stop_times (ORDER BY stop_sequence) or
   * ODPT stationOrder filtered by destinationStation.
   */
  stops: string[];

  /**
   * Cumulative distance along the route shape per stop, parallel
   * to {@link stops}: `sd[i]` is the distance from the origin to
   * `stops[i]` along the shape.
   *
   * Sourced from GTFS stop_times.txt shape_dist_traveled.
   * Units are consistent with ShapesV2Json point distances.
   *
   * Together with ShapesV2Json's per-point distances, this enables
   * partial shape rendering: to highlight the segment from stop A
   * to stop B, scan the shape point array for the distance range
   * `[sd[a], sd[b]]`. This works correctly even on looping routes
   * where the vehicle crosses the same coordinates twice, because
   * the distance values are monotonically increasing.
   *
   * Also derivable: total pattern distance (`sd[sd.length - 1]`)
   * and inter-stop distance (`sd[i+1] - sd[i]`).
   *
   * Omitted when the source does not provide shape_dist_traveled.
   */
  sd?: number[];
}

// -----------------------------------------------------------------------
// timetable.json (v2)
// -----------------------------------------------------------------------

/**
 * timetable.json (v2): versioned wrapper with stop_id -> schedule groups.
 *
 * Each group references a trip pattern and contains departure/arrival
 * times keyed by service_id. A single stop may have multiple groups
 * for the same route+headsign when different trip patterns pass
 * through it (e.g. 宿91 新宿駅西口行き has 3 patterns with different
 * origins). Consumers that need route+headsign grouping (e.g.
 * DepartureGroup) must re-aggregate across patterns.
 */
export interface TimetableV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  /** stop_id -> schedule groups */
  stops: Record<string, TimetableGroupV2Json[]>;
}

export interface TimetableGroupV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;

  /**
   * Trip pattern ID. FK -> trip-patterns.json.
   * Resolves to route_id, headsign, direction, and stop sequence.
   * Agency is further resolved via TripPatternJson.r -> RouteJson.ai.
   */
  tp: string;

  /**
   * Service ID -> sorted departure minutes from midnight.
   * Minutes >= 1440 represent overnight departures past midnight.
   */
  d: Record<string, number[]>;

  /**
   * Service ID -> sorted arrival minutes from midnight.
   * Parallel to {@link d}: `a[serviceId][i]` corresponds to
   * `d[serviceId][i]`. When arrival equals departure (most bus
   * stops), the same value is stored in both arrays.
   *
   * For ODPT sources that do not provide arrival times, values
   * are copied from departure times.
   */
  a: Record<string, number[]>;

  /**
   * Service ID -> pickup_type per departure.
   * Parallel to {@link d}: `p[serviceId][i]` corresponds to
   * `d[serviceId][i]`.
   *
   * GTFS pickup_type: 0 = regular, 1 = no pickup (drop-off only),
   * 2 = must phone, 3 = must coordinate with driver.
   *
   * Omitted when all departures in this group have pickup_type = 0.
   */
  p?: Record<string, number[]>;

  /**
   * Service ID -> drop_off_type per departure.
   * Parallel to {@link d}: `do[serviceId][i]` corresponds to
   * `d[serviceId][i]`.
   *
   * GTFS drop_off_type: 0 = regular, 1 = no drop-off (pickup only),
   * 2 = must phone, 3 = must coordinate with driver.
   *
   * Omitted when all departures in this group have drop_off_type = 0.
   */
  do?: Record<string, number[]>;
}

// -----------------------------------------------------------------------
// lookup.json (v2, new)
// -----------------------------------------------------------------------

/**
 * lookup.json: normalized lookup tables for supplementary data.
 *
 * Data that is too heavy or duplicated to embed in the main JSON
 * files (stops.json, routes.json) is separated here as ID -> value
 * dictionaries. Loaded on demand when detail views need it.
 *
 * Examples of duplication avoided:
 * - stop_url: toei-bus 3,695 child stops share 1,673 unique URLs
 * - stop_desc: 847 child stops share 416 unique descriptions
 */
export interface LookupV2Json {
  /** Schema version. Must be `2` for this format. */
  v: 2;
  /**
   * stop_id (prefixed) -> GTFS stop_url.
   * Links to operator's stop detail page (e.g. tobus.jp bus location).
   */
  stopUrls?: Record<string, string>;
  /**
   * route_id (prefixed) -> GTFS route_url.
   * Links to operator's route detail page.
   */
  routeUrls?: Record<string, string>;
  /**
   * stop_id (prefixed) -> GTFS stop_desc.
   * Supplementary stop description (e.g. nearby railway transfer info).
   */
  stopDescs?: Record<string, string>;
}
