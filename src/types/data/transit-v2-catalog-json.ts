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

/** Entity counts derived from the GlobalInsightsBundle. */
export interface DataSourceCatalogGlobalInsightsBundleCounts {
  stopGeo: number;
}

/** Cross-source summary derived from `global/insights.json`. */
export interface DataSourceCatalogGlobalInsights extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from the GlobalInsightsBundle. */
  counts: DataSourceCatalogGlobalInsightsBundleCounts;
}

/** Metadata for one emitted v2 JSON file. */
export interface DataSourceCatalogFileMetadata {
  /** File size in raw bytes on disk. */
  sizeBytes: number;
}

/** Shared file metadata for one emitted bundle-backed summary. */
export interface DataSourceCatalogFileBackedSummary {
  /** File metadata for the emitted JSON bundle. */
  file: DataSourceCatalogFileMetadata;
}

/** Entity counts derived from one source's DataBundle. */
export interface DataSourceCatalogDataBundleCounts {
  stops: number;
  routes: number;
  agency: number;
  calendar: number;
  feedInfo: number;
  timetable: number;
  tripPatterns: number;
  translations: number;
  lookup: number;
}

/** Entity counts derived from one source's ShapesBundle. */
export interface DataSourceCatalogShapesBundleCounts {
  shapes: number;
}

/** Entity counts derived from one source's InsightsBundle. */
export interface DataSourceCatalogInsightsBundleCounts {
  serviceGroups: number;
  tripPatternStats: number;
  tripPatternGeo: number;
  stopStats: number;
}

/** Translation languages summary derived from one source's TranslationsJson. */
export interface DataSourceCatalogI18nSummary {
  /** Sorted union of language codes observed across all translation maps. */
  languages: string[];
}

/** Route summary derived from one source's DataBundle routes data. */
export interface DataSourceCatalogRoutesSummary {
  /** Counts keyed by the stringified GTFS `route_type` value. */
  typeCounts: Record<string, number>;
}

/** Stops summary derived from one source's DataBundle stops data. */
export interface DataSourceCatalogStopsSummary {
  /** Per-`location_type` stop counts and parent-station coverage. */
  locationTypes: Record<string, DataSourceCatalogStopLocationTypeSummary>;
  /** Stop geographic summary derived from stop coordinates. */
  geo: DataSourceCatalogStopsGeoSummary;
}

/** Per-`location_type` stop counts and parent-station coverage. */
export interface DataSourceCatalogStopLocationTypeSummary {
  /** Number of stops with this GTFS `location_type` value. */
  count: number;
  /** Number of those stops carrying a GTFS `parent_station` reference. */
  hasParentCount: number;
}

/** Bounding box summary derived from one source's stop coordinates. */
export interface DataSourceCatalogBoundingBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/** Stop geographic summary derived from one source's DataBundle stops data. */
export interface DataSourceCatalogStopsGeoSummary {
  /** Bounding box of all stops, or null when the source has no stops. */
  bbox: DataSourceCatalogBoundingBox | null;
}

/** One agency summary derived from `agency.txt` / DataBundle agency data. */
export interface DataSourceCatalogAgencySummary {
  /** Agency name as published in the source data. */
  name: string;
  /** Agency language code when available in the source data. */
  lang: string;
  /** Agency timezone from the source data. */
  timezone: string;
}

/** Agency summaries derived from one source's `agency.txt` / DataBundle agency data. */
export interface DataSourceCatalogAgenciesSummary {
  items: DataSourceCatalogAgencySummary[];
}

/** Summary derived from one source's DataBundle file and contents. */
export interface DataSourceCatalogDataBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from this source's data.json bundle. */
  counts: DataSourceCatalogDataBundleCounts;
}

/** Summary derived from one source's ShapesBundle file and contents. */
export interface DataSourceCatalogShapesBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from this source's shapes.json bundle. */
  counts: DataSourceCatalogShapesBundleCounts;
}

/** Summary derived from one source's InsightsBundle file and contents. */
export interface DataSourceCatalogInsightsBundleSummary extends DataSourceCatalogFileBackedSummary {
  /** Entity counts derived from this source's insights.json bundle. */
  counts: DataSourceCatalogInsightsBundleCounts;
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
  /** Agency summaries derived from this source's data.json bundle. */
  agencies: DataSourceCatalogAgenciesSummary;
  /** Translation languages summary derived from this source's data.json bundle. */
  i18n: DataSourceCatalogI18nSummary;
  /** Route summary derived from this source's data.json bundle. */
  routes: DataSourceCatalogRoutesSummary;
  /** Stops summary derived from this source's data.json bundle. */
  stops: DataSourceCatalogStopsSummary;
  /** Summary derived from this source's data.json bundle. */
  data: DataSourceCatalogDataBundleSummary;
  /** Summary derived from this source's shapes.json bundle, when present. */
  shapes?: DataSourceCatalogShapesBundleSummary;
  /** Summary derived from this source's insights.json bundle. */
  insights: DataSourceCatalogInsightsBundleSummary;
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
  globalInsights: BundleSection<1, DataSourceCatalogGlobalInsights>;
}
