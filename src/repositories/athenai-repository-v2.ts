/**
 * @module AthenaiRepositoryV2
 *
 * v2 native implementation of {@link TransitRepository}.
 *
 * Consumes v2 DataBundle directly, using TripPattern FK for
 * route/headsign resolution instead of v1's inline fields.
 *
 * Key differences from v1 AthenaiRepository:
 * - TripPattern-based timetable: route+headsign resolved via tp FK
 * - DepartureGroup re-aggregation: multiple patterns with same
 *   route+headsign are merged at query time
 * - Shapes lazy-loaded in background after create()
 * - Stop.agency_id is empty string (v2 GTFS spec compliance)
 * - location_type=1 (station) stops are included
 * - create() returns CreateResult with loadResult for error tracking
 */

import type {
  CalendarExceptionJson,
  CalendarServiceJson,
  TranslationsJson,
} from '../types/data/transit-json';
import type {
  LookupV2Json,
  TimetableGroupV2Json,
  TripPatternJson,
} from '../types/data/transit-v2-json';
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
import type { TransitRepository } from './transit-repository';
import type { TransitDataSourceV2 } from '../datasources/transit-data-source-v2';
import type { SourceDataV2 } from '../datasources/transit-data-source-v2';
import { FetchDataSourceV2 } from '../datasources/fetch-data-source-v2';
import { createLogger } from '../utils/logger';
import { getServiceDay, getServiceDayMinutes } from '../domain/transit/service-day';
import {
  binarySearchFirstGte,
  computeActiveServiceIds,
  extractPrefix,
  formatDateKey,
  minutesToDate,
} from '../domain/transit/calendar-utils';

const logger = createLogger('AthenaiRepositoryV2');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of loading sources, including error information. */
export interface LoadResult {
  /** Prefixes that loaded successfully. */
  loaded: string[];
  /** Prefixes that failed to load, with their errors. */
  failed: { prefix: string; error: Error }[];
}

/** Result of AthenaiRepositoryV2.create(). */
export interface CreateResult {
  /** The repository instance (usable even if some sources failed). */
  repository: TransitRepository;
  /** Details about which sources succeeded/failed. */
  loadResult: LoadResult;
}

/** Resolved trip pattern for efficient timetable queries. */
interface ResolvedPattern {
  route: Route;
  headsign: string;
  agencyId: string;
  sourcePrefix: string;
}

/** Per-source headsign translations, keyed by source prefix. */
type HeadsignTranslationsByPrefix = Map<
  string,
  {
    headsigns: Record<string, Record<string, string>>;
    stop_headsigns: Record<string, Record<string, string>>;
  }
>;

/** Merged data from multiple v2 sources. */
export interface MergedDataV2 {
  stops: Stop[];
  routeMap: Map<string, Route>;
  agencyMap: Map<string, Agency>;
  tripPatterns: Map<string, TripPatternJson>;
  resolvedPatterns: Map<string, ResolvedPattern>;
  timetable: Record<string, TimetableGroupV2Json[]>;
  calendarServices: CalendarServiceJson[];
  calendarExceptions: Map<string, CalendarExceptionJson[]>;
  stopRouteTypeMap: Map<string, RouteType[]>;
  stopAgenciesMap: Map<string, Agency[]>;
  stopRoutesMap: Map<string, Route[]>;
  translationsMap: TranslationsJson;
  headsignTranslations: HeadsignTranslationsByPrefix;
  lookup: LookupV2Json;
  sourceMetas: SourceMeta[];
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/** Fetch all v2 data bundles in parallel, tracking successes and failures. */
async function fetchSourcesV2(
  prefixes: string[],
  dataSource: TransitDataSourceV2,
): Promise<{ sources: SourceDataV2[]; loadResult: LoadResult }> {
  const results = await Promise.allSettled(prefixes.map((prefix) => dataSource.loadData(prefix)));

  const sources: SourceDataV2[] = [];
  const loaded: string[] = [];
  const failed: { prefix: string; error: Error }[] = [];

  for (let i = 0; i < prefixes.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      sources.push(r.value);
      loaded.push(prefixes[i]);
    } else {
      const error = r.reason instanceof Error ? r.reason : new Error(String(r.reason));
      failed.push({ prefix: prefixes[i], error });
      logger.warn(`Skipping source "${prefixes[i]}"`, error);
    }
  }

  return { sources, loadResult: { loaded, failed } };
}

/** Merge multiple v2 SourceDataV2 into a single unified dataset. */
export function mergeSourcesV2(sources: SourceDataV2[]): MergedDataV2 {
  // --- Translations ---
  // headsigns/stop_headsigns are kept per-source to preserve agency-specific
  // translations. Other maps use prefixed IDs and don't collide.
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
    const t = source.data.translations.data;
    headsignTranslations.set(source.prefix, {
      headsigns: t.headsigns,
      stop_headsigns: t.stop_headsigns,
    });
    if (t.stop_names) {
      Object.assign(translationsMap.stop_names, t.stop_names);
    }
    if (t.route_names) {
      Object.assign(translationsMap.route_names, t.route_names);
    }
    if (t.agency_names) {
      Object.assign(translationsMap.agency_names, t.agency_names);
    }
    if (t.agency_short_names) {
      Object.assign(translationsMap.agency_short_names, t.agency_short_names);
    }
  }

  // --- Agencies (v1 same type) ---
  const agencyMap = new Map<string, Agency>();
  for (const source of sources) {
    for (const a of source.data.agency.data) {
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

  // --- Stops (v2: no agency_id, includes all location_types) ---
  const stops: Stop[] = sources
    .flatMap((s) => s.data.stops.data)
    .map((s) => ({
      stop_id: s.i,
      stop_name: s.n,
      stop_names: translationsMap.stop_names[s.i] ?? {},
      stop_lat: s.a,
      stop_lon: s.o,
      location_type: s.l,
      // v2: GTFS spec has no agency_id on stops. Agency is resolved
      // via timetable -> tripPattern -> route -> agency_id.
      agency_id: '',
    }));

  // --- Routes ---
  const routeMap = new Map<string, Route>();
  for (const source of sources) {
    for (const r of source.data.routes.data) {
      routeMap.set(r.i, {
        route_id: r.i,
        route_short_name: r.s,
        route_long_name: r.l,
        route_names: translationsMap.route_names[r.i] ?? {},
        route_type: r.t as RouteType,
        route_color: r.c,
        route_text_color: r.tc,
        agency_id: r.ai,
      });
    }
  }

  // --- Calendar (v1 same type) ---
  const calendarServices = sources.flatMap((s) => s.data.calendar.data.services);
  const calendarExceptions = new Map<string, CalendarExceptionJson[]>();
  for (const source of sources) {
    for (const ex of source.data.calendar.data.exceptions) {
      let list = calendarExceptions.get(ex.i);
      if (!list) {
        list = [];
        calendarExceptions.set(ex.i, list);
      }
      list.push(ex);
    }
  }

  // --- TripPatterns ---
  const tripPatterns = new Map<string, TripPatternJson>();
  for (const source of sources) {
    for (const [id, pattern] of Object.entries(source.data.tripPatterns.data)) {
      tripPatterns.set(id, pattern);
    }
  }

  // --- Resolved patterns (pre-computed for O(1) lookup) ---
  const resolvedPatterns = new Map<string, ResolvedPattern>();
  for (const [id, pattern] of tripPatterns) {
    const route = routeMap.get(pattern.r);
    if (route) {
      resolvedPatterns.set(id, {
        route,
        headsign: pattern.h,
        agencyId: route.agency_id,
        sourcePrefix: extractPrefix(route.agency_id),
      });
    }
  }

  // --- Timetable ---
  const timetable: Record<string, TimetableGroupV2Json[]> = {};
  for (const source of sources) {
    for (const [stopId, groups] of Object.entries(source.data.timetable.data)) {
      if (timetable[stopId]) {
        timetable[stopId].push(...groups);
      } else {
        timetable[stopId] = [...groups];
      }
    }
  }

  // --- Derived maps (via tripPattern FK) ---
  const stopRouteTypeMap = new Map<string, RouteType[]>();
  const stopAgenciesMap = new Map<string, Agency[]>();
  const stopRoutesMap = new Map<string, Route[]>();

  for (const [stopId, groups] of Object.entries(timetable)) {
    const types = new Set<RouteType>();
    const agencyIds = new Set<string>();
    const uniqueRoutes = new Map<string, Route>();

    for (const group of groups) {
      const resolved = resolvedPatterns.get(group.tp);
      if (resolved) {
        types.add(resolved.route.route_type);
        uniqueRoutes.set(resolved.route.route_id, resolved.route);
        if (resolved.agencyId) {
          agencyIds.add(resolved.agencyId);
        }
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

  // --- Lookup (merged, Phase A: stored but not exposed via API) ---
  const lookup: LookupV2Json = {};
  for (const source of sources) {
    const l = source.data.lookup.data;
    if (l.stopUrls) {
      if (!lookup.stopUrls) {
        lookup.stopUrls = {};
      }
      Object.assign(lookup.stopUrls, l.stopUrls);
    }
    if (l.routeUrls) {
      if (!lookup.routeUrls) {
        lookup.routeUrls = {};
      }
      Object.assign(lookup.routeUrls, l.routeUrls);
    }
    if (l.stopDescs) {
      if (!lookup.stopDescs) {
        lookup.stopDescs = {};
      }
      Object.assign(lookup.stopDescs, l.stopDescs);
    }
  }

  // --- SourceMeta ---
  const sourceMetas: SourceMeta[] = [];
  for (const source of sources) {
    const fi = source.data.feedInfo.data;
    const firstAgencyId = source.data.agency.data[0]?.i;
    const agency = firstAgencyId ? agencyMap.get(firstAgencyId) : undefined;
    const sourceRouteTypes = [
      ...new Set(source.data.routes.data.map((r) => r.t as RouteType)),
    ].sort((a, b) => a - b);

    sourceMetas.push({
      id: source.prefix,
      name: agency?.agency_short_name || source.prefix,
      version: fi.v,
      validity: { startDate: fi.s, endDate: fi.e },
      routeTypes: sourceRouteTypes,
      keywords: [],
      stats: {
        stopCount: source.data.stops.data.length,
        routeCount: source.data.routes.data.length,
      },
    });
  }

  return {
    stops,
    routeMap,
    agencyMap,
    tripPatterns,
    resolvedPatterns,
    timetable,
    calendarServices,
    calendarExceptions,
    stopRouteTypeMap,
    stopAgenciesMap,
    stopRoutesMap,
    translationsMap,
    headsignTranslations,
    lookup,
    sourceMetas,
  };
}

// ---------------------------------------------------------------------------
// AthenaiRepositoryV2
// ---------------------------------------------------------------------------

/**
 * v2 native implementation of {@link TransitRepository}.
 *
 * Loads v2 DataBundle files and provides in-memory querying.
 * Shapes are lazy-loaded in the background after create().
 *
 * Use {@link AthenaiRepositoryV2.create} to instantiate.
 */
export class AthenaiRepositoryV2 implements TransitRepository {
  private activeServiceCache: { key: string; ids: Set<string> } | null = null;
  private stops: Stop[];
  // Retained for Phase B (future response type extensions).
  // Currently used only in static loadAllShapes via create().
  private readonly routeMap: Map<string, Route>;
  private agencyMap: Map<string, Agency>;
  private resolvedPatterns: Map<string, ResolvedPattern>;
  private stopRouteTypeMap: Map<string, RouteType[]>;
  private stopAgenciesMap: Map<string, Agency[]>;
  private stopRoutesMap: Map<string, Route[]>;
  private calendarServices: CalendarServiceJson[];
  private calendarExceptions: Map<string, CalendarExceptionJson[]>;
  private timetable: Record<string, TimetableGroupV2Json[]>;
  private headsignTranslations: HeadsignTranslationsByPrefix;
  private sourceMetas: SourceMeta[];

  // Shapes: background-loaded after create()
  private shapesPromise: Promise<RouteShape[]>;
  private shapesCache: RouteShape[] | null = null;

  private constructor(merged: MergedDataV2, shapesPromise: Promise<RouteShape[]>) {
    this.stops = merged.stops;
    this.routeMap = merged.routeMap;
    this.agencyMap = merged.agencyMap;
    this.resolvedPatterns = merged.resolvedPatterns;
    this.stopRouteTypeMap = merged.stopRouteTypeMap;
    this.stopAgenciesMap = merged.stopAgenciesMap;
    this.stopRoutesMap = merged.stopRoutesMap;
    this.calendarServices = merged.calendarServices;
    this.calendarExceptions = merged.calendarExceptions;
    this.timetable = merged.timetable;
    this.headsignTranslations = merged.headsignTranslations;
    this.sourceMetas = merged.sourceMetas;
    this.shapesPromise = shapesPromise;
  }

  /**
   * Create an AthenaiRepositoryV2 by loading and merging v2 data bundles.
   *
   * Returns both the repository and load result information. The
   * repository is usable even if some sources failed to load.
   * Shapes are loaded in the background immediately after creation.
   *
   * @param prefixes - Source identifiers to load.
   * @param dataSource - Data source to load from. Defaults to {@link FetchDataSourceV2}.
   * @returns Repository and load result with success/failure details.
   */
  static async create(
    prefixes: string[],
    dataSource: TransitDataSourceV2 = new FetchDataSourceV2(),
  ): Promise<CreateResult> {
    const t0 = performance.now();
    logger.info(`Loading sources: [${prefixes.join(', ')}]`);

    const { sources, loadResult } = await fetchSourcesV2(prefixes, dataSource);
    const tFetch = performance.now();

    for (const source of sources) {
      logger.info(
        `[${source.prefix}] stops=${source.data.stops.data.length} routes=${source.data.routes.data.length} tripPatterns=${Object.keys(source.data.tripPatterns.data).length}`,
      );
    }

    const merged = mergeSourcesV2(sources);
    const tEnd = performance.now();

    const fetchMs = Math.round(tFetch - t0);
    const mergeMs = Math.round(tEnd - tFetch);
    logger.info(
      `Initialized in ${Math.round(tEnd - t0)}ms (fetch=${fetchMs}ms, merge=${mergeMs}ms): stops=${merged.stops.length} routes=${merged.routeMap.size} timetable_stops=${Object.keys(merged.timetable).length}`,
    );

    for (const meta of merged.sourceMetas) {
      logger.info(
        `[${meta.id}] ${meta.name}: validity=${meta.validity.startDate}-${meta.validity.endDate} stops=${meta.stats.stopCount} routes=${meta.stats.routeCount} types=[${meta.routeTypes.join(',')}]`,
      );
    }

    // Start background shapes loading
    const shapesPromise = AthenaiRepositoryV2.loadAllShapes(
      loadResult.loaded,
      merged.routeMap,
      dataSource,
    );

    const repository = new AthenaiRepositoryV2(merged, shapesPromise);
    return { repository, loadResult };
  }

  // ---------------------------------------------------------------------------
  // Shapes background loading
  // ---------------------------------------------------------------------------

  private static async loadAllShapes(
    prefixes: string[],
    routeMap: Map<string, Route>,
    dataSource: TransitDataSourceV2,
  ): Promise<RouteShape[]> {
    const t0 = performance.now();
    const results = await Promise.allSettled(
      prefixes.map((prefix) => dataSource.loadShapes(prefix)),
    );

    const shapes: RouteShape[] = [];
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value) {
        continue;
      }
      for (const [routeId, polylines] of Object.entries(r.value.shapes.data)) {
        const route = routeMap.get(routeId);
        const color = route?.route_color ? `#${route.route_color}` : '#888888';
        const routeType = route?.route_type ?? 3;
        for (const points of polylines) {
          // ShapePointV2 is [lat, lon, dist?] — strip optional dist
          const coords: [number, number][] = points.map((p) => [p[0], p[1]]);
          shapes.push({ routeId, routeType, color, route: route ?? null, points: coords });
        }
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    logger.info(`Shapes loaded: ${shapes.length} shapes in ${elapsed}ms`);
    return shapes;
  }

  // ---------------------------------------------------------------------------
  // TransitRepository implementation
  // ---------------------------------------------------------------------------

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

    const serviceDay = getServiceDay(now);
    const todayServiceIds = this.getActiveServiceIds(serviceDay);

    const prevServiceDay = new Date(serviceDay);
    prevServiceDay.setDate(prevServiceDay.getDate() - 1);
    const yesterdayServiceIds = this.getActiveServiceIds(prevServiceDay);

    const nowMinutes = getServiceDayMinutes(now);

    // Re-aggregate across trip patterns: group by route_id + headsign
    const aggregated = new Map<
      string,
      {
        route: Route;
        headsign: string;
        prefix: string;
        departureTimes: Date[];
        totalAvailable: number;
      }
    >();

    for (const group of timetableGroups) {
      const resolved = this.resolvedPatterns.get(group.tp);
      if (!resolved) {
        continue;
      }

      const aggKey = `${resolved.route.route_id}\0${resolved.headsign}`;
      let agg = aggregated.get(aggKey);
      if (!agg) {
        agg = {
          route: resolved.route,
          headsign: resolved.headsign,
          prefix: resolved.sourcePrefix,
          departureTimes: [],
          totalAvailable: 0,
        };
        aggregated.set(aggKey, agg);
      }

      // Today's services
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!todayServiceIds.has(serviceId)) {
          continue;
        }
        const startIdx = binarySearchFirstGte(times, nowMinutes);
        for (let i = startIdx; i < times.length; i++) {
          agg.totalAvailable++;
          if (limit === undefined || agg.departureTimes.length < limit) {
            agg.departureTimes.push(minutesToDate(serviceDay, times[i]));
          }
        }
      }

      // Previous service day's overnight times
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!yesterdayServiceIds.has(serviceId)) {
          continue;
        }
        const overnightTarget = nowMinutes + 1440;
        const startIdx = binarySearchFirstGte(times, overnightTarget);
        for (let i = startIdx; i < times.length; i++) {
          agg.totalAvailable++;
          if (limit === undefined || agg.departureTimes.length < limit) {
            agg.departureTimes.push(minutesToDate(prevServiceDay, times[i]));
          }
        }
      }
    }

    // Build result
    const result: DepartureGroup[] = [];
    let anyTruncated = false;

    for (const agg of aggregated.values()) {
      if (agg.departureTimes.length === 0) {
        continue;
      }
      if (limit !== undefined && agg.totalAvailable > limit) {
        anyTruncated = true;
      }

      agg.departureTimes.sort((a, b) => a.getTime() - b.getTime());
      const sourceTranslations = this.headsignTranslations.get(agg.prefix);
      const headsignNames = sourceTranslations?.headsigns[agg.headsign] ?? {};

      result.push({
        route: agg.route,
        headsign: agg.headsign,
        headsign_names: headsignNames,
        departures: agg.departureTimes,
      });
    }

    result.sort((a, b) => a.departures[0].getTime() - b.departures[0].getTime());

    logger.debug(
      `getUpcomingDepartures: ${stopId} → ${result.length} groups (${anyTruncated ? 'truncated' : 'all'})`,
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
      const resolved = this.resolvedPatterns.get(group.tp);
      if (!resolved || resolved.route.route_id !== routeId || resolved.headsign !== headsign) {
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
      const resolved = this.resolvedPatterns.get(group.tp);
      if (!resolved) {
        continue;
      }

      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!activeServiceIds.has(serviceId)) {
          continue;
        }
        const sourceTranslations = this.headsignTranslations.get(resolved.sourcePrefix);
        const headsignNames = sourceTranslations?.headsigns[resolved.headsign] ?? {};
        for (const t of times) {
          departures.push({
            minutes: t,
            route: resolved.route,
            headsign: resolved.headsign,
            headsign_names: headsignNames,
          });
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
  async getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    if (this.shapesCache) {
      logger.debug(`getRouteShapes: ${this.shapesCache.length} shapes (cached)`);
      return { success: true, data: this.shapesCache, truncated: false };
    }
    this.shapesCache = await this.shapesPromise;
    logger.debug(`getRouteShapes: ${this.shapesCache.length} shapes`);
    return { success: true, data: this.shapesCache, truncated: false };
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

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getActiveServiceIds(serviceDate: Date): Set<string> {
    const key = formatDateKey(serviceDate);

    if (this.activeServiceCache?.key === key) {
      return this.activeServiceCache.ids;
    }

    const ids = computeActiveServiceIds(
      serviceDate,
      this.calendarServices,
      this.calendarExceptions,
    );

    this.activeServiceCache = { key, ids };
    return ids;
  }
}
