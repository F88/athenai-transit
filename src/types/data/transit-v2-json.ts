/**
 * Wire-format types for the next-generation pipeline output (v2).
 *
 * This file defines the target schema for the data JSON redesign.
 * The v1 types in transit-json.ts remain in use until the pipeline
 * and repository are migrated.
 *
 * ## v1 → v2 Summary
 *
 * The tables below describe **logical sections** within bundles.
 * In v1 each section was a separate JSON file; in v2 they are
 * combined into bundles (see "Bundle structure" below).
 * Section names (e.g. "routes", "stops") are used as keys inside
 * the bundle, not as standalone output filenames.
 *
 * ### Changed sections
 *
 * | Section    | Changes                                                    |
 * | ---------- | ---------------------------------------------------------- |
 * | routes     | + `desc` (route_desc). `route_url` moved to lookup section |
 * | stops      | - `ai` removed. + `wb`, `pc`, `ps`. `desc` in lookup      |
 * | shapes     | Point tuple `[lat, lon]` → `[lat, lon, dist?]`             |
 * | timetable  | `r,h,ai` → `tp` (pattern FK). + `a`, `pt?`, `dt?`           |
 *
 * ### New sections
 *
 * | Section        | Purpose                                            |
 * | -------------- | -------------------------------------------------- |
 * | tripPatterns   | Route + headsign + direction + ordered per-stop records |
 * | lookup         | Normalized lookup tables (URLs, descriptions, etc.) |
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
 * Sections within a bundle carry their own `v` (schema version).
 * In DataBundle, `v` reflects the v1→v2 migration status:
 * v=2 for sections whose schema changed or was designed for v2,
 * v=1 for sections using unchanged v1 types. In InsightsBundle,
 * all sections start at v=1 (no v1 predecessor exists).
 *
 * ### Unchanged sections (import from transit-json.ts)
 *
 * agency, calendar, translations, feedInfo
 *
 * ### Removed fields
 *
 * | Section   | Field | Reason                                             |
 * | --------- | ----- | -------------------------------------------------- |
 * | stops     | `ai`  | GTFS spec: stops have no agency_id                  |
 * | routes    | `u`   | Moved to lookup section for normalization           |
 * | timetable | `r`   | Replaced by `tp` → TripPatternJson.r                |
 * | timetable | `h`   | Replaced by `tp` → TripPatternJson.h                |
 * | timetable | `ai`  | Replaced by `tp` → TripPatternJson.r → RouteV2Json.ai |
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
// agency section (v2)
// -----------------------------------------------------------------------

/**
 * Agency record (v2).
 *
 * Contains only data-source-derived fields. Display names (long/short)
 * and their translations are managed on the App side via
 * `agency-attributes.ts`, not in the pipeline output.
 *
 * - GTFS: `n` is `agency_name` from agency.txt (canonical name).
 * - ODPT: `n` is an empty string — ODPT JSON data does not expose an
 *   operator name (`odpt:Operator` API is not downloaded). The display
 *   name must be supplied by `agency-attributes.ts` on the App side.
 */
export interface AgencyV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  i: string; // agency_id (prefixed)
  n: string; // agency_name (Required)
  u: string; // agency_url (Required)
  tz: string; // agency_timezone (Required, IANA e.g. "Asia/Tokyo")
  /** agency_lang. Omitted when not provided. */
  l?: string;
  /** agency_phone. Omitted when not provided. */
  ph?: string;
  /** agency_fare_url. Omitted when not provided. */
  fu?: string;
  /** agency_email. Omitted when not provided. */
  em?: string;
  /** cemv_support: 0=no info, 1=supported, 2=not supported. Omitted when not provided. */
  cemv?: 0 | 1 | 2;
}

// -----------------------------------------------------------------------
// routes section (v2)
// -----------------------------------------------------------------------

/**
 * Route record (v2).
 *
 * Compared to v1, adds `desc` (route_desc). route_url is moved
 * to lookup.json for normalization.
 */
export interface RouteV2Json {
  /**
   * Schema version embedded in each record. Must be `2` for this format.
   *
   * Self-describing version stamp so consumers can identify the
   * schema version from serialized JSON alone. In a bundle,
   * {@link BundleSection}.v is the authoritative source; this
   * field will always match the section-level version.
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
// stops section (v2)
// -----------------------------------------------------------------------

/**
 * Stop record (v2).
 *
 * Compared to v1, `ai` (agency_id) is removed. GTFS spec does not
 * define agency_id on stops.txt — stops are shared infrastructure.
 * Stop-to-agency relationships are resolved at runtime via
 * timetable -> trip pattern -> route -> agency.
 *
 * **location_type coverage**: The v2 pipeline outputs all
 * location_type values without filtering. The primary values are:
 * - `l=0`: Stop/platform (the vast majority of records)
 * - `l=1`: Station (parent grouping node, see `ps`)
 * - `l=2`: Entrance/exit
 * - `l=3`: Generic node (pathway connections)
 * - `l=4`: Boarding area
 *
 * In practice, Japanese GTFS sources almost exclusively use
 * `l=0` and `l=1`. Values 2-4 are rare but not excluded.
 *
 * Stops are emitted from stops.txt independently of timetable coverage.
 * A stop may appear in this section even when it has no matching
 * timetable entry in the same bundle. This is intentional: stop
 * infrastructure must remain visible even when no operational trip
 * currently references it.
 */
export interface StopV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;
  i: string; // stop_id (prefixed)
  n: string; // stop_name
  a: number; // stop_lat
  o: number; // stop_lon
  l: number; // location_type (0=stop/platform, 1=station, 2=entrance/exit, etc.)
  // ai removed — GTFS stops.txt has no agency_id

  // stop_desc moved to lookup.json (stopDescs)

  /**
   * GTFS wheelchair_boarding.
   * 0 = no info, 1 = accessible, 2 = not accessible.
   * For child stops, 0 inherits from parent_station.
   * Omitted when the source does not provide wheelchair_boarding.
   */
  wb?: 0 | 1 | 2;

  /**
   * GTFS parent_station — FK to a parent stop.
   *
   * Present on stops that belong to a station complex. The GTFS spec
   * defines parent relationships as: l=0 → parent l=1, l=2 → parent
   * l=1, l=3 → parent l=1, l=4 → parent l=0. The parent stop is
   * also included in the same stops array.
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
// shapes section (v2)
// -----------------------------------------------------------------------

// Shapes section (v2): route_id -> array of polylines with optional
// cumulative distance.
//
// Each shape point is a tuple of [lat, lon] or [lat, lon, dist].
// The optional third element is GTFS shape_dist_traveled — the actual
// distance traveled along the shape from the first point to this point.
//
// When present, shape_dist_traveled enables:
// - Partial shape rendering (highlight only the segment a trip covers)
// - Travel distance calculation for a trip pattern
// - Disambiguation of overlapping segments on looping/inlining routes
//
// Currently no GTFS sources in this project provide shape_dist_traveled,
// so all points use the [lat, lon] form. The type supports both forms
// so the pipeline can populate distance data when sources provide it.
//
// See: GTFS spec shapes.txt — shape_dist_traveled field
/**
 * A single shape point: `[lat, lon]` or `[lat, lon, dist]`.
 * The optional third element is GTFS shape_dist_traveled.
 */
export type ShapePointV2 = [number, number, number?];

// -----------------------------------------------------------------------
// tripPatterns section (v2, new)
// -----------------------------------------------------------------------

/**
 * tripPatterns section: pattern_id -> trip pattern metadata.
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
 * - Circular route: `stops[0].id === stops[stops.length - 1].id`
 * - Whether a stop is on this pattern: `stops.some(s => s.id === stopId)`
 * - Stop position in pattern: `stops.findIndex(s => s.id === stopId)`
 *
 * Agency is not stored here — resolve via `r` -> RouteV2Json.ai.
 * GTFS spec defines route:agency as 1:1 (routes.txt.agency_id).
 */
export interface TripPatternJson {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;

  /**
   * Route ID (prefixed). FK -> routes section in DataBundle.
   * All trips in this pattern belong to this route.
   */
  r: string;

  /**
   * Trip headsign (destination display text from GTFS trip_headsign).
   *
   * May be empty when the GTFS source does not provide trip_headsign
   * (e.g. keio-bus). In that case, consumers can derive a display
   * name from the terminal stop: `stops[stops.length - 1].id` ->
   * StopV2Json.n or translations.
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
  dir?: 0 | 1;

  /**
   * Ordered per-stop records from origin to destination.
   *
   * Each element bundles all attributes that originate from the same
   * GTFS `stop_times` record for one stop on this pattern.
   * Previously, stop IDs were stored as `stops: string[]` with a
   * separate `sd?: number[]` array in positional alignment. This was
   * consolidated into a single object array so that related fields
   * cannot fall out of sync.
   *
   * - `stops[0]` is the first stop (origin).
   * - `stops[stops.length - 1]` is the terminal.
   * - The order represents the actual stop sequence of the trip.
   * - Consumers MUST NOT re-sort this array.
   *
   * Derived from GTFS stop_times (ORDER BY stop_sequence) or
   * ODPT stationOrder truncated at destinationStation.
   *
   * **Note**: Some stops in this array may have no corresponding
   * timetable entry (e.g. GTFS stops with NULL departure_time —
   * intermediate timepoints without scheduled departures). Consumers
   * MUST NOT assume every stop has departures in the timetable.
   */
  stops: {
    /** Stop ID (prefixed). FK -> stops section in DataBundle. */
    id: string;

    /**
     * GTFS `stop_times.stop_headsign`.
     *
     * Per GTFS spec, `stop_headsign` overrides the trip-level headsign
     * ({@link TripPatternJson.h}) at this specific stop. It does NOT
     * carry forward to subsequent stops — each stop has its own value.
     *
     * The pipeline stores the raw GTFS value as-is without comparing
     * it to `h`. Consumers decide the effective headsign:
     * `effectiveHeadsign = stops[i].sh ?? h`
     *
     * For translation lookup, when `sh` is present use
     * `translations.stop_headsigns[sh]`; otherwise use
     * `translations.trip_headsigns[h]`.
     *
     * Omitted when the source does not provide `stop_headsign`
     * or when the value is NULL.
     */
    sh?: string;

    /**
     * Cumulative distance along the route shape from origin to this stop.
     *
     * Sourced from GTFS `stop_times.shape_dist_traveled`.
     * Units are consistent with {@link ShapePointV2} distances.
     *
     * Together with the per-point distances in the shapes bundle, this
     * enables partial shape rendering: to highlight the segment from
     * stop A to stop B, scan the shape point array for the distance
     * range `[stops[a].sd, stops[b].sd]`.
     *
     * Omitted when the source does not provide `shape_dist_traveled`.
     */
    sd?: number;
  }[];
}

// -----------------------------------------------------------------------
// timetable section (v2)
// -----------------------------------------------------------------------

// Timetable coverage is intentionally narrower than stop coverage.
// Only stops that have at least one departure record are keyed here.
// Stops without operational timetable entries are still preserved in
// the stops section and must not be treated as pipeline omissions.

/**
 * Timetable group record (v2).
 *
 * Each group references a trip pattern and contains departure/arrival
 * times keyed by service_id. A single stop may have multiple groups
 * for the same route+headsign when different trip patterns pass
 * through it (e.g. 宿91 新宿駅西口行き has 3 patterns with different
 * origins). Consumers that need route+headsign grouping (e.g.
 * BottomSheet T2 view) must group across patterns.
 */
export interface TimetableGroupV2Json {
  /** Schema version — see {@link RouteV2Json.v} for rationale. */
  v: 2;

  /**
   * Trip pattern ID. FK -> tripPatterns section in DataBundle.
   * Resolves to route_id, headsign, direction, and stop sequence.
   * Agency is further resolved via TripPatternJson.r -> RouteV2Json.ai.
   */
  tp: string;

  /**
   * Service ID -> departure minutes from midnight.
   * Sorted in ascending order. MUST NOT be re-sorted.
   * Minutes >= 1440 represent overnight departures past midnight.
   *
   * The arrays for `a`, `pt`, and `dt` (when present) are
   * positionally aligned: index `i` across all four fields
   * refers to the same departure.
   */
  d: Record<string, number[]>;

  /**
   * Service ID -> arrival minutes from midnight.
   * Positionally aligned with {@link d}: `a[sid][i]` is the
   * arrival for the same departure as `d[sid][i]`.
   * Length MUST equal `d[sid].length` for each service ID.
   *
   * When arrival equals departure (most bus stops), the same
   * value is stored in both arrays.
   *
   * For ODPT sources that do not provide arrival times, values
   * are copied from departure times.
   */
  a: Record<string, number[]>;

  /**
   * Service ID -> pickup_type per departure.
   * Positionally aligned with {@link d}: `pt[sid][i]` is the
   * pickup_type for the same departure as `d[sid][i]`.
   * Length MUST equal `d[sid].length` for each service ID.
   *
   * GTFS pickup_type: 0 = regular, 1 = no pickup (drop-off only),
   * 2 = must phone, 3 = must coordinate with driver.
   *
   * Omitted when the source does not provide pickup_type/drop_off_type
   * (e.g. ODPT sources). When present, included even if all values are 0,
   * to distinguish "all regular" from "data not available".
   */
  pt?: Record<string, (0 | 1 | 2 | 3)[]>;

  /**
   * Service ID -> drop_off_type per departure.
   * Positionally aligned with {@link d}: `dt[sid][i]` is the
   * drop_off_type for the same departure as `d[sid][i]`.
   * Length MUST equal `d[sid].length` for each service ID.
   *
   * GTFS drop_off_type: 0 = regular, 1 = no drop-off (pickup only),
   * 2 = must phone, 3 = must coordinate with driver.
   *
   * Omitted when the source does not provide pickup_type/drop_off_type
   * (e.g. ODPT sources). When present, included even if all values are 0,
   * to distinguish "all regular" from "data not available".
   */
  dt?: Record<string, (0 | 1 | 2 | 3)[]>;
}

// -----------------------------------------------------------------------
// lookup section (v2, new)
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

import type { CalendarJson, FeedInfoJson, TranslationsJson } from './transit-json';

/**
 * Versioned section wrapper inside a bundle.
 *
 * Each section declares its own schema version independently of the
 * bundle version. v1 sections use types from transit-json.ts unchanged;
 * v2 sections use types from this file.
 *
 * Record types that carry their own `v` field (e.g. StopV2Json,
 * RouteV2Json) use it as a self-describing version stamp in
 * serialized data. The section-level `v` here is the authoritative
 * source of truth for the section's schema version; record-level
 * `v` values within a section will always match.
 *
 * Types without a record-level `v` (e.g. LookupV2Json) rely
 * solely on the section-level `v` for version identification.
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
  agency: BundleSection<2, AgencyV2Json[]>;
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
 * stop `i` to the terminal stop.
 *
 * Derivable:
 * - Total pattern duration: `rd[0]`
 * - Frequent-stop score: `stops.length / rd[0]`
 * - Non-stop score: `rd[0] / stops.length`
 */
export interface TripPatternStatsJson {
  /** Total departures per day for this service group. */
  freq: number;
  /**
   * Remaining minutes from each stop to the terminal.
   * `rd[i]` corresponds to {@link TripPatternJson}.stops[i]
   * (i.e. the stop whose ID is `stops[i].id`).
   * Length MUST equal TripPatternJson.stops.length.
   * Values are monotonically decreasing; `rd[last]` is always 0.
   * Order MUST NOT be changed — indices are positional.
   */
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
   * {@link TripPatternJson.stops}[i].sd (shape_dist_traveled) when available.
   */
  pathDist: number;

  /**
   * Whether this pattern is circular: the first and last stop are
   * the same (`stops[0].id === stops[stops.length - 1].id`).
   *
   * Note: "6-shaped" routes (e.g. Oedo Line) where a mid-route stop
   * appears twice but `stops[0].id !== stops[last].id` are NOT flagged as
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
   * "Different route" means a route not in this stop's own route set
   * (definition B). Same route at a different platform is not counted.
   *
   * Higher value = more isolated (陸の孤島), transit desert.
   * Lower positive value = dense transit area, nearby alternatives.
   *
   * `0` when no different-route stop exists anywhere (truly isolated,
   * or only one route in the entire dataset), or when a different-route
   * stop is colocated at identical coordinates (distance = 0km).
   * In practice, consumers can treat nr=0 as "not meaningfully isolated"
   * since both cases require zero walking distance to an alternative
   * (or no alternative exists at all).
   *
   * For l=1 (station) stops: derived as the minimum of children's
   * positive nr values. Children with nr=0 are excluded because
   * nr=0 is ambiguous (see above); the parent metric focuses on the
   * nearest child that has a measurable distance to an alternative.
   * See {@link buildParentStopGeo} for the exact derivation logic.
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
   *
   * For l=1 (station) stops: derived as the minimum wp across
   * all child (l=0) stops.
   */
  wp?: number;

  /**
   * Connectivity metrics within a 300m radius, keyed by service
   * group identifier. Measures transfer convenience at this stop
   * across all sources.
   *
   * Initial implementation provides `ho` (Sunday-pattern) only.
   * Selection is based on weekly calendar pattern `d[6] === 1`;
   * calendar_dates holiday exceptions are not considered.
   * Future keys (e.g. `wd` for weekday) may be added.
   *
   * For l=1 (station) stops: computed directly using the parent's
   * coordinates (not derived from children), because the parent
   * has no routes of its own but its location represents the
   * station as a whole.
   *
   * Omitted when no routes operate within 300m for the given
   * service group.
   */
  cn?: Record<
    string,
    {
      /** Number of unique routes within 300m (including this stop's own routes). */
      rc: number;
      /** Sum of unique routes' daily departures (each route counted once at its max-freq stop). */
      freq: number;
      /** Number of other stops within 300m. */
      sc: number;
    }
  >;
}

/**
 * A single service group entry within {@link InsightsBundle.serviceGroups}.
 *
 * Keys are short identifiers chosen by the pipeline — NOT fixed by
 * the type system. Typical keys: "wd" (weekday), "sa" (Saturday),
 * "su" (Sunday), "all" (every day). The pipeline may generate
 * different keys depending on the source's calendar structure.
 */
export interface ServiceGroupEntry {
  /** Short identifier for this group (e.g. "wd", "sa", "su"). */
  key: string;
  /** GTFS service_ids belonging to this group. */
  serviceIds: string[];
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
 *   // 2. Find the service group with the most overlap.
 *   //    Array order = priority; on tie, earlier group wins.
 *   const groups = bundle.serviceGroups.data;
 *   let groupKey: string | undefined;
 *   let bestOverlap = 0;
 *   for (const { key, serviceIds } of groups) {
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
   * Service group definitions, ordered by priority (most common
   * day type first, e.g. weekday → Saturday → Sunday).
   *
   * Generated by the pipeline primarily from calendar.txt day-of-week patterns.
   * For calendar_dates-only service IDs, the pipeline may add supplemental
   * entries when needed to avoid unresolved group selection on active days.
   * The app matches today's active service_ids against this list to
   * select the correct group key for Stats lookups.
   *
   * **Constraints**:
   * - Each service_id MUST appear in exactly one group.
   * - On dates where the active service_ids span multiple groups
   *   (e.g. calendar_dates exceptions), the app selects the group
   *   with the most overlap. On tie, the earlier group wins
   *   (array order is the tie-break rule).
   */
  serviceGroups: BundleSection<1, ServiceGroupEntry[]>;

  /**
   * Per-pattern operational statistics. Keyed by service group, then pattern ID.
   * Only patterns with at least one departure in the service group are included.
   * Patterns with no departures (freq=0) are omitted from the inner record.
   */
  tripPatternStats?: BundleSection<1, Record<string, Record<string, TripPatternStatsJson>>>;
  /** Per-pattern geographic metrics. Keyed by pattern ID. Service-group independent. */
  tripPatternGeo?: BundleSection<1, Record<string, TripPatternGeoJson>>;
  /**
   * Per-stop operational statistics. Keyed by service group, then stop ID.
   * Only stops with at least one departure in the service group are included.
   * Stops with no departures (freq=0) are omitted from the inner record.
   */
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
