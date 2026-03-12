/**
 * Definition of a single GTFS static data source (1 ZIP = 1 resource).
 *
 * Each resource file under `pipeline/data/gtfs/{directory}.ts` exports
 * a {@link GtfsSourceDefinition}. All metadata needed to download,
 * process, and attribute the data is self-contained in each resource.
 *
 * Scoped to GTFS / GTFS-JP static data only.
 */

import type { BaseResource, PipelineConfig } from './resource-common';

// Re-export common types for convenience
export type {
  Authentication,
  BaseResource,
  Catalog,
  DataFormat,
  License,
  PipelineConfig,
  Provider,
} from './resource-common';

/**
 * A GTFS source definition file exports this type.
 * Combines resource metadata with pipeline processing settings.
 */
export interface GtfsSourceDefinition {
  /** GTFS resource metadata. */
  resource: GtfsResource;
  /** Pipeline processing settings for this resource. */
  pipeline: PipelineConfig;
}

/** Metadata describing a GTFS static data resource. */
export interface GtfsResource extends BaseResource {
  /** GTFS route_type values contained in this resource (e.g. ['tram', 'subway', 'monorail']). */
  routeTypes: GtfsRouteType[];
  /** Download URL for the GTFS ZIP file. */
  downloadUrl: string;
  /**
   * Fallback route colors for routes missing route_color in GTFS data.
   * Key: route_id (without prefix), Value: hex color (without #).
   */
  routeColorFallbacks?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// GtfsRouteType
// ---------------------------------------------------------------------------

/**
 * Human-readable GTFS route_type identifiers.
 *
 * Maps to GTFS route_type numeric values:
 * tram=0, subway=1, rail=2, bus=3, ferry=4,
 * cable-tram=5, gondola=6, funicular=7, trolleybus=11, monorail=12
 */
export type GtfsRouteType =
  | 'tram' // 0
  | 'subway' // 1
  | 'rail' // 2
  | 'bus' // 3
  | 'ferry' // 4
  | 'cable-tram' // 5
  | 'gondola' // 6
  | 'funicular' // 7
  | 'trolleybus' // 11
  | 'monorail'; // 12
