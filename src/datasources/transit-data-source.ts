/**
 * @module TransitDataSource
 *
 * Defines the contract for loading raw GTFS JSON data from an external source.
 * Separates data fetching from data transformation, allowing test code to
 * inject fixture data without mocking `fetch`.
 */

import type {
  AgencyJson,
  CalendarJson,
  FeedInfoJson,
  RouteJson,
  ShapesJson,
  StopJson,
  TimetableJson,
  TranslationsJson,
} from '../types/data/transit-json';

/**
 * Raw data for a single GTFS source, as loaded from JSON files.
 *
 * @param prefix - Source identifier (e.g. "tobus", "toaran").
 * @param stops - Stop location data.
 * @param routes - Route definition data.
 * @param calendar - Calendar services and exceptions.
 * @param timetable - Departure timetables keyed by stop_id.
 * @param shapes - Route polyline shapes keyed by route_id.
 * @param agencies - Agency info (optional).
 * @param feedInfo - Feed metadata (optional, null if absent in source).
 * @param translations - Headsign translation lookup (optional).
 */
export interface SourceData {
  prefix: string;
  stops: StopJson[];
  routes: RouteJson[];
  calendar: CalendarJson;
  timetable: TimetableJson;
  shapes: ShapesJson;
  agencies?: AgencyJson[];
  feedInfo?: FeedInfoJson | null;
  translations?: TranslationsJson;
}

/**
 * Data source abstraction for loading raw GTFS JSON data.
 *
 * Implementations must load 5 required JSON files (stops, routes, calendar,
 * timetable, shapes) and 3 optional files (agency, feed-info, translations)
 * for a given source prefix, returning them as a single {@link SourceData}
 * object.
 *
 * Errors should be thrown; the caller (GtfsRepository.create) handles
 * them via existing try/catch logic.
 */
export interface TransitDataSource {
  /**
   * Load all GTFS data for a single source.
   *
   * @param prefix - Source identifier (e.g. "tobus").
   * @returns All raw JSON data for the source.
   * @throws When any required file fails to load.
   */
  load(prefix: string): Promise<SourceData>;
}
