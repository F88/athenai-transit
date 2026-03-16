import { vi } from 'vitest';
import type { Stop, StopWithMeta, Route, RouteType, StopWithContext } from '../types/app/transit';
import type { TransitRepository } from '../repositories/transit-repository';

/**
 * Creates a minimal Stop for testing.
 *
 * @param id - stop_id value
 * @param lat - stop_lat (default 35.0)
 * @param lon - stop_lon (default 139.0)
 * @returns A Stop object with sensible defaults
 */
export function makeStop(id: string, lat = 35.0, lon = 139.0): Stop {
  return {
    stop_id: id,
    stop_name: `Stop ${id}`,
    stop_names: {},
    stop_lat: lat,
    stop_lon: lon,
    location_type: 0,
    agency_id: '',
  };
}

/**
 * Wraps a Stop with distance metadata for testing.
 *
 * @param stop - The Stop to wrap (or a stop_id string for convenience)
 * @param distance - Distance in meters (default 100)
 * @returns A StopWithMeta object
 */
export function makeStopMeta(stop: Stop | string, distance = 100): StopWithMeta {
  const s = typeof stop === 'string' ? makeStop(stop) : stop;
  return { stop: s, distance, agencies: [], routes: [] };
}

/**
 * Creates a minimal Route for testing.
 *
 * @param id - route_id value
 * @param routeType - GTFS route_type (default 3 = bus)
 * @returns A Route object with sensible defaults
 */
export function makeRoute(id: string, routeType: RouteType = 3): Route {
  return {
    route_id: id,
    route_short_name: `R${id}`,
    route_long_name: `Route ${id}`,
    route_names: {},
    route_type: routeType,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: '',
  };
}

/**
 * Creates a minimal StopWithContext for testing.
 *
 * @param stop - The Stop to wrap
 * @param routeIds - Route IDs to generate DepartureGroups for
 * @param routeTypes - GTFS route_type values (default `[3]` = bus)
 * @returns A StopWithContext with one DepartureGroup per routeId
 */
export function makeStopWithContext(
  stop: Stop,
  routeIds: string[],
  routeTypes: RouteType[] = [3],
): StopWithContext {
  return {
    stop,
    routeTypes,
    groups: routeIds.map((rid) => ({
      route: makeRoute(rid),
      headsign: 'Test',
      headsign_names: {},
      departures: [new Date()],
    })),
    agencies: [],
    routes: routeIds.map((rid) => makeRoute(rid)),
  };
}

/**
 * Creates a mock TransitRepository for testing.
 *
 * All methods are vi.fn() stubs with sensible defaults.
 * Use `overrides` to customize specific methods.
 *
 * @param overrides - Partial TransitRepository to merge over defaults
 * @returns A fully-stubbed TransitRepository
 */
export function makeRepo(overrides: Partial<TransitRepository> = {}): TransitRepository {
  return {
    getStopsInBounds: vi.fn(),
    getUpcomingDepartures: vi.fn().mockResolvedValue({
      success: true,
      data: [],
      truncated: false,
    }),
    getRouteTypesForStop: vi.fn().mockResolvedValue({
      success: true,
      data: [3],
    }),
    getStopsNearby: vi.fn(),
    getRouteShapes: vi.fn(),
    getFullDayDepartures: vi.fn(),
    getFullDayDeparturesForStop: vi.fn().mockResolvedValue({
      success: true,
      data: [],
      truncated: false,
    }),
    getAllStops: vi.fn(),
    getAgency: vi.fn().mockResolvedValue({
      success: false,
      error: 'Not found',
    }),
    ...overrides,
  } as TransitRepository;
}
