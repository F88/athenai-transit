/**
 * Definition of an ODPT JSON API data source.
 *
 * ODPT (Open Data for Public Transportation) provides various transit
 * data as JSON APIs: station info, route info, timetables, etc.
 * Each resource corresponds to a single API endpoint.
 *
 * This is a type definition only — not yet consumed by the pipeline.
 */

import type { BaseResource, MlitShapeMapping, PipelineConfig } from './resource-common';

export type {
  Authentication,
  BaseResource,
  Catalog,
  DataFormat,
  License,
  MlitShapeMapping,
  PipelineConfig,
  Provider,
} from './resource-common';

/**
 * An ODPT JSON source definition file exports this type.
 * Combines resource metadata with pipeline processing settings.
 */
export interface OdptJsonSourceDefinition {
  /** ODPT JSON resource metadata. */
  resource: OdptJsonResource;
  /** Pipeline processing settings for this resource. */
  pipeline: PipelineConfig;
}

/** Metadata describing an ODPT JSON API resource. */
export interface OdptJsonResource extends BaseResource {
  /** ODPT data type served by this endpoint. */
  odptType: OdptDataType;
  /** API endpoint URL (without authentication parameters). */
  endpointUrl: string;
  /**
   * Mapping from MLIT GeoJSON line names to route IDs for shape generation.
   * Used by `build-route-shapes-from-ksj-railway.ts` to extract line geometries from
   * National Land Numerical Information railway section data.
   */
  mlitShapeMapping?: MlitShapeMapping;
}

// ---------------------------------------------------------------------------
// OdptDataType
// ---------------------------------------------------------------------------

/**
 * ODPT data types available as JSON API endpoints.
 *
 * @see https://developer.odpt.org/
 */
export type OdptDataType =
  | 'odpt:Station'
  | 'odpt:Railway'
  | 'odpt:StationTimetable'
  | 'odpt:TrainTimetable'
  | 'odpt:BusRoute'
  | 'odpt:BusStop'
  | 'odpt:BusTimetable';
