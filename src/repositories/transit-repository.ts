/**
 * @module TransitRepository
 *
 * Defines the abstract data-access contract for transit information.
 * UI components depend solely on this interface, keeping the data layer
 * swappable by providing different {@link TransitRepository} implementations.
 */

import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type { Agency, AppRouteTypeValue, Stop } from '../types/app/transit';
import type {
  SourceMeta,
  StopWithMeta,
  TripInspectionGroupQuery,
  TripInspectionTarget,
} from '../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableResult,
  TripSnapshotResult,
  UpcomingTimetableResult,
} from '../types/app/repository';
import type { TripLocator } from '../types/app/transit-composed';

/**
 * Maximum number of stops that a capped stop query can return.
 *
 * This is an API-level cap for stop-query methods that normalize their
 * `limit` with {@link normalizeStopQueryLimit}. Even if the underlying
 * dataset contains more matching stops, those methods MUST NOT return
 * more than this number. When results are truncated to this limit, the
 * `truncated` flag on {@link CollectionResult} MUST be set to `true`.
 */
export const MAX_STOP_QUERY_RESULT = 50_000; // FOR TESTING WITH LARGE DATASETS

/**
 * Normalizes a stop-query limit to a safe API-level value.
 *
 * The returned limit is a non-negative integer capped at
 * {@link MAX_STOP_QUERY_RESULT}. Negative and non-finite inputs are treated as `0`.
 * Fractional inputs are truncated toward zero.
 *
 * @param limit - Requested stop-query limit.
 * @returns Safe non-negative integer limit for stop collections.
 */
export function normalizeStopQueryLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(limit), MAX_STOP_QUERY_RESULT));
}

/**
 * Normalizes a generic truncation limit while preserving caller intent.
 *
 * The returned limit is a non-negative integer with no repository-level cap.
 * Negative and non-finite inputs are treated as `0`, and fractional inputs
 * are truncated toward zero.
 *
 * @param limit - Requested truncation limit.
 * @returns Safe non-negative integer limit.
 */
export function normalizeResultLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }

  return Math.max(0, Math.trunc(limit));
}

/**
 * Normalizes an optional truncation limit while preserving omission semantics.
 *
 * `undefined` means "no explicit caller limit" and is preserved so methods
 * can still distinguish between omitted-limit and zero-limit behavior.
 *
 * @param limit - Requested truncation limit, if any.
 * @returns Safe limit, or `undefined` when the caller omitted it.
 */
export function normalizeOptionalResultLimit(limit?: number): number | undefined {
  if (limit === undefined) {
    return undefined;
  }

  return normalizeResultLimit(limit);
}

/**
 * Repository interface for querying transit stops and stop times.
 *
 * The interface intentionally mixes async and sync methods.
 * Data-loading and lookup APIs that may depend on external I/O expose
 * `Promise`-wrapped return values, while cheap derived-value helpers may
 * stay synchronous.
 *
 * Return shapes are also intentionally mixed. Some methods use
 * {@link Result} or {@link CollectionResult} to communicate domain-level
 * errors without throwing, while others return plain collections or
 * derived values directly.
 *
 * ### Error messages
 * `error` strings on failure {@link Result} values are human-readable and
 * implementation-specific. Consumers MUST NOT parse them or rely on their
 * exact wording. Use the per-method `### Error conditions` documentation
 * (and, where applicable, additional fields on the result) to distinguish
 * error categories programmatically. The example strings shown in method
 * TSDocs are illustrative only.
 *
 * ### Date/time parameters
 * Methods that accept a `Date` may be called with any user-selected
 * date/time, not just the current wall-clock time. This includes real-time
 * values from `new Date()` as well as custom time values from `?time=` or
 * the app's time-setting UI.
 *
 * There are two distinct contracts:
 * - Reference datetime parameters such as `referenceDateTime` / `dateTime` accept an
 *   arbitrary real-world date/time and are normalized internally to the
 *   GTFS service day when needed.
 * - `serviceDate` parameters are already normalized to the GTFS service day
 *   by the caller and must not be treated as raw reference datetimes.
 *
 * Method classification:
 * - Reference datetime (arbitrary date/time, normalized internally):
 *   `getUpcomingTimetableEntries(referenceDateTime)`,
 *   `getFullDayTimetableEntries(dateTime)`
 * - Pre-normalized service day (caller passes `getServiceDay(...)` result):
 *   `getTripSnapshot(serviceDate)`,
 *   `getTripInspectionTargets(query.serviceDate)`,
 *   `resolveStopStats(serviceDate)`,
 *   `resolveRouteFreq(serviceDate)`
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
   * The effective limit is `normalizeStopQueryLimit(limit)`.
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
   *                 Negative and non-finite values are treated as `0`.
   *                 Fractional values are truncated toward zero and then
   *                 capped at {@link MAX_STOP_QUERY_RESULT}.
   * @returns Stops within `bounds`, sorted by distance from center.
   */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>>;

  /**
   * Returns upcoming timetable entries from a specific stop as
   * {@link ContextualTimetableEntry} items, sorted chronologically.
   *
   * Each entry includes route/headsign, boarding availability
   * (pickupType/dropOffType), pattern position (isTerminal/isOrigin),
   * and `serviceDate` for accurate minutes-to-Date conversion.
   * Consumers are responsible for filtering (e.g. excluding drop-off-only
   * entries) and grouping (e.g. by route+headsign for display).
   *
   * ### Sorting
   * Results are sorted by {@link sortTimetableEntriesChronologically}
   * (defined in `src/domain/transit/sort-timetable-entries.ts`).
   * See that function's TSDoc for the canonical sort order spec.
   *
   * ### Service day boundary
   * The GTFS service day does not change at midnight but at 03:00.
   * Before 03:00, `referenceDateTime` is treated as part of the previous calendar
   * day's service. This is handled internally via {@link getServiceDay}.
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
   * exceeds the normalized `limit`. When `limit` is omitted, all upcoming entries
   * are returned and `truncated` is `false`.
   *
   * `limit` controls only the number of returned entries.
   *
   * ### Error conditions
   * - No stop time data for `stopId`:
   *   `{ success: false, error: "No stop time data for stop: {stopId}" }`
   *
   * @param stopId - GTFS `stop_id` of the target stop.
   * @param referenceDateTime - Reference date/time for the query. This may be
   *                            the live current time or an arbitrary custom
   *                            time selected by the user. The repository
   *                            determines the GTFS service day internally
   *                            (03:00 boundary).
   * @param limit  - Maximum number of entries to return.
   *                 When omitted, all upcoming entries are returned.
   *                 Negative and non-finite values are treated as `0`.
   *                 Fractional values are truncated toward zero.
   * @returns {@link ContextualTimetableEntry} items sorted chronologically.
   */
  getUpcomingTimetableEntries(
    stopId: string,
    referenceDateTime: Date,
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
  getRouteTypesForStop(stopId: string): Promise<Result<AppRouteTypeValue[]>>;

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
   * The effective limit is `normalizeStopQueryLimit(limit)`.
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
   *                  Negative and non-finite values are treated as `0`.
   *                  Fractional values are truncated toward zero and then
   *                  capped at {@link MAX_STOP_QUERY_RESULT}.
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
   * Returns all timetable entries for all route/headsign combinations at a stop
   * on the service day derived from `dateTime`.
   *
   * Returns every timetable entry at the stop, each tagged with its route,
   * headsign, boarding availability, and pattern position.
   *
   * ### Sorting
   * Results are sorted by {@link sortTimetableEntriesByDepartureTime}
   * (defined in `src/domain/transit/sort-timetable-entries.ts`).
   * See that function's TSDoc for the canonical sort order spec.
   *
   * ### Calendar filtering
   * Only service IDs active on the GTFS service day are included.
   * Implementations are expected to derive that service day from `dateTime`
   * internally rather than requiring callers to pre-normalize it.
   *
   * ### Error conditions
   * - No stop time data for `stopId`:
   *   `{ success: true, data: [], truncated: false }` (not an error).
   *
   * @param stopId   - GTFS stop_id.
   * @param dateTime - Reference date/time for the query. This may be the live
   *                   current time or an arbitrary custom time selected by the
   *                   user. The repository converts it to the GTFS service day
   *                   internally (03:00 boundary).
   * @returns All timetable entries at the stop for the service day.
   */
  getFullDayTimetableEntries(stopId: string, dateTime: Date): Promise<TimetableResult>;

  /**
   * Reconstructs a whole trip from the minimal repository-side locator.
   *
   * This method returns only trip-level data and the full stop list.
   * Callers that need a current stop can resolve it afterward using
   * their own selection context.
   *
   * `serviceDate` is attached to the returned snapshot as caller-owned context.
   * Implementations do not re-derive a service day from it and do not use it
   * to recompute departure or arrival minutes.
   *
   * @param locator - Repository-specific trip locator.
   * @param serviceDate - Pre-normalized GTFS service day to attach to the
   *                      returned snapshot. Implementations treat this as
   *                      caller-owned context and pass it through without
   *                      additional normalization.
   * @returns Whole-trip payload, or an error when reconstruction is unavailable.
   */
  getTripSnapshot(locator: TripLocator, serviceDate: Date): TripSnapshotResult;

  /**
   * Returns trip-inspection targets for departures at the same stop on the
   * provided service day.
   *
   * Each target carries only the minimal fields needed for trip inspection and
   * candidate comparison. In particular, `departureMinutes` is included so
   * callers can compare or reorder candidates without reloading full timetable
   * entries.
   *
   * ### Sorting
   * Results are sorted with the same ordering as
   * {@link sortTimetableEntriesByDepartureTime}: `departureMinutes` ascending,
   * then `stopIndex` ascending, then route ID ascending.
   *
   * `query.serviceDate` must already be normalized to the GTFS service day.
   * Implementations use it as the service-day context for calendar filtering;
   * callers should not pass a raw real-world datetime here.
   *
   * @param query - Minimal trip + stop context for grouping neighboring departures.
   *                `query.serviceDate` is a pre-normalized service day, not a
   *                reference datetime.
   * @returns Trip-inspection targets with lightweight comparison data.
   */
  getTripInspectionTargets(
    query: TripInspectionGroupQuery,
  ): Promise<Result<TripInspectionTarget[]>>;

  /**
   * Returns a single stop with metadata by its GTFS stop_id, against
   * the **full loaded dataset** (not just the current viewport).
   *
   * Async single-id variant of {@link getStopMetaByIds}. "Full dataset"
   * describes the search scope, not the implementation strategy.
   *
   * For batched lookups, use {@link getStopMetaByIds} instead.
   *
   * Use this for arbitrary-id lookups that must work outside the current view.
   *
   * ### Error conditions
   * - Unknown stop_id:
   *   `{ success: false, error: "Stop not found: {stopId}" }`
   *
   * @param stopId - GTFS `stop_id` to look up.
   * @returns The {@link StopWithMeta} if found, or a failure {@link Result}
   *   if not found.
   */
  getStopMetaById(stopId: string): Promise<Result<StopWithMeta>>;

  /**
   * Returns {@link StopWithMeta} for each of the given stop IDs against the
   * **full loaded dataset**, not just the current viewport.
   *
   * "Full dataset" describes the search scope: any stop loaded into the
   * repository, regardless of where it sits geographically.
   *
   * Use this method whenever the caller holds a set of stable stop IDs
   * that may refer to stops anywhere in the dataset, including stops
   * outside the current map viewport or nearby radius.
   *
   * Do not substitute viewport-limited helpers for these cases.
   *
   * ### Behavior
   * - Unknown stop IDs are silently skipped — the result length may
   *   be smaller than `stopIds.size`.
   * - The returned array preserves no particular order; callers that
   *   need a lookup map should `new Map(metas.map((m) => [m.stop.stop_id, m]))`.
   *
   * @param stopIds - Set of stop IDs to look up. Can include IDs
   *                  from any data source loaded into the repository.
   * @returns Array of {@link StopWithMeta} for found stops, in unspecified order.
   */
  getStopMetaByIds(stopIds: Set<string>): StopWithMeta[];

  /**
   * Returns all stops that the repository treats as addressable stop entries.
   *
   * Used for stop name search functionality.
   *
   * This is not necessarily identical to every raw stop record present in the
   * underlying dataset. Implementations may exclude stops that are not yet
   * surfaced as user-selectable entries in the current UI. For example,
   * parent stations (`location_type=1`) may be omitted until station-grouping
   * support exists.
   *
   * ### Sorting
   * No specific ordering is guaranteed.
   *
   * ### Truncation
   * Returns the full loaded addressable stop set. `truncated` is always `false`.
   *
   * ### Error conditions
   * Always succeeds. An empty dataset returns
   * `{ success: true, data: [], truncated: false }`.
   *
   * @returns All addressable stops exposed by the repository.
   */
  getAllStops(): Promise<CollectionResult<Stop>>;

  /**
   * Returns the set of stop IDs served by the given routes.
   *
   * Scans trip patterns to collect all stops belonging to the specified routes.
   * A single route may have multiple trip patterns (e.g. different directions
   * or route variants), and the result is the union of all their stops.
   *
   * @param routeIds - Set of route IDs to look up.
   * @returns Set of stop IDs belonging to the specified routes.
   */
  getStopsForRoutes(routeIds: Set<string>): Set<string>;

  /**
   * Returns an agency by its ID.
   *
   * ### Error conditions
   * - Unknown agency_id:
   *   `{ success: false, error: "Agency not found: {agencyId}" }`
   *
   * @param agencyId - The agency_id to look up.
   * @returns The {@link Agency} if found, or a failure {@link Result}
   *   if not found.
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

  /**
   * Resolves per-stop stats for the service group matching the given service day.
   *
   * Uses active service IDs for the provided service day to select the best
   * matching service group from InsightsBundle data. Returns undefined if
   * insights are not loaded or no group matches.
   *
   * @param stopId - GTFS stop_id.
   * @param serviceDate - Pre-normalized GTFS service day.
   *   Callers should pass the result of {@link getServiceDay} or an
   *   equivalent repository-provided `serviceDate` value.
   * @returns Stats for the matched service group, or undefined.
   */
  resolveStopStats(stopId: string, serviceDate: Date): StopWithMeta['stats'] | undefined;

  /**
   * Resolves the number of trips on the route in the service day matching
   * the given service group.
   *
   * Returns the total number of GTFS trips (vehicle runs) for the route,
   * summed across all of the route's trip patterns. Each trip is counted
   * once at its pattern's origin (si=0). This is the trip count, not the
   * trip pattern count: a route with 2 patterns running 10 + 1 trips
   * returns 11.
   *
   * Returns undefined if insights are not loaded or no group matches.
   *
   * @param routeId - GTFS route_id.
   * @param serviceDate - Pre-normalized GTFS service day.
   *   Callers should pass the result of {@link getServiceDay} or an
   *   equivalent repository-provided `serviceDate` value.
   * @returns Number of trips in the matched service day, or undefined.
   */
  resolveRouteFreq(routeId: string, serviceDate: Date): number | undefined;
}
