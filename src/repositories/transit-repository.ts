/**
 * @module TransitRepository
 *
 * Defines the abstract data-access contract for transit information.
 * UI components depend solely on this interface, keeping the data layer
 * swappable by providing different {@link TransitRepository} implementations.
 */

import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type {
  DepartureGroup,
  FullDayStopDeparture,
  RouteType,
  Stop,
  StopWithMeta,
} from '../types/app/transit';
import type { CollectionResult, Result } from '../types/app/repository';

/**
 * Maximum number of stops that any single query can return.
 *
 * This is an API-level cap. Even if the underlying dataset contains
 * more matching stops, implementations MUST NOT return more than
 * this number. When results are truncated to this limit, the
 * {@link CollectionResult.truncated} flag MUST be set to `true`.
 */
export const MAX_STOPS_RESULT = 5000;

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
   * Returns upcoming departures from a specific stop, grouped by
   * route and headsign.
   *
   * Each group contains up to `limit` departure times (earliest first).
   * Groups are sorted by their earliest departure time.
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
   *
   * ### Truncation
   * `truncated` is `true` when any route/headsign group had more
   * upcoming departures than `limit` allowed. When `limit` is omitted,
   * `truncated` is always `false`.
   *
   * ### Error conditions
   * - No departure data for `stopId`:
   *   `{ success: false, error: "No departure data for stop: {stopId}" }`
   *
   * @param stopId - GTFS `stop_id` of the target stop.
   * @param now    - Real-world reference time. The service day is
   *                 determined internally (03:00 boundary).
   * @param limit  - Maximum number of departures per route/headsign.
   *                 When omitted, all upcoming departures are returned.
   * @returns Departure groups sorted by earliest departure.
   */
  getUpcomingDepartures(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<CollectionResult<DepartureGroup>>;

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
   * Returns all departure times (in minutes from midnight) for a
   * specific stop/route/headsign combination on a given date.
   *
   * ### Sorting
   * Results are sorted in ascending order (earliest first).
   * Overnight times (>= 1440, i.e. past midnight) appear at the end.
   *
   * ### Calendar filtering
   * Only service IDs active on the GTFS service day (per calendar and
   * calendar exceptions) are included.
   *
   * ### Truncation
   * Currently returns all departures for the day. `truncated` is
   * `false` under normal conditions.
   *
   * ### Error conditions
   * - Unknown combination of stopId/routeId/headsign:
   *   Returns `{ success: true, data: [], truncated: false }` (not an error).
   *
   * @param stopId    - GTFS stop_id.
   * @param routeId   - GTFS route_id.
   * @param headsign  - Trip headsign string.
   * @param dateTime  - Reference real-world time. The repository converts
   *                    this to the GTFS service day internally (03:00 boundary).
   * @returns Sorted array of departure minutes from midnight.
   */
  getFullDayDepartures(
    stopId: string,
    routeId: string,
    headsign: string,
    dateTime: Date,
  ): Promise<CollectionResult<number>>;

  /**
   * Returns all departures for all route/headsign combinations at a stop
   * on the service day derived from `dateTime`.
   *
   * Unlike {@link getFullDayDepartures}, this method does not require a
   * specific route/headsign — it returns every departure at the stop,
   * each tagged with its route and headsign.
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
   * @returns All departures at the stop for the service day.
   */
  getFullDayDeparturesForStop(
    stopId: string,
    dateTime: Date,
  ): Promise<CollectionResult<FullDayStopDeparture>>;

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
}
