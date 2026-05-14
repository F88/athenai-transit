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

/**
 * Pipeline-generated catalog payload for a single source prefix.
 *
 * This is a curated subset of cross-bundle derived facts intended for
 * discovery and comparison by any v2 JSON consumer. Editorial fields
 * such as display labels, brand colors, enable/disable defaults, and
 * license copy intentionally remain outside this schema.
 */
export interface DataSourceCatalogSource {
  /** Placeholder to keep the outline type object-shaped until sections are added. */
  _reserved?: never;
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

  /** Whole-bundle metadata such as build timestamp. */
  metadata: BundleSection<1, DataSourceCatalogMetadata>;
  /** Per-source metadata and summary payloads keyed by source prefix. */
  sources: BundleSection<1, Record<string, DataSourceCatalogSource>>;
}
