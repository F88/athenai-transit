import type {
  CalendarExceptionJson,
  CalendarServiceJson,
  ShapesJson,
  TimetableJson,
  TranslationsJson,
} from '../types/data/transit-json';
import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type { Agency, Route, RouteType, Stop } from '../types/app/transit';
import type {
  DepartureGroup,
  FullDayStopDeparture,
  SourceMeta,
  StopWithMeta,
} from '../types/app/transit-composed';
import type { CollectionResult, Result } from '../types/app/repository';
import { MAX_STOPS_RESULT } from './transit-repository';
import type { TransitDataSource } from '../datasources/transit-data-source';
import type { SourceData } from '../datasources/transit-data-source';
import { FetchDataSource } from '../datasources/fetch-data-source';
import { createLogger } from '../utils/logger';
import { getServiceDay, getServiceDayMinutes } from '../domain/transit/service-day';
import type { TransitRepository } from './transit-repository';

const logger = createLogger('AthenaiRepository');

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

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

/** Extract the source prefix from a prefixed ID (e.g. "kobus:123" → "kobus"). */
function extractPrefix(prefixedId: string): string {
  const colonIdx = prefixedId.indexOf(':');
  return colonIdx >= 0 ? prefixedId.substring(0, colonIdx) : prefixedId;
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
 * Convert minutes-from-midnight to a Date on the same day as `baseDate`.
 * Negative minutes or minutes >= 1440 adjust the day accordingly.
 */
function minutesToDate(baseDate: Date, minutes: number): Date {
  const result = new Date(baseDate);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Fetch and merge (used by create)
// ---------------------------------------------------------------------------

/** Fetch all sources in parallel, skipping failures. */
async function fetchSources(
  prefixes: string[],
  dataSource: TransitDataSource,
): Promise<SourceData[]> {
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
  return perSource.filter((s): s is NonNullable<typeof s> => s !== null);
}

/** Per-source headsign translations, keyed by source prefix. */
type HeadsignTranslationsByPrefix = Map<
  string,
  {
    headsigns: Record<string, Record<string, string>>;
    stop_headsigns: Record<string, Record<string, string>>;
  }
>;

/** Merged data ready to construct an AthenaiRepository. */
export interface MergedData {
  stops: Stop[];
  routeMap: Map<string, Route>;
  agencyMap: Map<string, Agency>;
  stopRouteTypeMap: Map<string, RouteType[]>;
  stopAgenciesMap: Map<string, Agency[]>;
  stopRoutesMap: Map<string, Route[]>;
  calendarServices: CalendarServiceJson[];
  calendarExceptions: Map<string, CalendarExceptionJson[]>;
  timetable: TimetableJson;
  shapes: ShapesJson;
  /** Global translations for prefixed-ID-keyed maps (no collision risk). */
  translationsMap: TranslationsJson;
  /** Per-source headsign translations to avoid cross-source overwrites. */
  headsignTranslations: HeadsignTranslationsByPrefix;
  /** Per-source metadata (validity period, version). */
  sourceMetas: SourceMeta[];
}

/** Merge multiple SourceData into a single unified dataset. */
export function mergeSources(sources: SourceData[]): MergedData {
  // Merge translations (needed for resolving names).
  // headsigns/stop_headsigns are kept per-source to preserve agency-specific
  // translations (e.g. "練馬駅" → "Nerima Sta." for kobus vs "Nerima Station"
  // for ktbus). Other translation maps use prefixed IDs as keys and don't
  // collide across sources, so they are merged globally.
  const translationsMap: TranslationsJson = {
    headsigns: {},
    stop_headsigns: {},
    stop_names: {},
    route_names: {},
    agency_names: {},
    agency_short_names: {},
  };
  const headsignTranslations: HeadsignTranslationsByPrefix = new Map();
  for (const source of sources) {
    if (source.translations) {
      // Per-source headsign translations (agency-scoped)
      headsignTranslations.set(source.prefix, {
        headsigns: source.translations.headsigns,
        stop_headsigns: source.translations.stop_headsigns,
      });
      // Global translations (prefixed-ID keys, no collision)
      if (source.translations.stop_names) {
        Object.assign(translationsMap.stop_names, source.translations.stop_names);
      }
      if (source.translations.route_names) {
        Object.assign(translationsMap.route_names, source.translations.route_names);
      }
      if (source.translations.agency_names) {
        Object.assign(translationsMap.agency_names, source.translations.agency_names);
      }
      if (source.translations.agency_short_names) {
        Object.assign(translationsMap.agency_short_names, source.translations.agency_short_names);
      }
    }
  }

  // Merge agencies
  const agencyMap = new Map<string, Agency>();
  for (const source of sources) {
    if (source.agencies) {
      for (const a of source.agencies) {
        agencyMap.set(a.i, {
          agency_id: a.i,
          agency_name: a.n,
          agency_short_name: a.sn ?? '',
          agency_names: translationsMap.agency_names[a.i] ?? {},
          agency_short_names: translationsMap.agency_short_names[a.i] ?? {},
          agency_url: a.u,
          agency_lang: a.l,
          agency_timezone: a.tz ?? '',
          agency_fare_url: a.fu ?? '',
          agency_colors: (a.cs ?? []).map((c) => ({ bg: c.b, text: c.t })),
        });
      }
    }
  }

  // Merge stops (resolve stop_names from translations)
  const stops: Stop[] = sources
    .flatMap((s) => s.stops)
    .map((s) => ({
      stop_id: s.i,
      stop_name: s.n,
      stop_names: translationsMap.stop_names[s.i] ?? {},
      stop_lat: s.a,
      stop_lon: s.o,
      location_type: s.l,
      agency_id: s.ai ?? '',
    }));

  // Merge routes (resolve route_names from translations)
  const routeMap = new Map<string, Route>();
  for (const source of sources) {
    for (const r of source.routes) {
      routeMap.set(r.i, {
        route_id: r.i,
        route_short_name: r.s,
        route_long_name: r.l,
        route_names: translationsMap.route_names[r.i] ?? {},
        route_type: r.t as RouteType,
        route_color: r.c,
        route_text_color: r.tc,
        agency_id: r.ai ?? '',
      });
    }
  }

  // Merge calendar
  const calendarServices = sources.flatMap((s) => s.calendar.services);
  const calendarExceptions = new Map<string, CalendarExceptionJson[]>();
  for (const source of sources) {
    for (const ex of source.calendar.exceptions) {
      let list = calendarExceptions.get(ex.i);
      if (!list) {
        list = [];
        calendarExceptions.set(ex.i, list);
      }
      list.push(ex);
    }
  }

  // Merge timetable
  const timetable: TimetableJson = {};
  for (const source of sources) {
    for (const [stopId, groups] of Object.entries(source.timetable)) {
      if (timetable[stopId]) {
        timetable[stopId].push(...groups);
      } else {
        timetable[stopId] = [...groups];
      }
    }
  }

  // Merge shapes
  const shapes: ShapesJson = {};
  for (const source of sources) {
    Object.assign(shapes, source.shapes);
  }

  // Build stop -> routeTypes map (all route_type values, deduplicated and sorted)
  const stopRouteTypeMap = new Map<string, RouteType[]>();
  // Build stop -> agencies map (all agencies serving each stop, deduplicated)
  const stopAgenciesMap = new Map<string, Agency[]>();
  // Build stop -> routes map (all routes serving each stop, deduplicated, shared references)
  const stopRoutesMap = new Map<string, Route[]>();
  for (const [stopId, groups] of Object.entries(timetable)) {
    const types = new Set<RouteType>();
    const agencyIds = new Set<string>();
    // Collect Route references directly to avoid a second routeMap lookup.
    const uniqueRoutes = new Map<string, Route>();
    for (const group of groups) {
      const route = routeMap.get(group.r);
      if (route) {
        types.add(route.route_type);
        uniqueRoutes.set(group.r, route);
      }
      if (group.ai) {
        agencyIds.add(group.ai);
      }
    }
    if (types.size > 0) {
      stopRouteTypeMap.set(
        stopId,
        [...types].sort((a, b) => a - b),
      );
    }
    if (agencyIds.size > 0) {
      const agencies: Agency[] = [];
      for (const id of agencyIds) {
        const agency = agencyMap.get(id);
        if (agency) {
          agencies.push(agency);
        }
      }
      stopAgenciesMap.set(stopId, agencies);
    }
    if (uniqueRoutes.size > 0) {
      stopRoutesMap.set(stopId, [...uniqueRoutes.values()]);
    }
  }

  // Build source metadata from feed-info (validity period, version)
  // and agency short name (human-readable source label)
  const sourceMetas: SourceMeta[] = [];
  for (const source of sources) {
    if (source.feedInfo) {
      const firstAgencyId = source.agencies?.[0]?.i;
      const agency = firstAgencyId ? agencyMap.get(`${source.prefix}:${firstAgencyId}`) : undefined;
      const sourceRouteTypes = [...new Set(source.routes.map((r) => r.t as RouteType))].sort(
        (a, b) => a - b,
      );
      sourceMetas.push({
        id: source.prefix,
        name: agency?.agency_short_name || source.prefix,
        version: source.feedInfo.v,
        validity: {
          startDate: source.feedInfo.s,
          endDate: source.feedInfo.e,
        },
        routeTypes: sourceRouteTypes,
        keywords: [],
        stats: {
          stopCount: source.stops.length,
          routeCount: source.routes.length,
        },
      });
    }
  }

  return {
    stops,
    routeMap,
    agencyMap,
    stopRouteTypeMap,
    stopAgenciesMap,
    stopRoutesMap,
    calendarServices,
    calendarExceptions,
    timetable,
    shapes,
    translationsMap,
    headsignTranslations,
    sourceMetas,
  };
}

// ---------------------------------------------------------------------------
// AthenaiRepository
// ---------------------------------------------------------------------------

/**
 * Production implementation of {@link TransitRepository}.
 *
 * Loads pre-built JSON files (stops, routes, calendar, timetable, shapes)
 * and provides in-memory querying for transit information.
 * Multiple data sources can be merged into a single instance via
 * {@link AthenaiRepository.create}.
 */
export class AthenaiRepository implements TransitRepository {
  private activeServiceCache: { key: string; ids: Set<string> } | null = null;
  private stops: Stop[];
  private routeMap: Map<string, Route>;
  private agencyMap: Map<string, Agency>;
  private stopRouteTypeMap: Map<string, RouteType[]>;
  private stopAgenciesMap: Map<string, Agency[]>;
  private stopRoutesMap: Map<string, Route[]>;
  private calendarServices: CalendarServiceJson[];
  private calendarExceptions: Map<string, CalendarExceptionJson[]>;
  private timetable: TimetableJson;
  private shapesRaw: ShapesJson;
  private headsignTranslations: HeadsignTranslationsByPrefix;
  private sourceMetas: SourceMeta[];

  private constructor(
    stops: Stop[],
    routeMap: Map<string, Route>,
    agencyMap: Map<string, Agency>,
    stopRouteTypeMap: Map<string, RouteType[]>,
    stopAgenciesMap: Map<string, Agency[]>,
    stopRoutesMap: Map<string, Route[]>,
    calendarServices: CalendarServiceJson[],
    calendarExceptions: Map<string, CalendarExceptionJson[]>,
    timetable: TimetableJson,
    shapesRaw: ShapesJson,
    headsignTranslations: HeadsignTranslationsByPrefix,
    sourceMetas: SourceMeta[],
  ) {
    this.stops = stops;
    this.routeMap = routeMap;
    this.agencyMap = agencyMap;
    this.stopRouteTypeMap = stopRouteTypeMap;
    this.stopAgenciesMap = stopAgenciesMap;
    this.stopRoutesMap = stopRoutesMap;
    this.calendarServices = calendarServices;
    this.calendarExceptions = calendarExceptions;
    this.timetable = timetable;
    this.shapesRaw = shapesRaw;
    this.headsignTranslations = headsignTranslations;
    this.sourceMetas = sourceMetas;
  }

  /**
   * Create an AthenaiRepository by loading and merging multiple data sources.
   *
   * Each prefix corresponds to a set of JSON files under `/data/{prefix}/`.
   * Sources that fail to load are skipped with a warning.
   *
   * @param prefixes - Array of source prefixes (e.g. `["tobus", "toaran"]`).
   * @param dataSource - Data source to load files from.
   *                     Defaults to {@link FetchDataSource}.
   * @returns A fully initialized repository with merged data from all sources.
   */
  static async create(
    prefixes: string[],
    dataSource: TransitDataSource = new FetchDataSource(),
  ): Promise<AthenaiRepository> {
    const t0 = performance.now();
    logger.debug(`Loading sources: [${prefixes.join(', ')}]`);

    const loaded = await fetchSources(prefixes, dataSource);
    const tFetch = performance.now();

    for (const source of loaded) {
      logger.info(
        `[${source.prefix}] stops=${source.stops.length} routes=${source.routes.length} shapes=${Object.keys(source.shapes).length}`,
      );
    }

    const merged = mergeSources(loaded);

    const tEnd = performance.now();
    const fetchMs = Math.round(tFetch - t0);
    const mergeMs = Math.round(tEnd - tFetch);
    logger.info(
      `Initialized in ${Math.round(tEnd - t0)}ms (fetch=${fetchMs}ms, merge=${mergeMs}ms): stops=${merged.stops.length} routes=${merged.routeMap.size} shapes=${Object.keys(merged.shapes).length} timetable_stops=${Object.keys(merged.timetable).length}`,
    );

    for (const meta of merged.sourceMetas) {
      logger.info(
        `[${meta.id}] ${meta.name}: validity=${meta.validity.startDate}-${meta.validity.endDate} stops=${meta.stats.stopCount} routes=${meta.stats.routeCount} types=[${meta.routeTypes.join(',')}]`,
      );
    }

    return new AthenaiRepository(
      merged.stops,
      merged.routeMap,
      merged.agencyMap,
      merged.stopRouteTypeMap,
      merged.stopAgenciesMap,
      merged.stopRoutesMap,
      merged.calendarServices,
      merged.calendarExceptions,
      merged.timetable,
      merged.shapes,
      merged.headsignTranslations,
      merged.sourceMetas,
    );
  }

  /** {@inheritDoc TransitRepository.getStopsInBounds} */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    const t0 = performance.now();
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
    const data = matching.slice(0, effectiveLimit).map((m) => ({
      stop: m.stop,
      agencies: this.stopAgenciesMap.get(m.stop.stop_id) ?? [],
      routes: this.stopRoutesMap.get(m.stop.stop_id) ?? [],
    }));

    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getStopsInBounds: ${data.length}/${matching.length} stops in ${elapsed}ms (${truncated ? 'truncated' : 'all'})`,
    );
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

    const t0 = performance.now();
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
    const data = sorted.slice(0, effectiveLimit).map(({ stop, distKm }) => ({
      stop,
      distance: distKm * 1000,
      agencies: this.stopAgenciesMap.get(stop.stop_id) ?? [],
      routes: this.stopRoutesMap.get(stop.stop_id) ?? [],
    }));

    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getStopsNearby: ${data.length}/${sorted.length} stops within ${radiusM}m in ${elapsed}ms (${truncated ? 'truncated' : 'all'})`,
    );
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
    let totalReturned = 0;
    let totalAvailableAll = 0;

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

      totalAvailableAll += totalAvailable;
      totalReturned += departureTimes.length;

      if (limit !== undefined && totalAvailable > limit) {
        anyTruncated = true;
      }

      if (departureTimes.length > 0) {
        departureTimes.sort((a, b) => a.getTime() - b.getTime());
        const prefix = extractPrefix(group.ai);
        const sourceTranslations = this.headsignTranslations.get(prefix);
        const headsignNames = sourceTranslations?.headsigns[group.h] ?? {};
        result.push({
          route,
          headsign: group.h,
          headsign_names: headsignNames,
          departures: departureTimes,
        });
      }
    }

    result.sort((a, b) => a.departures[0].getTime() - b.departures[0].getTime());

    logger.debug(
      `getUpcomingDepartures: ${stopId} → ${result.length} groups, ${totalReturned}/${totalAvailableAll} departures (${anyTruncated ? 'truncated' : 'all'})`,
    );
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
    logger.debug(`getFullDayDepartures: ${stopId}/${routeId} → ${allMinutes.length} departures`);
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
        const prefix = extractPrefix(group.ai);
        const sourceTranslations = this.headsignTranslations.get(prefix);
        const headsignNames = sourceTranslations?.headsigns[group.h] ?? {};
        for (const t of times) {
          departures.push({ minutes: t, route, headsign: group.h, headsign_names: headsignNames });
        }
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    logger.debug(`getFullDayDeparturesForStop: ${stopId} → ${departures.length} departures`);
    return Promise.resolve({ success: true, data: departures, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<RouteType[]>> {
    const routeTypes = this.stopRouteTypeMap.get(stopId);
    if (routeTypes === undefined) {
      logger.verbose(`getRouteTypesForStop: ${stopId} → not found`);
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    logger.verbose(`getRouteTypesForStop: ${stopId} → [${routeTypes.join(', ')}]`);
    return Promise.resolve({ success: true, data: routeTypes });
  }

  /** {@inheritDoc TransitRepository.getAllStops} */
  getAllStops(): Promise<CollectionResult<Stop>> {
    const t0 = performance.now();
    const truncated = this.stops.length > MAX_STOPS_RESULT;
    const data = truncated ? this.stops.slice(0, MAX_STOPS_RESULT) : this.stops;
    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getAllStops: ${data.length}/${this.stops.length} stops in ${elapsed}ms (${truncated ? 'truncated' : 'all'})`,
    );
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
    logger.debug(`getRouteShapes: ${shapes.length} shapes`);
    return Promise.resolve({ success: true, data: shapes, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getAgency} */
  getAgency(agencyId: string): Promise<Result<Agency>> {
    const agency = this.agencyMap.get(agencyId);
    if (!agency) {
      return Promise.resolve({ success: false, error: `Agency not found: ${agencyId}` });
    }
    return Promise.resolve({ success: true, data: agency });
  }

  /** {@inheritDoc TransitRepository.getAllSourceMeta} */
  getAllSourceMeta(): Promise<CollectionResult<SourceMeta>> {
    return Promise.resolve({ success: true, data: this.sourceMetas, truncated: false });
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
