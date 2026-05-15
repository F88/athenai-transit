/**
 * Wire-format types for the pipeline-generated v2 data-source catalog.
 *
 * This schema is intentionally separate from `transit-v2-json.ts`.
 * The catalog is not a per-source transit payload like DataBundle /
 * ShapesBundle / InsightsBundle; it is a curated global artifact built
 * from those outputs after the v2 pipeline has finished.
 */

/**
 * Versioned section wrapper inside the catalog bundle.
 *
 * Kept local to this file so the catalog schema remains self-contained
 * and can evolve on its own axis without coupling to transit payload
 * bundle internals.
 */
interface BundleSection<V extends number, T> {
  /** Schema version for this section's data type. */
  v: V;
  data: T;
}

/** Whole-bundle metadata for the generated catalog artifact. */
export interface DataSourceCatalogMetadata {
  /** Catalog build timestamp in UTC ISO 8601 / RFC 3339 format. */
  createdAt: string;
}

/** Shared file metadata for one emitted bundle-backed summary. */
export interface DataSourceCatalogFileBackedSummary {
  /** File metadata for the emitted JSON bundle. */
  file: {
    /** File size in raw bytes on disk. */
    sizeBytes: number;
  };
}

/** Summary derived from one source's DataBundle file and contents. */
export interface DataSourceCatalogDataBundleSummary extends DataSourceCatalogFileBackedSummary {
  /**
   * Structural counts derived from one source's DataBundle.
   *
   * These describe emitted bundle shape and storage structure. They are
   * appropriate for diagnostics and low-level analysis, but they should
   * not be assumed to be ideal direct UI metrics.
   */
  counts: {
    /** Number of entries in `stops.data` (all stop entries, including parent stations). */
    stops: number;
    /** Number of entries in `routes.data`. */
    routes: number;
    /** Number of entries in `agency.data`. */
    agency: number;
    /** Total calendar entries: `calendar.data.services.length + calendar.data.exceptions.length`. */
    calendar: number;
    /** Presence count for `feedInfo`; currently always `1` for a valid bundle. */
    feedInfo: number;
    /** Number of stop keys in `timetable.data`, not timetable groups or stop-times. */
    timetable: number;
    /** Number of trip pattern IDs in `tripPatterns.data`. */
    tripPatterns: number;
    /** Sum of top-level translation entry counts across translation maps. */
    translations: number;
    /** Sum of top-level lookup entry counts across lookup maps. */
    lookup: number;
  };
}

/** Summary derived from one source's InsightsBundle file and contents. */
export interface DataSourceCatalogInsightsBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Structural counts derived from one source's InsightsBundle. */
  counts: {
    /** Number of entries in `serviceGroups.data`. */
    serviceGroups: number;
    /**
     * `tripPatternGeo` is flat by trip pattern ID, while `tripPatternStats` and `stopStats`
     * are nested as service-group bucket -> entity in the underlying bundle schema.
     */
    /** Number of service-group buckets present in `tripPatternStats.data`. */
    tripPatternStats: number;
    /** Number of trip pattern IDs present in `tripPatternGeo.data`. */
    tripPatternGeo: number;
    /** Number of service-group buckets present in `stopStats.data`. */
    stopStats: number;
  };
}

/** Summary derived from one source's ShapesBundle file and contents. */
export interface DataSourceCatalogShapesBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Structural counts derived from this source's shapes.json bundle. */
  counts: {
    /** Number of routes that carry shape geometry. */
    routes: number;
  };
  /** Shape volume summary derived from this source's shapes.json bundle. */
  volume: {
    /** Total polyline count across every route. */
    polylines: number;
    /** Total point count across every polyline. */
    points: number;
    /** Sum of segment lengths in km across every polyline. */
    totalLengthKm: number;
  };
}

/** Emitted bundle-backed summaries grouped by bundle type for one source. */
export interface DataSourceCatalogSourceBundles {
  /** Structural metadata derived from this source's data.json bundle. */
  dataBundle: DataSourceCatalogDataBundleSummary;
  /** Structural metadata derived from this source's insights.json bundle. */
  insightsBundle: DataSourceCatalogInsightsBundleSummary;
  /** Structural metadata derived from this source's shapes.json bundle, when present. */
  shapesBundle?: DataSourceCatalogShapesBundleSummary;
}

/** Nullable date range derived from feedInfo or calendar data. */
export interface DataSourceCatalogDateRange {
  start: string | null;
  end: string | null;
}

/** Per-`location_type` stop counts and parent-station coverage. */
export interface DataSourceCatalogStopLocationTypeSummary {
  /** Number of stops with this GTFS `location_type` value. */
  count: number;
  /** Number of those stops carrying a GTFS `parent_station` reference. */
  hasParentCount: number;
}

/**
 * Curated source-level facts for discovery, comparison, and UI.
 *
 * This section describes the source itself rather than the current
 * storage layout used to build it. Its fields should remain meaningful
 * even if the underlying bundle structure evolves.
 */
export interface DataSourceCatalogSourceSummary {
  /** Date-range facts describing this source's published service period. */
  periods: {
    /** Declared validity window for this source, when published. */
    feedValidity: DataSourceCatalogDateRange;
    /** Earliest and latest regular service dates represented by this source. */
    servicePeriod: DataSourceCatalogDateRange;
    /** Earliest and latest exception dates represented by this source. */
    exceptionRange: DataSourceCatalogDateRange;
  };
  /** Agencies represented by this source. */
  agencies: {
    /** Agency name as published in the source data. */
    name: string;
    /** Agency language code when available in the source data. */
    lang?: string;
    /** Agency timezone from the source data. */
    timezone: string;
  }[];
  /** Languages supported by this source's published passenger-facing text. */
  i18n: {
    /** Sorted list of language codes available in this source. */
    languages: string[];
  };
  /** Route composition facts for this source. */
  routes: {
    /** Counts keyed by the stringified GTFS `route_type` value. */
    typeCounts: Record<string, number>;
  };
  /** Stop and station facts for this source. */
  stops: {
    /**
     * Per-`location_type` stop counts and parent-station coverage.
     *
     * Keys are stringified GTFS `location_type` values. Per the GTFS
     * Schedule reference (snapshot taken 2026-05-15, source
     * https://gtfs.org/documentation/schedule/reference/#stopstxt), the
     * defined values are:
     * - `"0"`: stop / platform (location where passengers board)
     * - `"1"`: station (parent of platforms)
     * - `"2"`: entrance / exit
     * - `"3"`: generic node
     * - `"4"`: boarding area
     *
     * The catalog does not validate against this enum; consumers should
     * re-check the GTFS spec if the value space evolves.
     *
     * For UI purposes, `locationTypes["0"].count` is the recommended
     * single-number proxy for the number of physical boarding stops
     * (乗り場) that this source declares. It excludes parent stations
     * (`"1"`) and entrances (`"2"`), and remains meaningful regardless
     * of which operating-day calendars the source publishes.
     *
     * The match between `locationTypes["0"].count` and "stops actually
     * served by at least one trip" is approximate. Some sources register
     * `location_type=0` stops that no trip references; these are still
     * counted here. For "stops referenced by at least one stop_time"
     * semantics, see `bundles.dataBundle.counts.timetable`.
     */
    locationTypes: Record<string, DataSourceCatalogStopLocationTypeSummary>;
    /** Geographic extent of the stops represented by this source. */
    geo: {
      /** Bounding box of all stops, or null when the source has no stops. */
      bbox: null | {
        latMin: number;
        latMax: number;
        lonMin: number;
        lonMax: number;
      };
    };
  };
  /** Service-volume facts suitable for rough scale comparison. */
  service: {
    /** Highest one-day trip total across the operating-day categories represented by this source. */
    maxTripsPerDay: number;
  };
  /** Route shape coverage facts for this source. */
  shapes: {
    /** Whether route shape geometry is available for this source. */
    available: boolean;
    /** Number of routes in this source that include shape geometry. */
    routeCount: number;
  };
}

export interface DataSourceCatalogGlobalInsightsSummary extends DataSourceCatalogFileBackedSummary {
  /** Structural counts derived from the GlobalInsightsBundle. */
  counts: {
    /** Number of stop IDs present in `global/insights.json` `stopGeo.data`. */
    stopGeo: number;
  };
}

/**
 * Pipeline-generated catalog payload for a single source prefix.
 *
 * This is a curated subset of cross-bundle derived facts intended for
 * discovery and comparison by any v2 JSON consumer. Editorial fields
 * such as display labels, brand colors, enable/disable defaults, and
 * license copy intentionally remain outside this schema.
 */
export interface DataSourceCatalogSource {
  /** Emitted bundle-backed structural metadata grouped by bundle type. */
  bundles: DataSourceCatalogSourceBundles;
  /** Curated source-level semantic facts intended for discovery and comparison. */
  summary: DataSourceCatalogSourceSummary;
}

/**
 * `global/data-source-catalog.json` — pipeline-generated source catalog.
 *
 * Contains one curated catalog entry per source prefix, derived from
 * the already-built v2 bundle files. This bundle is intentionally not
 * a serialization of the full `summarize-v2-outputs` audit output;
 * it contains only stable discovery-oriented facts that are useful to
 * generic v2 JSON consumers.
 *
 * Delivered as a single file independent of any source prefix.
 *
 * `sources.data` is keyed by the source prefix / output directory name
 * (e.g. `minkuru`, `kobus`). Keys MUST be unique within the bundle.
 */
export interface DataSourceCatalogBundle {
  /** Bundle format version. */
  bundle_version: 3;
  /** Discriminated union tag. */
  kind: 'data-source-catalog';

  /** Whole-bundle artifact metadata such as build timestamp. */
  metadata: BundleSection<1, DataSourceCatalogMetadata>;
  /** Per-source metadata and summary payloads keyed by source prefix. */
  sources: BundleSection<1, Record<string, DataSourceCatalogSource>>;
  /** Cross-source summary derived from `global/insights.json`. */
  globalInsights: BundleSection<1, DataSourceCatalogGlobalInsightsSummary>;
}
