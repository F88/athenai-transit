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
  /** Entity counts derived from one source's DataBundle. */
  counts: {
    stops: number;
    routes: number;
    agency: number;
    /** Total calendar entries: `services.length + exceptions.length`. */
    calendar: number;
    feedInfo: number;
    timetable: number;
    tripPatterns: number;
    translations: number;
    lookup: number;
  };
}

/** Summary derived from one source's InsightsBundle file and contents. */
export interface DataSourceCatalogInsightsBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from one source's InsightsBundle. */
  counts: {
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
  /** Counts derived from this source's shapes.json bundle. */
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
  /** Summary derived from this source's data.json bundle. */
  dataBundle: DataSourceCatalogDataBundleSummary;
  /** Summary derived from this source's insights.json bundle. */
  insightsBundle: DataSourceCatalogInsightsBundleSummary;
  /** Summary derived from this source's shapes.json bundle, when present. */
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

/** Curated source-level summaries derived from one source's data.json bundle. */
export interface DataSourceCatalogSourceSummary {
  /** Period summary derived from this source's data.json bundle. */
  periods: {
    /** Declared feed validity derived from `feedInfo`. */
    feedValidity: DataSourceCatalogDateRange;
    /** Min/max service dates derived from `calendar.services`. */
    servicePeriod: DataSourceCatalogDateRange;
    /** Min/max exception dates derived from `calendar.exceptions`. */
    exceptionRange: DataSourceCatalogDateRange;
  };
  /** Agencies derived from this source's data.json bundle. */
  agencies: {
    /** Agency name as published in the source data. */
    name: string;
    /** Agency language code when available in the source data. */
    lang?: string;
    /** Agency timezone from the source data. */
    timezone: string;
  }[];
  /** Translation languages summary derived from this source's data.json bundle. */
  i18n: {
    /** Sorted union of language codes observed across all translation maps. */
    languages: string[];
  };
  /** Route summary derived from this source's data.json bundle. */
  routes: {
    /** Counts keyed by the stringified GTFS `route_type` value. */
    typeCounts: Record<string, number>;
  };
  /** Stops summary derived from this source's data.json bundle. */
  stops: {
    /** Per-`location_type` stop counts and parent-station coverage. */
    locationTypes: Record<string, DataSourceCatalogStopLocationTypeSummary>;
    /** Stop geographic summary derived from stop coordinates. */
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
}

export interface DataSourceCatalogGlobalInsightsSummary extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from the GlobalInsightsBundle. */
  counts: {
    /** Cross-source summary derived from `global/insights.json`. */
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
  /** Curated source-level summaries derived from this source's data.json bundle. */
  summary: DataSourceCatalogSourceSummary;
  /** Emitted bundle-backed summaries grouped by bundle type. */
  bundles: DataSourceCatalogSourceBundles;
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
