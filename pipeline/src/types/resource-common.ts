/**
 * Common sub-types shared across resource definitions
 * (GTFS, GTFS-RT, ODPT JSON, etc.).
 */

// ---------------------------------------------------------------------------
// Catalog — discriminated union
// ---------------------------------------------------------------------------

/** Resource published on ODPT (Public Transportation Open Data Center). */
export interface CatalogOdpt {
  type: 'odpt';
  /** CKAN organization page URL (e.g. https://ckan.odpt.org/organization/...). */
  organizationUrl: string;
  /** CKAN dataset page URL (e.g. https://ckan.odpt.org/dataset/...). */
  datasetUrl: string;
  /** CKAN resource page URL for the current version. */
  resourceUrl: string;
  /** CKAN resource UUID for the current version. */
  resourceId: string;
}

/** Resource published on a municipal or other catalog site. */
export interface CatalogMunicipal {
  type: 'municipal';
  /** URL of the catalog page, if available. */
  url?: string;
}

/** Resource with no catalog (direct URL). */
export interface CatalogDirect {
  type: 'direct';
}

/** Data catalog where a resource is published. */
export type Catalog = CatalogOdpt | CatalogMunicipal | CatalogDirect;

// ---------------------------------------------------------------------------
// Authentication — discriminated union
// ---------------------------------------------------------------------------

/** Authentication is required to access this resource. */
export interface AuthenticationRequired {
  required: true;
  /** Authentication method (e.g. "acl:consumerKey query parameter"). */
  method: string;
  /** URL where developers can register for API access. */
  registrationUrl: string;
}

/** No authentication required. */
export interface AuthenticationNone {
  required: false;
}

/** Authentication requirements for accessing a resource. */
export type Authentication = AuthenticationRequired | AuthenticationNone;

// ---------------------------------------------------------------------------
// BaseResource
// ---------------------------------------------------------------------------

/**
 * Common fields shared by all resource types (GTFS, ODPT JSON, etc.).
 *
 * Concrete resource interfaces (e.g. GtfsResource, OdptJsonResource) extend
 * this with format-specific fields.
 */
export interface BaseResource {
  /** English display name of this resource. */
  nameEn: string;
  /** Japanese display name of this resource. */
  nameJa: string;
  /** Free-text description of this resource. */
  description: string;
  /** Data format and associated specification metadata. */
  dataFormat: DataFormat;
  /** License information. */
  license: License;
  /** Data catalog where this resource is published. */
  catalog: Catalog;
  /** Data provider (transit operator or municipality). */
  provider: Provider;
  /** Authentication requirements for accessing this resource. */
  authentication: Authentication;
}

// ---------------------------------------------------------------------------
// DataFormat — discriminated union
// ---------------------------------------------------------------------------

/** GTFS-JP format (Japanese extension of GTFS). */
export interface DataFormatGtfsJp {
  type: 'GTFS/GTFS-JP';
  /** GTFS Schedule date-based revision (e.g. "October 2025"). */
  revision?: string;
  /** GTFS-JP spec version (e.g. "3.0", "4.0"). */
  jpVersion?: string;
}

/** Standard GTFS format. */
export interface DataFormatGtfs {
  type: 'GTFS';
  /** GTFS Schedule date-based revision (e.g. "October 2025"). */
  revision?: string;
}

/** ODPT JSON API format. */
export interface DataFormatOdptJson {
  type: 'ODPT-JSON';
}

/**
 * Discriminated union of data formats across all resource types.
 *
 * Use `dataFormat.type` to narrow:
 * ```ts
 * if (resource.dataFormat.type === 'GTFS/GTFS-JP') {
 *   resource.dataFormat.jpVersion; // string | undefined
 * }
 * ```
 */
export type DataFormat = DataFormatGtfsJp | DataFormatGtfs | DataFormatOdptJson;

// ---------------------------------------------------------------------------
// Provider / License
// ---------------------------------------------------------------------------

/** Data provider information. */
export interface Provider {
  /** Multilingual display names with long/short variants. */
  name: {
    ja: { long: string; short: string };
    en: { long: string; short: string };
  };
  /** Provider's website URL, if known. */
  url?: string;
  /** Brand colors. [0]=primary, [1]=secondary, etc. */
  colors?: { bg: string; text: string }[];
}

/** License information. */
export interface License {
  /** License name (e.g. "CC BY 4.0"). */
  name: string;
  /** URL to the full license text. */
  url: string;
}

// ---------------------------------------------------------------------------
// MlitShapeMapping
// ---------------------------------------------------------------------------

/**
 * Mapping from MLIT GeoJSON line names to app-data route IDs for shape generation.
 * Used by `build-route-shapes-from-ksj-railway.ts` to extract line geometries from
 * National Land Numerical Information railway section data.
 */
export interface MlitShapeMapping {
  /** Operator name used to filter GeoJSON features (e.g. "東京都"). */
  operator: string;
  /** Map from GeoJSON line name (N02_003) to prefixed route_id. */
  lineToRouteId: Record<string, string>;
}

// ---------------------------------------------------------------------------
// PipelineConfig
// ---------------------------------------------------------------------------

/** Pipeline processing settings shared across all resource types. */
export interface PipelineConfig {
  /** Output directory name for storing fetched data (e.g. "toei-bus", "yurikamome"). */
  outDir: string;
  /** Short prefix for ID namespacing in output (e.g. "tobus", "yrkm"). */
  prefix: string;
  /**
   * Output filename for the downloaded file.
   * If omitted, derived from the URL or resource metadata.
   */
  outFileName?: string;
}
