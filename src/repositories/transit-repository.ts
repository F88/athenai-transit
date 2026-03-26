/**
 * @module TransitRepository
 *
 * Defines the abstract data-access contract for transit information.
 * UI components depend solely on this interface, keeping the data layer
 * swappable by providing different {@link TransitRepository} implementations.
 */

import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type { Agency, RouteType, Stop } from '../types/app/transit';
import type { SourceMeta, StopWithMeta } from '../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableResult,
  UpcomingTimetableResult,
} from '../types/app/repository';

/**
 * Maximum number of stops that any single query can return.
 *
 * This is an API-level cap. Even if the underlying dataset contains
 * more matching stops, implementations MUST NOT return more than
 * this number. When results are truncated to this limit, the
 * {@link CollectionResult.truncated} flag MUST be set to `true`.
 */
export const MAX_STOPS_RESULT = 50_000; // FOR TESTING WITH LARGE DATASETS

/**
 * Repository interface for querying transit stops and departures.
 *
 * All methods return `Promise` so that implementations can be
 * synchronous in-memory mocks or asynchronous data-store queries.
 *
 * Methods return {@link Result} or {@link CollectionResult} to
 * communicate domain-level errors without throwing.
 */
export interface TransitRepository {
  /**
   * Returns stops whose coordinates fall within the given bounding box,
   * sorted by distance from the bounding box center (nearest first).
   *
   * ### Sorting
   * Results are always sorted by Euclidean approximation distance from
   * the geographic center of `bounds` (nearest first). This ensures
   * deterministic ordering when `limit` truncates the result.
   *
   * ### Truncation
   * The effective limit is `Math.min(limit, MAX_STOPS_RESULT)`.
   * If the number of matching stops exceeds this effective limit,
   * only the nearest stops are returned and `truncated` is `true`.
   * If all matching stops fit within the limit, `truncated` is `false`.
   *
   * ### Error conditions
   * Always succeeds (`success: true`). An empty bounding box or one
   * covering no stops returns `{ success: true, data: [], truncated: false }`.
   *
   * @param bounds - Geographic bounding box to search within.
   * @param limit  - Maximum number of stops to return.
   *                 Capped at {@link MAX_STOPS_RESULT}.
   * @returns Stops within `bounds`, sorted by distance from center.
   */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>>;

  /**
   * Returns upcoming departures from a specific stop as
   * {@link ContextualTimetableEntry} items, sorted chronologically.
   *
   * Each entry includes route/headsign, boarding availability
   * (pickupType/dropOffType), pattern position (isTerminal/isOrigin),
   * and `serviceDate` for accurate minutes-to-Date conversion.
   * Consumers are responsible for filtering (e.g. excluding drop-off-only
   * entries) and grouping (e.g. by route+headsign for display).
   *
   * ### Sorting
   * Results are sorted by actual chronological time using
   * `minutesToDate(serviceDate, departureMinutes)`. This ensures
   * correct ordering when entries from different service days
   * (today vs previous day overnight) are mixed.
   *
   * ### Service day boundary
   * The GTFS service day does not change at midnight but at 03:00.
   * Before 03:00, `now` is treated as part of the previous calendar
   * day's service. This is handled internally via `getServiceDay()`.
   *
   * ### Overnight handling
   * Departures with times >= 24:00 (1440 minutes) on the current
   * service day are included as they represent late-night runs past
   * midnight. Additionally, overnight times from the previous service
   * day that extend into the current real-world time are included.
   * Each entry's `serviceDate` reflects which service day it belongs to.
   *
   * ### Truncation
   * `truncated` is `true` when the total number of upcoming entries
   * exceeds `limit`. When `limit` is omitted, all upcoming entries
   * are returned and `truncated` is `false`.
   *
   * Note: `limit` only truncates the returned `data` array. The
   * implementation still performs a full scan (for `meta`) and a
   * full sort (for overnight interleave), so `limit` does not
   * reduce computation cost. Callers that need all route+headsign
   * groups (e.g. T4 view) should omit `limit`.
   *
   * ### Error conditions
   * - No departure data for `stopId`:
   *   `{ success: false, error: "No departure data for stop: {stopId}" }`
   *
   * @param stopId - GTFS `stop_id` of the target stop.
   * @param now    - Real-world reference time. The service day is
   *                 determined internally (03:00 boundary).
   * @param limit  - Maximum number of entries to return.
   *                 When omitted, all upcoming entries are returned.
   * @returns ContextualTimetableEntry items sorted chronologically.
   */
  getUpcomingTimetableEntries(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<UpcomingTimetableResult>;

  /**
   * Returns all GTFS route_type values for a stop.
   *
   * Returns a deduplicated, ascending-sorted array of route_type values
   * for all routes serving the stop (e.g. `[0, 3]` for tram + bus).
   *
   * ### Error conditions
   * - No route type data for `stopId`:
   *   `{ success: false, error: "No route types for stop: {stopId}" }`
   *   The caller decides the fallback value (typically `[3]` = bus).
   *
   * @param stopId - GTFS `stop_id`.
   * @returns Sorted array of route_type values serving this stop.
   */
  getRouteTypesForStop(stopId: string): Promise<Result<RouteType[]>>;

  /**
   * Returns stops within a given radius from a center point,
   * sorted by distance (nearest first).
   *
   * Used to discover stops for edge-marker rendering when they
   * are outside the current map viewport.
   *
   * ### Sorting
   * Results are sorted by Euclidean approximation distance from
   * `center` (nearest first).
   *
   * ### Truncation
   * The effective limit is `Math.min(limit, MAX_STOPS_RESULT)`.
   * If the number of matching stops exceeds this effective limit,
   * only the nearest stops are returned and `truncated` is `true`.
   *
   * ### Error conditions
   * Always succeeds (`success: true`). A zero or negative radius
   * returns `{ success: true, data: [], truncated: false }`.
   *
   * @param center  - Geographic center point.
   * @param radiusM - Search radius in meters. Must be >= 0.
   * @param limit   - Maximum number of stops to return.
   *                  Capped at {@link MAX_STOPS_RESULT}.
   * @returns Stops within the specified radius, sorted by distance.
   */
  getStopsNearby(
    center: LatLng,
    radiusM: number,
    limit: number,
  ): Promise<CollectionResult<StopWithMeta>>;

  /**
   * Returns all route shapes for map polyline rendering.
   *
   * Each {@link RouteShape} contains the route color and an array of
   * `[lat, lon]` coordinate pairs forming the polyline.
   *
   * ### Sorting
   * No specific ordering is guaranteed.
   *
   * ### Truncation
   * Currently returns all shapes. `truncated` is `false` under
   * normal conditions.
   *
   * ### Error conditions
   * Always succeeds. If no shapes exist, returns
   * `{ success: true, data: [], truncated: false }`.
   *
   * @returns All route shapes in the dataset.
   */
  getRouteShapes(): Promise<CollectionResult<RouteShape>>;

  /**
   * Returns all departures for all route/headsign combinations at a stop
   * on the service day derived from `dateTime`.
   *
   * Returns every departure at the stop, each tagged with its route,
   * headsign, boarding availability, and pattern position.
   *
   * ### Sorting
   * Results are sorted by departure time (earliest first). When two
   * departures share the same minute, the order among them is unspecified.
   *
   * ### Calendar filtering
   * Only service IDs active on the GTFS service day are included.
   *
   * ### Error conditions
   * - No departure data for `stopId`:
   *   `{ success: true, data: [], truncated: false }` (not an error).
   *
   * @param stopId   - GTFS stop_id.
   * @param dateTime - Reference real-world time. The repository converts
   *                   this to the GTFS service day internally (03:00 boundary).
   * @returns All timetable entries at the stop for the service day.
   */
  getFullDayTimetableEntries(stopId: string, dateTime: Date): Promise<TimetableResult>;

  /**
   * Returns all stops in the dataset.
   *
   * Used for stop name search functionality.
   *
   * ### Sorting
   * No specific ordering is guaranteed.
   *
   * ### Truncation
   * Subject to {@link MAX_STOPS_RESULT}. If the dataset contains more
   * stops than MAX_STOPS_RESULT, only the first MAX_STOPS_RESULT stops
   * are returned and `truncated` is `true`.
   *
   * ### Error conditions
   * Always succeeds. An empty dataset returns
   * `{ success: true, data: [], truncated: false }`.
   *
   * @returns All stops (up to {@link MAX_STOPS_RESULT}).
   */
  getAllStops(): Promise<CollectionResult<Stop>>;

  /**
   * Returns an agency by its ID.
   *
   * ### Error conditions
   * - Unknown agency_id:
   *   `{ success: false, error: "Agency not found: {agencyId}" }`
   *
   * @param agencyId - The agency_id to look up.
   * @returns The Agency if found, or a failure Result if not found.
   */
  getAgency(agencyId: string): Promise<Result<Agency>>;

  /**
   * Returns metadata for all loaded data sources.
   *
   * Each {@link SourceMeta} contains the data validity period and
   * version for a single source (identified by prefix). Sources
   * without feed-info data are omitted from the result.
   *
   * ### Error conditions
   * Always succeeds. If no sources have metadata, returns
   * `{ success: true, data: [], truncated: false }`.
   *
   * @returns Metadata for all sources with validity information.
   */
  getAllSourceMeta(): Promise<CollectionResult<SourceMeta>>;
}
