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
 * | routes.json    | + `desc` (route_desc). `route_url` moved to lookup.json |
 * | stops.json     | - `ai` removed. + `wb`, `pc`, `ps`. `desc` in lookup    |
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
 * ### Bundle structure
 *
 * Per-source bundles (`{prefix}/` directory):
 *
 * | File                     | Contents                                       |
 * | ------------------------ | ---------------------------------------------- |
 * | `{prefix}/data.json`     | All data needed at startup (DataBundle)         |
 * | `{prefix}/shapes.json`   | Route shapes, lazy-loaded (ShapesBundle)        |
 * | `{prefix}/insights.json` | Precomputed analytics, optional (InsightsBundle) |
 *
 * Global bundle (cross-source):
 *
 * | File                     | Contents                                       |
 * | ------------------------ | ---------------------------------------------- |
 * | `global/insights.json`   | Cross-source spatial analytics (GlobalInsightsBundle) |
 *
 * InsightsBundle sections (per-source, all optional except serviceGroups):
 *
 * |              | Stats (service-group segmented) | Geo (day-independent)      |
 * | ------------ | ------------------------------- | -------------------------- |
 * | TripPattern  | tripPatternStats                | tripPatternGeo             |
 * | Stop         | stopStats                       | → GlobalInsightsBundle     |
 *
 * Each bundle has a `bundle_version` and `kind` discriminant.
 * Sections within a bundle carry their own `v` (schema version):
 * v1 = unchanged from transit-json.ts, v2 = changed in this file.
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
 * | routes.json | `u`   | Moved to lookup.json for normalization            |
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
 * to lookup.json for normalization.
 */
export interface RoutesV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  routes: RouteV2Json[];
}

export interface RouteV2Json {
  /**
   * Schema version embedded in each record. Must be `2` for this format.
   *
   * Every v2 record carries its own version so the data is
   * self-describing — consumers can identify the schema version
   * from the serialized JSON alone, without relying on external
   * metadata. This remains useful after types are renamed
   * (e.g. RouteV2Json → RouteJson) and when records are
   * processed outside of a bundle context.
   *
   * In a bundle, BundleSection.v also declares the version at the
   * section level and will always match this value.
   */
  v: 2;
  i: string; // route_id
  s: string; // route_short_name
  l: string; // route_long_name
  t: number; // route_type
  c: string; // route_color (hex without #, e.g. "F1B34E")
  tc: string; // route_text_color (hex without #)
  ai: string; // agency_id (prefixed)
  /**
   * GTFS route_desc — description of the route.
   * Omitted when the source does not provide route_desc.
   */
  desc?: string;
  // route_url moved to lookup.json
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
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  stops: StopV2Json[];
}

export interface StopV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
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

  /**
   * GTFS parent_station — FK to the parent stop (location_type=1).
   *
   * Present only on child stops (location_type=0) that belong to a
   * station complex. The parent stop itself is also included in the
   * same stops array with `l: 1`.
   *
   * ### Parent → children lookup
   *
   * The JSON does not store a children list on the parent. Instead,
   * consumers build a reverse map by scanning all stops:
   *
   * ```ts
   * const childrenMap = new Map<string, StopV2Json[]>();
   * for (const stop of stops) {
   *   if (stop.ps) {
   *     const list = childrenMap.get(stop.ps) ?? [];
   *     list.push(stop);
   *     childrenMap.set(stop.ps, list);
   *   }
   * }
   * ```
   *
   * This is O(N) over the stop array, which is acceptable because
   * all stops reside in the same JSON file — no N+1 fetch occurs.
   * Storing a children array on the parent would duplicate data and
   * require the pipeline to maintain bidirectional consistency.
   *
   * ### location_type=1 stops
   *
   * Parent stops (location_type=1) are included in the JSON solely
   * for terminal/station grouping purposes. They MUST be excluded
   * from map marker rendering and from stop count limits. Consumers
   * should filter on `l === 0` for display and `l === 1` for
   * grouping lookups.
   */
  ps?: string;

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
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
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
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  /** pattern_id -> trip pattern metadata */
  patterns: Record<string, TripPatternJson>;
}

export interface TripPatternJson {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
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
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  /** stop_id -> schedule groups */
  stops: Record<string, TimetableGroupV2Json[]>;
}

export interface TimetableGroupV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
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
 * Data that is too heavy or duplicated to embed in the main record
 * arrays (stops, routes) is separated here as ID -> value
 * dictionaries. Included in DataBundle and loaded at startup,
 * but accessed only when detail views need it.
 *
 * Examples of duplication avoided:
 * - stop_url: toei-bus 3,695 child stops share 1,673 unique URLs
 * - stop_desc: 847 child stops share 416 unique descriptions
 */
export interface LookupV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
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

// -----------------------------------------------------------------------
// Bundle wrappers
// -----------------------------------------------------------------------

import type { AgencyJson, CalendarJson, FeedInfoJson, TranslationsJson } from './transit-json';

/**
 * Versioned section wrapper inside a bundle.
 *
 * Each section declares its own schema version independently of the
 * bundle version. v1 sections use types from transit-json.ts unchanged;
 * v2 sections use types from this file.
 *
 * Note: Individual records (e.g. StopV2Json, RouteV2Json) also carry
 * their own `v` field. This is intentional — the record-level `v` is
 * a self-describing version stamp embedded in the serialized data so
 * that consumers can identify the schema version from the data alone,
 * even after the v2 types are renamed (e.g. StopV2Json → StopJson).
 * The section-level `v` here serves as bundle metadata and will
 * always match the record-level `v` within that section.
 */
interface BundleSection<V extends number, T> {
  /** Schema version for this section's data type. */
  v: V;
  data: T;
}

/**
 * `{prefix}/data.json` — all data needed at startup for a single source.
 *
 * Contains every section except shapes, which are lazy-loaded separately.
 * This replaces the 8-10 individual JSON files per source in v1.
 *
 * The `kind` field serves as a discriminated union tag so consumers can
 * distinguish bundle types at runtime:
 *
 * ```ts
 * function loadBundle(json: SourceBundle) {
 *   if (json.kind === 'data') { ... }
 *   if (json.kind === 'shapes') { ... }
 *   if (json.kind === 'insights') { ... }
 * }
 * ```
 */
export interface DataBundle {
  /** Bundle format version. */
  bundle_version: 2;
  /** Discriminated union tag. */
  kind: 'data';

  stops: BundleSection<2, StopV2Json[]>;
  routes: BundleSection<2, RouteV2Json[]>;
  agency: BundleSection<1, AgencyJson[]>;
  calendar: BundleSection<1, CalendarJson>;
  feedInfo: BundleSection<1, FeedInfoJson>;
  timetable: BundleSection<2, Record<string, TimetableGroupV2Json[]>>;
  tripPatterns: BundleSection<2, Record<string, TripPatternJson>>;
  translations: BundleSection<1, TranslationsJson>;
  lookup: BundleSection<2, LookupV2Json>;
}

/**
 * `{prefix}/shapes.json` — route shapes for a single source.
 *
 * Separated from DataBundle because shapes are only needed when the
 * shapes layer is toggled on. Lazy-loading this file avoids fetching
 * potentially large geometry data on startup.
 */
export interface ShapesBundle {
  /** Bundle format version. */
  bundle_version: 2;
  /** Discriminated union tag. */
  kind: 'shapes';

  shapes: BundleSection<2, Record<string, ShapePointV2[][]>>;
}

// -----------------------------------------------------------------------
// Insights — precomputed analytics for pluggable views
// -----------------------------------------------------------------------

/**
 * Per-pattern operational statistics.
 *
 * Precomputed by the pipeline from stop_times + trips.
 * Segmented by service group key (see {@link InsightsBundle.serviceGroups})
 * because service patterns differ significantly between day types —
 * some patterns may not run at all on certain days.
 *
 * - `freq`: enables T5 (Frequency) view sorting and route-line
 *   thickness visualization.
 * - `rd`: enables T6 (Duration) view — "ride this bus for ~34 min".
 *   Values are median duration across all trips in the pattern, so
 *   they represent a "typical" ride time rather than an exact
 *   per-trip value.
 *
 * The `rd` array is parallel to {@link TripPatternJson.stops}:
 * `rd[i]` is the approximate remaining ride time (minutes) from
 * `stops[i]` to the terminal `stops[stops.length - 1]`.
 *
 * Derivable:
 * - Total pattern duration: `rd[0]`
 * - Frequent-stop score: `stops.length / rd[0]`
 * - Non-stop score: `rd[0] / stops.length`
 */
export interface TripPatternStatsJson {
  /** Total departures per day for this service group. */
  freq: number;
  /** Remaining minutes from stops[i] to terminal. Parallel to stops[]. */
  rd: number[];
}

/**
 * Per-pattern geographic metrics.
 *
 * Precomputed by the pipeline from stop coordinates.
 * Provides straight-line distance, path distance, and circular
 * route detection. Used by views that evaluate route shape
 * characteristics (e.g. T10 Wandering) and for general route
 * classification.
 *
 * For circular routes (`cl: true`), `dist` is 0 and distance-based
 * scores (e.g. wandering score) are not meaningful. Consumers should
 * handle this case explicitly.
 *
 * Derivable (app-side):
 * - Wandering score (distance-based): `pathDist / dist`
 *
 * Derivable (app-side, combined with {@link TripPatternStatsJson}):
 * - Wandering score (time-based): `rd[0] / dist`
 * - Express score: `dist / rd[0]`
 */
export interface TripPatternGeoJson {
  /**
   * Straight-line distance (km) from the first stop to the terminal,
   * computed via Haversine formula.
   */
  dist: number;

  /**
   * Total path distance (km) along the stop sequence, computed as
   * the sum of Haversine distances between consecutive stops.
   *
   * This is a rough approximation of actual road distance — it
   * connects stops with straight lines rather than following the
   * actual route. For more accurate distances, use
   * {@link TripPatternJson.sd} (shape_dist_traveled) when available.
   */
  pathDist: number;

  /**
   * Whether this pattern is circular: the first and last stop are
   * the same (`stops[0] === stops[stops.length - 1]`).
   *
   * Note: "6-shaped" routes (e.g. Oedo Line) where a mid-route stop
   * appears twice but `stops[0] !== stops[last]` are NOT flagged as
   * circular. They have a valid `dist` and can be scored normally.
   */
  cl: boolean;
}

/**
 * Per-stop operational statistics.
 *
 * Precomputed by the pipeline from timetable, routes, and trips.
 * Segmented by service group key (see {@link InsightsBundle.serviceGroups})
 * because all values depend on which services are running — a stop
 * may have 50 departures on weekdays but only 10 on Sundays, or
 * lose entire route types on certain days.
 *
 * Provides frequency and connectivity metrics for each stop.
 * Used for marker rendering and view sorting.
 */
export interface StopStatsJson {
  /** Total departures per day for this service group, across all patterns serving this stop. */
  freq: number;

  /** Number of distinct routes serving this stop in this service group. */
  rc: number;

  /** Number of distinct route types (bus, subway, tram, etc.) serving this stop in this service group. */
  rtc: number;

  /**
   * Earliest departure time (minutes from midnight) for this service group.
   * Indicates early-morning availability.
   */
  ed: number;

  /**
   * Latest departure time (minutes from midnight) for this service group.
   * Values >= 1440 represent overnight departures past midnight.
   * Indicates late-night availability.
   */
  ld: number;
}

/**
 * Per-stop geographic metrics.
 *
 * Precomputed by the pipeline from stop coordinates via spatial
 * analysis. Provides isolation and connectivity metrics that
 * require cross-stop distance calculations.
 *
 * **Multi-source prerequisite**: This section requires a pipeline
 * step that analyzes stops across ALL sources. Per-source analysis
 * would produce misleading results — a stop may appear isolated
 * within one source while another source's stop is nearby.
 * The exact definitions of each metric (what constitutes "different
 * route" or "different parent_station") depend on the multi-source
 * pipeline design and will be refined at implementation time.
 */
export interface StopGeoJson {
  /**
   * Distance (km) to the nearest stop served by a different route,
   * computed via Haversine formula.
   *
   * High value = isolated (陸の孤島), transit desert.
   * Low value = dense transit area, many nearby alternatives.
   */
  nr: number;

  /**
   * Distance (km) to the nearest stop with a different
   * parent_station, computed via Haversine formula.
   *
   * Reveals "walkable portals" — points where a short walk
   * connects two unrelated station complexes. A value of 0.1-0.2
   * suggests a hidden shortcut between different transit networks.
   *
   * Requires parent_station data in the source. Omitted when
   * parent_station is not available for this stop.
   */
  wp?: number;
}

/**
 * `{prefix}/insights.json` — precomputed analytics for a single source.
 *
 * Contains pipeline-derived statistics and scores that enable
 * pluggable view patterns (T5, T6, T7, T10, etc.) without runtime
 * computation. Organized along two axes:
 *
 * |              | Stats (operational) | Geo (spatial)          |
 * | ------------ | ------------------- | ---------------------- |
 * | TripPattern  | tripPatternStats    | tripPatternGeo         |
 * | Stop         | stopStats           | (GlobalInsightsBundle) |
 *
 * Stats sections are segmented by **service group key** — a string
 * identifier generated by the pipeline from calendar.txt day-of-week
 * patterns (e.g. "wd", "sa", "su"). The {@link serviceGroups} section
 * maps each key to its constituent service_ids, so the app can
 * determine which key to use for "today" without hard-coding any
 * locale-specific day-type logic:
 *
 * ```ts
 * if (bundle.kind === 'insights') {
 *   // 1. Get today's active service_ids (existing calendar logic)
 *   const active = getActiveServiceIds(calendar, today);
 *
 *   // 2. Find the service group key whose service_ids overlap
 *   //    with today's active set. When multiple groups match
 *   //    (e.g. calendar_dates adds services from two groups),
 *   //    pick the one with the most overlap.
 *   const groups = bundle.serviceGroups.data;
 *   let groupKey: string | undefined;
 *   let bestOverlap = 0;
 *   for (const [key, serviceIds] of Object.entries(groups)) {
 *     const overlap = serviceIds.filter(id => active.has(id)).length;
 *     if (overlap > bestOverlap) {
 *       bestOverlap = overlap;
 *       groupKey = key;
 *     }
 *   }
 *
 *   // 3. Access stats with that key
 *   if (groupKey && bundle.tripPatternStats) {
 *     const stats = bundle.tripPatternStats.data[groupKey];
 *   }
 * }
 * ```
 *
 * Geo sections (tripPatternGeo) are NOT segmented — geographic
 * metrics are independent of which services are running.
 * Stop-level Geo (stopGeo) lives in {@link GlobalInsightsBundle}
 * because it requires cross-source spatial analysis.
 *
 * Each section is optional — the app enables views based on which
 * sections are present. Separated from DataBundle to keep
 * GTFS-derived data and pipeline-computed analytics independent.
 * Each section is generated by a separate pipeline step, so they
 * can be added or updated independently.
 */
export interface InsightsBundle {
  /** Bundle format version. */
  bundle_version: 2;
  /** Discriminated union tag. */
  kind: 'insights';

  /**
   * Service group definitions — maps a group key (e.g. "wd", "sa", "su")
   * to the GTFS service_ids that belong to it.
   *
   * Generated by the pipeline from calendar.txt day-of-week patterns.
   * The app matches today's active service_ids against this map to
   * select the correct group key for Stats lookups.
   *
   * Keys are short identifiers chosen by the pipeline — NOT fixed by
   * the type system. Typical keys: "wd" (weekday), "sa" (Saturday),
   * "su" (Sunday), "all" (every day). The pipeline may generate
   * different keys depending on the source's calendar structure.
   */
  serviceGroups: BundleSection<1, Record<string, string[]>>;

  /** Per-pattern operational statistics. Keyed by service group, then pattern ID. */
  tripPatternStats?: BundleSection<1, Record<string, Record<string, TripPatternStatsJson>>>;
  /** Per-pattern geographic metrics. Keyed by pattern ID. Service-group independent. */
  tripPatternGeo?: BundleSection<1, Record<string, TripPatternGeoJson>>;
  /** Per-stop operational statistics. Keyed by service group, then stop ID. */
  stopStats?: BundleSection<1, Record<string, Record<string, StopStatsJson>>>;
}

/**
 * Union of all bundle types for a single source.
 * Use `kind` to discriminate at runtime.
 */
export type SourceBundle = DataBundle | ShapesBundle | InsightsBundle;

// -----------------------------------------------------------------------
// Global bundles — cross-source analytics
// -----------------------------------------------------------------------

/**
 * `global/insights.json` — cross-source precomputed analytics.
 *
 * Contains metrics that require spatial analysis across ALL sources.
 * Unlike per-source InsightsBundle, this bundle is generated by a
 * pipeline step that has access to every source's stop data.
 *
 * Delivered as a single file independent of any source prefix.
 */
export interface GlobalInsightsBundle {
  /** Bundle format version. */
  bundle_version: 2;
  /** Discriminated union tag. */
  kind: 'global-insights';

  /** Per-stop geographic metrics computed across all sources. */
  stopGeo?: BundleSection<1, Record<string, StopGeoJson>>;
}

/**
 * Union of all global (cross-source) bundle types.
 * Use `kind` to discriminate at runtime.
 */
export type GlobalBundle = GlobalInsightsBundle;
