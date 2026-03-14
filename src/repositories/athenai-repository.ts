import type {
  CalendarExceptionJson,
  CalendarServiceJson,
  ShapesJson,
  TimetableJson,
} from '../types/data/transit-json';
import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type {
  DepartureGroup,
  FullDayStopDeparture,
  Route,
  RouteType,
  Stop,
  StopWithMeta,
} from '../types/app/transit';
import type { CollectionResult, Result } from '../types/app/repository';
import { MAX_STOPS_RESULT } from './transit-repository';
import type { TransitDataSource } from '../datasources/transit-data-source';
import { FetchDataSource } from '../datasources/fetch-data-source';
import { createLogger } from '../utils/logger';
import { getServiceDay, getServiceDayMinutes } from '../domain/transit/service-day';
import type { TransitRepository } from './transit-repository';

const logger = createLogger('AthenaiRepository');

/**
 * Find the index of the first element >= target in a sorted array.
 * Returns array.length if all elements are less than target.
 */
function binarySearchFirstGte(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Format a date as "YYYYMMDD" string for calendar comparison. */
function formatDateKey(serviceDate: Date): string {
  const y = serviceDate.getFullYear();
  const m = String(serviceDate.getMonth() + 1).padStart(2, '0');
  const d = String(serviceDate.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Get the day-of-week index (0=mon .. 6=sun) for calendar.d array. */
function getDayIndex(serviceDate: Date): number {
  // JS: 0=Sun, 1=Mon, ..., 6=Sat -> GTFS: 0=Mon, ..., 6=Sun
  const jsDay = serviceDate.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * GTFS-based implementation of {@link TransitRepository}.
 *
 * Loads pre-built JSON files (stops, routes, calendar, timetable, shapes)
 * and provides in-memory querying for transit information.
 * Multiple GTFS sources can be merged into a single instance via
 * {@link AthenaiRepository.create}.
 */
export class AthenaiRepository implements TransitRepository {
  private activeServiceCache: { key: string; ids: Set<string> } | null = null;
  private stops: Stop[];
  private routeMap: Map<string, Route>;
  private stopRouteTypeMap: Map<string, RouteType[]>;
  private calendarServices: CalendarServiceJson[];
  private calendarExceptions: Map<string, CalendarExceptionJson[]>;
  private timetable: TimetableJson;
  private shapesRaw: ShapesJson;

  private constructor(
    stops: Stop[],
    routeMap: Map<string, Route>,
    stopRouteTypeMap: Map<string, RouteType[]>,
    calendarServices: CalendarServiceJson[],
    calendarExceptions: Map<string, CalendarExceptionJson[]>,
    timetable: TimetableJson,
    shapesRaw: ShapesJson,
  ) {
    this.stops = stops;
    this.routeMap = routeMap;
    this.stopRouteTypeMap = stopRouteTypeMap;
    this.calendarServices = calendarServices;
    this.calendarExceptions = calendarExceptions;
    this.timetable = timetable;
    this.shapesRaw = shapesRaw;
  }

  /**
   * Create a AthenaiRepository by loading and merging multiple GTFS sources.
   *
   * Each prefix corresponds to a set of JSON files under `/data/{prefix}/`.
   * Sources that fail to load are skipped with a warning.
   *
   * @param prefixes - Array of GTFS source prefixes (e.g. `["tobus", "toaran"]`).
   * @param dataSource - Data source to load GTFS files from.
   *                     Defaults to {@link FetchDataSource}.
   * @returns A fully initialized repository with merged data from all sources.
   */
  static async create(
    prefixes: string[],
    dataSource: TransitDataSource = new FetchDataSource(),
  ): Promise<AthenaiRepository> {
    logger.debug(`Loading sources: [${prefixes.join(', ')}]`);

    const perSource = await Promise.all(
      prefixes.map(async (prefix) => {
        try {
          return await dataSource.load(prefix);
        } catch (e) {
          logger.warn(`Skipping source "${prefix}": ${String(e)}`);
          return null;
        }
      }),
    );

    const loaded = perSource.filter((s): s is NonNullable<typeof s> => s !== null);
    logger.debug(`${loaded.length}/${prefixes.length} sources loaded`);

    // Merge stops
    const stopsRaw = loaded.flatMap((s) => s.stops);
    const stops: Stop[] = stopsRaw.map((s) => ({
      stop_id: s.i,
      stop_name: s.n,
      stop_names: s.m,
      stop_lat: s.a,
      stop_lon: s.o,
      location_type: s.l,
    }));

    // Merge routes
    const routeMap = new Map<string, Route>();
    for (const source of loaded) {
      for (const r of source.routes) {
        routeMap.set(r.i, {
          route_id: r.i,
          route_short_name: r.s,
          route_long_name: r.l,
          route_names: r.m ?? {},
          route_type: r.t as RouteType,
          route_color: r.c,
          route_text_color: r.tc,
          agency_id: r.ai ?? '',
        });
      }
    }

    // Merge calendar
    const calendarServices = loaded.flatMap((s) => s.calendar.services);
    const exceptionMap = new Map<string, CalendarExceptionJson[]>();
    for (const source of loaded) {
      for (const ex of source.calendar.exceptions) {
        let list = exceptionMap.get(ex.i);
        if (!list) {
          list = [];
          exceptionMap.set(ex.i, list);
        }
        list.push(ex);
      }
    }

    // Merge timetable
    const timetable: TimetableJson = {};
    for (const source of loaded) {
      for (const [stopId, groups] of Object.entries(source.timetable)) {
        if (timetable[stopId]) {
          timetable[stopId].push(...groups);
        } else {
          timetable[stopId] = [...groups];
        }
      }
    }

    // Merge shapes
    const shapesRaw: ShapesJson = {};
    for (const source of loaded) {
      Object.assign(shapesRaw, source.shapes);
    }

    // Build stop -> routeTypes map (all route_type values, deduplicated and sorted)
    const stopRouteTypeMap = new Map<string, RouteType[]>();
    for (const [stopId, groups] of Object.entries(timetable)) {
      const types = new Set<RouteType>();
      for (const group of groups) {
        const route = routeMap.get(group.r);
        if (route) {
          types.add(route.route_type);
        }
      }
      if (types.size > 0) {
        stopRouteTypeMap.set(
          stopId,
          [...types].sort((a, b) => a - b),
        );
      }
    }

    return new AthenaiRepository(
      stops,
      routeMap,
      stopRouteTypeMap,
      calendarServices,
      exceptionMap,
      timetable,
      shapesRaw,
    );
  }

  /** {@inheritDoc TransitRepository.getStopsInBounds} */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    logger.debug('bounds query:', bounds);

    const effectiveLimit = Math.min(limit, MAX_STOPS_RESULT);
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    const matching: { stop: Stop; dist: number }[] = [];
    for (const stop of this.stops) {
      if (
        stop.stop_lat >= bounds.south &&
        stop.stop_lat <= bounds.north &&
        stop.stop_lon >= bounds.west &&
        stop.stop_lon <= bounds.east
      ) {
        const dlat = stop.stop_lat - centerLat;
        const dlng = stop.stop_lon - centerLng;
        const dist = dlat * dlat + dlng * dlng;
        matching.push({ stop, dist });
      }
    }

    matching.sort((a, b) => a.dist - b.dist);

    const truncated = matching.length > effectiveLimit;
    const data = matching.slice(0, effectiveLimit).map((m) => ({ stop: m.stop }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getStopsNearby} */
  getStopsNearby(
    center: LatLng,
    radiusM: number,
    limit: number,
  ): Promise<CollectionResult<StopWithMeta>> {
    if (radiusM <= 0) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const effectiveLimit = Math.min(limit, MAX_STOPS_RESULT);
    const radiusKm = radiusM / 1000;
    const sorted = this.stops
      .map((stop) => {
        const dlat = stop.stop_lat - center.lat;
        const dlng = stop.stop_lon - center.lng;
        // Rough approximation: 1 degree lat ~ 111km, 1 degree lng ~ 91km (at 35 N)
        const distKm = Math.sqrt((dlat * 111) ** 2 + (dlng * 91) ** 2);
        return { stop, distKm };
      })
      .filter(({ distKm }) => distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm);

    const truncated = sorted.length > effectiveLimit;
    const data = sorted
      .slice(0, effectiveLimit)
      .map(({ stop, distKm }) => ({ stop, distance: distKm * 1000 }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getUpcomingDepartures} */
  getUpcomingDepartures(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<CollectionResult<DepartureGroup>> {
    const timetableGroups = this.timetable[stopId];
    if (!timetableGroups) {
      return Promise.resolve({ success: false, error: `No departure data for stop: ${stopId}` });
    }

    // Use service day boundary (03:00) to determine which calendar day
    // we are operating on. Before 03:00, we are still on the previous
    // day's service (and nowMinutes will be >= 1440).
    const serviceDay = getServiceDay(now);
    const todayServiceIds = this.getActiveServiceIds(serviceDay);

    // Previous service day for overnight trips that started even earlier
    const prevServiceDay = new Date(serviceDay);
    prevServiceDay.setDate(prevServiceDay.getDate() - 1);
    const yesterdayServiceIds = this.getActiveServiceIds(prevServiceDay);

    // Minutes from midnight of the service day
    const nowMinutes = getServiceDayMinutes(now);

    const result: DepartureGroup[] = [];
    let anyTruncated = false;

    for (const group of timetableGroups) {
      const route = this.routeMap.get(group.r);
      if (!route) {
        continue;
      }

      const departureTimes: Date[] = [];
      let totalAvailable = 0;

      // Today's services: all times from nowMinutes onward (including >= 1440
      // for overnight departures that run past midnight tonight).
      // minutesToDate uses serviceDay as base, so times >= 1440 correctly
      // produce next-day Date values.
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!todayServiceIds.has(serviceId)) {
          continue;
        }

        const startIdx = binarySearchFirstGte(times, nowMinutes);
        for (let i = startIdx; i < times.length; i++) {
          totalAvailable++;
          if (limit === undefined || departureTimes.length < limit) {
            departureTimes.push(minutesToDate(serviceDay, times[i]));
          }
        }
      }

      // Previous service day's overnight times (>= 1440) that extend into
      // the current service day's early hours. Only relevant when nowMinutes
      // >= 1440 (i.e. real time is before SERVICE_DAY_BOUNDARY_HOUR).
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!yesterdayServiceIds.has(serviceId)) {
          continue;
        }

        const overnightTarget = nowMinutes + 1440;
        const startIdx = binarySearchFirstGte(times, overnightTarget);
        for (let i = startIdx; i < times.length; i++) {
          totalAvailable++;
          if (limit === undefined || departureTimes.length < limit) {
            departureTimes.push(minutesToDate(prevServiceDay, times[i]));
          }
        }
      }

      if (limit !== undefined && totalAvailable > limit) {
        anyTruncated = true;
      }

      if (departureTimes.length > 0) {
        departureTimes.sort((a, b) => a.getTime() - b.getTime());
        result.push({ route, headsign: group.h, departures: departureTimes });
      }
    }

    result.sort((a, b) => a.departures[0].getTime() - b.departures[0].getTime());

    return Promise.resolve({ success: true, data: result, truncated: anyTruncated });
  }

  /** {@inheritDoc TransitRepository.getFullDayDepartures} */
  getFullDayDepartures(
    stopId: string,
    routeId: string,
    headsign: string,
    dateTime: Date,
  ): Promise<CollectionResult<number>> {
    const groups = this.timetable[stopId];
    if (!groups) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const serviceDate = getServiceDay(dateTime);
    const activeServiceIds = this.getActiveServiceIds(serviceDate);
    const allMinutes: number[] = [];

    for (const group of groups) {
      if (group.r !== routeId || group.h !== headsign) {
        continue;
      }

      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!activeServiceIds.has(serviceId)) {
          continue;
        }
        for (const t of times) {
          allMinutes.push(t);
        }
      }
    }

    allMinutes.sort((a, b) => a - b);
    return Promise.resolve({ success: true, data: allMinutes, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getFullDayDeparturesForStop} */
  getFullDayDeparturesForStop(
    stopId: string,
    dateTime: Date,
  ): Promise<CollectionResult<FullDayStopDeparture>> {
    const groups = this.timetable[stopId];
    if (!groups) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const serviceDate = getServiceDay(dateTime);
    const activeServiceIds = this.getActiveServiceIds(serviceDate);
    const departures: FullDayStopDeparture[] = [];

    for (const group of groups) {
      const route = this.routeMap.get(group.r);
      if (!route) {
        continue;
      }

      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!activeServiceIds.has(serviceId)) {
          continue;
        }
        for (const t of times) {
          departures.push({ minutes: t, route, headsign: group.h });
        }
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return Promise.resolve({ success: true, data: departures, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<RouteType[]>> {
    const routeTypes = this.stopRouteTypeMap.get(stopId);
    if (routeTypes === undefined) {
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    return Promise.resolve({ success: true, data: routeTypes });
  }

  /** {@inheritDoc TransitRepository.getAllStops} */
  getAllStops(): Promise<CollectionResult<Stop>> {
    const truncated = this.stops.length > MAX_STOPS_RESULT;
    const data = truncated ? this.stops.slice(0, MAX_STOPS_RESULT) : this.stops;
    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getRouteShapes} */
  getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    const shapes: RouteShape[] = [];
    for (const [routeId, polylines] of Object.entries(this.shapesRaw)) {
      const route = this.routeMap.get(routeId);
      const color = route?.route_color ? `#${route.route_color}` : '#888888';
      const routeType = route?.route_type ?? 3;
      for (const points of polylines) {
        shapes.push({ routeId, routeType, color, route: route ?? null, points });
      }
    }
    return Promise.resolve({ success: true, data: shapes, truncated: false });
  }

  private getActiveServiceIds(serviceDate: Date): Set<string> {
    const key = formatDateKey(serviceDate);

    // Return cached result if same service date
    if (this.activeServiceCache?.key === key) {
      return this.activeServiceCache.ids;
    }

    const dayIndex = getDayIndex(serviceDate);
    const active = new Set<string>();

    // Check calendar: date range + day-of-week
    for (const svc of this.calendarServices) {
      if (key >= svc.s && key <= svc.e && svc.d[dayIndex] === 1) {
        active.add(svc.i);
      }
    }

    // Apply calendar_dates exceptions
    for (const [serviceId, exceptions] of this.calendarExceptions) {
      for (const ex of exceptions) {
        if (ex.d !== key) {
          continue;
        }
        if (ex.t === 1) {
          active.add(serviceId); // Added
        } else if (ex.t === 2) {
          active.delete(serviceId); // Removed
        }
      }
    }

    this.activeServiceCache = { key, ids: active };
    return active;
  }
}

/**
 * Convert minutes-from-midnight to a Date on the same day as `baseDate`.
 * Negative minutes or minutes >= 1440 adjust the day accordingly.
 */
function minutesToDate(baseDate: Date, minutes: number): Date {
  const result = new Date(baseDate);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}
