/**
 * @module TransitDataSourceV2
 *
 * Defines the contract for loading v2 bundle JSON data from an external source.
 * Each bundle type (data, shapes, insights) is loaded independently,
 * enabling lazy-loading of non-essential data after app startup.
 *
 * v1 loaded 8 individual JSON files per source in a single `load()` call.
 * v2 splits data into bundles with distinct load timing:
 * - data.json: required at startup (stops, routes, calendar, timetable, etc.)
 * - shapes.json: lazy-loaded when the shapes layer is toggled on
 * - insights.json: lazy-loaded when analytics views are accessed
 * - global/insights.json: lazy-loaded, cross-source spatial analytics
 */

import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '../types/data/transit-v2-json';

/**
 * Raw data for a single v2 source, as loaded from the data bundle.
 *
 * Wraps {@link DataBundle} with the source prefix so that callers
 * can track which source each dataset belongs to when loading
 * multiple sources in parallel.
 */
export interface SourceDataV2 {
  /** Source identifier (e.g. "tobus", "kobus"). */
  prefix: string;
  /** The parsed data.json bundle. */
  data: DataBundle;
}

/**
 * Data source abstraction for loading v2 bundle JSON data.
 *
 * Unlike v1's single `load()` method, v2 separates loading by bundle
 * type to support lazy-loading. Only {@link loadData} is required at
 * startup; other bundles are loaded on demand.
 *
 * Implementations handle fetch, parsing, and bundle_version/kind
 * validation. Errors should be thrown for required data; optional
 * bundles return `null` when the data is unavailable (not found,
 * network error, timeout, or non-JSON response).
 */
export interface TransitDataSourceV2 {
  /**
   * Load the data bundle for a single source.
   *
   * This is the only bundle required at startup. Contains stops,
   * routes, calendar, timetable, tripPatterns, translations, and lookup.
   *
   * @param prefix - Source identifier (e.g. "tobus").
   * @returns The parsed data bundle wrapped with the source prefix.
   * @throws When the file fails to load or has an invalid format.
   */
  loadData(prefix: string): Promise<SourceDataV2>;

  /**
   * Load the shapes bundle for a single source.
   *
   * Contains route polyline shapes for map rendering. Intended to be
   * loaded lazily after startup (e.g. when shapes layer is enabled).
   *
   * @param prefix - Source identifier (e.g. "tobus").
   * @returns The parsed shapes bundle, or `null` if unavailable
   *          (not found, network error, timeout, non-JSON, or parse error).
   */
  loadShapes(prefix: string): Promise<ShapesBundle | null>;

  /**
   * Load the insights bundle for a single source.
   *
   * Contains precomputed analytics (trip pattern stats/geo, stop stats).
   * Intended to be loaded lazily when analytics views are accessed.
   *
   * @param prefix - Source identifier (e.g. "tobus").
   * @returns The parsed insights bundle, or `null` if unavailable
   *          (not found, network error, timeout, non-JSON, or parse error).
   */
  loadInsights(prefix: string): Promise<InsightsBundle | null>;

  /**
   * Load the global insights bundle (cross-source analytics).
   *
   * Contains metrics computed across all sources (e.g. stop geo).
   * Loaded independently of any specific source prefix.
   *
   * @returns The parsed global insights bundle, or `null` if unavailable
   *          (not found, network error, timeout, non-JSON, or parse error).
   */
  loadGlobalInsights(): Promise<GlobalInsightsBundle | null>;
}
