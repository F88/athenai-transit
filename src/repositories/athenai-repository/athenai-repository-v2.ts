/**
 * @module AthenaiRepositoryV2
 *
 * v2 native implementation of {@link TransitRepository}.
 *
 * Consumes v2 DataBundle directly, using TripPattern FK for
 * route/headsign resolution instead of v1's inline fields.
 *
 * Key features:
 * - TripPattern-based timetable: route+headsign resolved via tp FK
 * - TimetableEntry / ContextualTimetableEntry: per-stop-time boarding info and pattern position
 * - Shapes lazy-loaded in background after create()
 * - Stop.agency_id is empty string (v2 GTFS spec compliance)
 * - location_type=1 (station) stops are filtered out until the UI
 *   supports station grouping (v2 pipeline outputs all location_types)
 * - create() returns CreateResult with loadResult for error tracking
 */

import type { CalendarExceptionJson, CalendarServiceJson } from '../../types/data/transit-json';
import type { TimetableGroupV2Json } from '../../types/data/transit-v2-json';
import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { Agency, AppRouteTypeValue, Route, Stop } from '../../types/app/transit';
import type {
  ContextualTimetableEntry,
  RouteDirection,
  SourceMeta,
  StopServiceType,
  StopWithMeta,
  TimetableEntry,
  TripPattern,
} from '../../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableQueryMeta,
  TimetableResult,
  UpcomingTimetableResult,
} from '../../types/app/repository';
import type { TransitDataSourceV2 } from '../../datasources/transit-data-source-v2';
import { getTimetableEntriesState } from '../../domain/transit/timetable-utils';
import {
  sortTimetableEntriesByDepartureTime,
  sortTimetableEntriesChronologically,
} from '../../domain/transit/sort-timetable-entries';
import { normalizeOptionalResultLimit, normalizeStopQueryLimit } from '../transit-repository';
import type { TransitRepository } from '../transit-repository';
import { FetchDataSourceV2 } from '../../datasources/fetch-data-source-v2';
import { createLogger } from '../../lib/logger';
import { getServiceDay, getServiceDayMinutes } from '../../domain/transit/service-day';
import { selectServiceGroup } from '../../domain/transit/select-service-group';
import {
  binarySearchFirstGte,
  computeActiveServiceIds,
  formatDateKey,
} from '../../domain/transit/calendar-utils';
import { mergeSourcesV2 } from './merge-sources-v2';
import { fetchSourcesV2 } from './fetch-sources-v2';
import { enrichStopInsights } from './enrich-stop-insights';
import type {
  HeadsignTranslationsByPrefix,
  LoadResult,
  MergedDataV2,
  PatternStatsEntry,
  ResolvedPattern,
  RouteFreqEntry,
  StopInsightsEntry,
} from './types';

const logger = createLogger('AthenaiRepositoryV2');

/** Result of AthenaiRepositoryV2.create(). */
export interface CreateResult {
  /** The repository instance (usable even if some sources failed). */
  repository: TransitRepository;
  /** Details about which sources succeeded/failed. */
  loadResult: LoadResult;
}

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
  private stopsMetaMap: Map<string, StopWithMeta>;
  private readonly routeMap: Map<string, Route>;
  private agencyMap: Map<string, Agency>;
  private resolvedPatterns: Map<string, ResolvedPattern>;
  private tripPatterns: Map<string, TripPattern>;
  private stopRouteTypeMap: Map<string, AppRouteTypeValue[]>;
  private calendarServices: CalendarServiceJson[];
  private calendarExceptions: Map<string, CalendarExceptionJson[]>;
  private timetable: Record<string, TimetableGroupV2Json[]>;
  private headsignTranslations: HeadsignTranslationsByPrefix;
  private sourceMetas: SourceMeta[];

  private routeStopsCache: Map<string, Set<string>> | null = null;

  private stopInsightsMap = new Map<string, StopInsightsEntry>();

  private routeFreqMap = new Map<string, RouteFreqEntry>();

  private patternStatsMap = new Map<string, PatternStatsEntry>();

  private shapesPromise: Promise<RouteShape[]> = Promise.resolve([]);
  private shapesCache: RouteShape[] | null = null;

  private constructor(merged: MergedDataV2) {
    this.stops = merged.stops;
    this.stopsMetaMap = merged.stopsMetaMap;
    this.routeMap = merged.routeMap;
    this.agencyMap = merged.agencyMap;
    this.resolvedPatterns = merged.resolvedPatterns;
    this.tripPatterns = merged.tripPatterns;
    this.stopRouteTypeMap = merged.stopRouteTypeMap;
    this.calendarServices = merged.calendarServices;
    this.calendarExceptions = merged.calendarExceptions;
    this.timetable = merged.timetable;
    this.headsignTranslations = merged.headsignTranslations;
    this.sourceMetas = merged.sourceMetas;
  }

  private startShapesLoad(prefixes: string[], dataSource: TransitDataSourceV2): void {
    this.shapesPromise = this.loadAllShapesWithInsights(prefixes, dataSource);
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
    const fetchMs = Math.round(tFetch - t0);
    logger.debug(`fetchSources: ${fetchMs}ms (${sources.length} sources)`);

    for (const source of sources) {
      logger.info(
        `[${source.prefix}] stops=${source.data.stops.data.length} routes=${source.data.routes.data.length} tripPatterns=${Object.keys(source.data.tripPatterns.data).length}`,
      );
    }

    const merged = mergeSourcesV2(sources);
    const tMerge = performance.now();
    const mergeMs = Math.round(tMerge - tFetch);
    logger.debug(
      `mergeSources: ${mergeMs}ms (stops=${merged.stops.length} routes=${merged.routeMap.size} stopsMetaMap=${merged.stopsMetaMap.size})`,
    );

    for (const meta of merged.sourceMetas) {
      logger.info(
        `[${meta.id}] ${meta.name}: validity=${meta.validity.startDate}-${meta.validity.endDate} stops=${meta.stats.stopCount} routes=${meta.stats.routeCount} types=[${meta.routeTypes.join(',')}]`,
      );
    }

    const repository = new AthenaiRepositoryV2(merged);

    const tEnrich = performance.now();
    await enrichStopInsights(
      merged.stopsMetaMap,
      loadResult.loaded,
      dataSource,
      repository.stopInsightsMap,
    );
    const enrichMs = Math.round(performance.now() - tEnrich);

    logger.info(
      `Initialized in ${Math.round(performance.now() - t0)}ms (fetch=${fetchMs}ms, merge=${mergeMs}ms, enrich=${enrichMs}ms): stops=${merged.stops.length} routes=${merged.routeMap.size} timetable_stops=${Object.keys(merged.timetable).length}`,
    );
    repository.startShapesLoad(loadResult.loaded, dataSource);
    return { repository, loadResult };
  }

  private async loadAllShapesWithInsights(
    prefixes: string[],
    dataSource: TransitDataSourceV2,
  ): Promise<RouteShape[]> {
    const t0 = performance.now();

    const [shapesResults, insightsResults] = await Promise.all([
      Promise.allSettled(prefixes.map((prefix) => dataSource.loadShapes(prefix))),
      Promise.allSettled(prefixes.map((prefix) => dataSource.loadInsights(prefix))),
    ]);

    const routeFreq = new Map<string, number>();
    const routeGeo = new Map<string, { pathDist: number; isCircular: boolean }>();

    for (const r of insightsResults) {
      if (r.status !== 'fulfilled' || !r.value) {
        continue;
      }
      const insights = r.value;

      if (insights.tripPatternGeo) {
        for (const [patternId, geo] of Object.entries(insights.tripPatternGeo.data)) {
          const resolved = this.resolvedPatterns.get(patternId);
          if (!resolved) {
            continue;
          }
          const routeId = resolved.route.route_id;
          if (!routeGeo.has(routeId)) {
            routeGeo.set(routeId, { pathDist: geo.pathDist, isCircular: geo.cl });
          }
        }
      }

      if (insights.tripPatternStats) {
        const serviceGroups = insights.serviceGroups.data;
        for (const [groupKey, groupStats] of Object.entries(insights.tripPatternStats.data)) {
          for (const [patternId, stats] of Object.entries(groupStats)) {
            const resolved = this.resolvedPatterns.get(patternId);
            if (!resolved) {
              continue;
            }
            const routeId = resolved.route.route_id;

            let entry = this.routeFreqMap.get(routeId);
            if (!entry) {
              entry = { groups: serviceGroups, freqs: {} };
              this.routeFreqMap.set(routeId, entry);
            }
            entry.freqs[groupKey] = (entry.freqs[groupKey] ?? 0) + stats.freq;

            let statsEntry = this.patternStatsMap.get(patternId);
            if (!statsEntry) {
              statsEntry = { groups: serviceGroups, rds: {}, freqs: {} };
              this.patternStatsMap.set(patternId, statsEntry);
            }
            statsEntry.rds[groupKey] = stats.rd;
            statsEntry.freqs[groupKey] = stats.freq;
          }
        }

        const firstGroupKey = serviceGroups[0]?.key;
        if (firstGroupKey) {
          const statsForGroup = insights.tripPatternStats.data[firstGroupKey];
          if (statsForGroup) {
            for (const [patternId, stats] of Object.entries(statsForGroup)) {
              const resolved = this.resolvedPatterns.get(patternId);
              if (!resolved) {
                continue;
              }
              const routeId = resolved.route.route_id;
              const current = routeFreq.get(routeId) ?? 0;
              routeFreq.set(routeId, current + stats.freq);
            }
          }
        }
      }
    }

    const shapes: RouteShape[] = [];
    for (const r of shapesResults) {
      if (r.status !== 'fulfilled' || !r.value) {
        continue;
      }
      for (const [routeId, polylines] of Object.entries(r.value.shapes.data)) {
        const route = this.routeMap.get(routeId);
        const color = route?.route_color ? `#${route.route_color}` : '#888888';
        const routeType = route?.route_type ?? 3;
        const geo = routeGeo.get(routeId);
        const freq = routeFreq.get(routeId);

        for (const points of polylines) {
          shapes.push({
            routeId,
            routeType,
            color,
            route: route ?? null,
            points,
            freq,
            pathDist: geo?.pathDist,
            isCircular: geo?.isCircular,
          });
        }
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    logger.info(
      `Shapes loaded: ${shapes.length} shapes in ${elapsed}ms (insights: ${routeGeo.size} geo, ${routeFreq.size} freq)`,
    );
    return shapes;
  }

  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    const t0 = performance.now();
    const effectiveLimit = normalizeStopQueryLimit(limit);
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    const matching: { meta: StopWithMeta; dist: number }[] = [];
    for (const meta of this.stopsMetaMap.values()) {
      const { stop } = meta;
      if (
        stop.stop_lat >= bounds.south &&
        stop.stop_lat <= bounds.north &&
        stop.stop_lon >= bounds.west &&
        stop.stop_lon <= bounds.east
      ) {
        const dlat = stop.stop_lat - centerLat;
        const dlng = stop.stop_lon - centerLng;
        const dist = dlat * dlat + dlng * dlng;
        matching.push({ meta, dist });
      }
    }

    matching.sort((a, b) => a.dist - b.dist);

    const truncated = matching.length > effectiveLimit;
    const data = matching.slice(0, effectiveLimit).map((m) => m.meta);

    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getStopsInBounds: ${data.length}/${matching.length} stops in ${elapsed}ms (${truncated ? 'truncated' : 'all'}) center=(${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})`,
    );
    return Promise.resolve({ success: true, data, truncated });
  }

  getStopsNearby(
    center: LatLng,
    radiusM: number,
    limit: number,
  ): Promise<CollectionResult<StopWithMeta>> {
    if (radiusM <= 0) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const t0 = performance.now();
    const effectiveLimit = normalizeStopQueryLimit(limit);
    const radiusKm = radiusM / 1000;
    const sorted: { meta: StopWithMeta; distKm: number }[] = [];
    for (const meta of this.stopsMetaMap.values()) {
      const { stop } = meta;
      const dlat = stop.stop_lat - center.lat;
      const dlng = stop.stop_lon - center.lng;
      const distKm = Math.sqrt((dlat * 111) ** 2 + (dlng * 91) ** 2);
      if (distKm <= radiusKm) {
        sorted.push({ meta, distKm });
      }
    }
    sorted.sort((a, b) => a.distKm - b.distKm);

    const truncated = sorted.length > effectiveLimit;
    const data = sorted.slice(0, effectiveLimit).map(({ meta, distKm }) => ({
      ...meta,
      distance: distKm * 1000,
    }));

    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getStopsNearby: ${data.length}/${sorted.length} stops within ${radiusM}m in ${elapsed}ms (${truncated ? 'truncated' : 'all'}) center=(${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
    );
    return Promise.resolve({ success: true, data, truncated });
  }

  getUpcomingTimetableEntries(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<UpcomingTimetableResult> {
    const t0 = performance.now();
    const normalizedLimit = normalizeOptionalResultLimit(limit);
    const timetableGroups = this.timetable[stopId];
    if (!timetableGroups) {
      return Promise.resolve({ success: false, error: `No stop time data for stop: ${stopId}` });
    }

    const serviceDay = getServiceDay(now);
    const todayServiceIds = this.getActiveServiceIds(serviceDay);

    let fullDayCount = 0;
    let hasBoardable = false;

    const prevServiceDay = new Date(serviceDay);
    prevServiceDay.setDate(prevServiceDay.getDate() - 1);
    const yesterdayServiceIds = this.getActiveServiceIds(prevServiceDay);

    const nowMinutes = getServiceDayMinutes(now);

    const entries: ContextualTimetableEntry[] = [];

    for (const group of timetableGroups) {
      const resolved = this.resolvedPatterns.get(group.tp);
      if (!resolved) {
        continue;
      }

      const pattern = this.tripPatterns.get(group.tp);
      if (!pattern) {
        continue;
      }
      const totalStops = pattern.stops.length;
      const stopIndex = group.si;
      const isTerminalPosition = stopIndex === totalStops - 1;

      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!todayServiceIds.has(serviceId)) {
          continue;
        }
        const arrivals = group.a?.[serviceId];
        const pickupTypes = group.pt?.[serviceId];
        const dropOffTypes = group.dt?.[serviceId];

        for (let j = 0; j < times.length; j++) {
          fullDayCount++;
          if (!hasBoardable) {
            const pt = (pickupTypes?.[j] ?? 0) as StopServiceType;
            if (pt !== 1 && !isTerminalPosition) {
              hasBoardable = true;
            }
          }
        }

        const startIdx = binarySearchFirstGte(times, nowMinutes);
        const tripInsights = this.resolveTripInsights(group.tp, stopIndex, serviceDay);
        for (let i = startIdx; i < times.length; i++) {
          const pickupType = (pickupTypes?.[i] ?? 0) as StopServiceType;
          const dropOffType = (dropOffTypes?.[i] ?? 0) as StopServiceType;
          entries.push({
            schedule: {
              departureMinutes: times[i],
              arrivalMinutes: arrivals?.[i] ?? times[i],
            },
            routeDirection: this.resolveRouteDirection(resolved, pattern, stopIndex),
            boarding: { pickupType, dropOffType },
            patternPosition: {
              stopIndex,
              totalStops,
              isTerminal: isTerminalPosition,
              isOrigin: stopIndex === 0,
            },
            serviceDate: serviceDay,
            ...(tripInsights !== undefined ? { insights: tripInsights } : {}),
          });
        }
      }

      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!yesterdayServiceIds.has(serviceId)) {
          continue;
        }
        const arrivals = group.a?.[serviceId];
        const pickupTypes = group.pt?.[serviceId];
        const dropOffTypes = group.dt?.[serviceId];

        for (let j = 0; j < times.length; j++) {
          if (times[j] < 1440) {
            continue;
          }
          fullDayCount++;
          if (!hasBoardable) {
            const pt = (pickupTypes?.[j] ?? 0) as StopServiceType;
            if (pt !== 1 && !isTerminalPosition) {
              hasBoardable = true;
            }
          }
        }

        const overnightTarget = nowMinutes + 1440;
        const startIdx = binarySearchFirstGte(times, overnightTarget);
        const tripInsights = this.resolveTripInsights(group.tp, stopIndex, prevServiceDay);
        for (let i = startIdx; i < times.length; i++) {
          const pickupType = (pickupTypes?.[i] ?? 0) as StopServiceType;
          const dropOffType = (dropOffTypes?.[i] ?? 0) as StopServiceType;
          entries.push({
            schedule: {
              departureMinutes: times[i],
              arrivalMinutes: arrivals?.[i] ?? times[i],
            },
            routeDirection: this.resolveRouteDirection(resolved, pattern, stopIndex),
            boarding: { pickupType, dropOffType },
            patternPosition: {
              stopIndex,
              totalStops,
              isTerminal: isTerminalPosition,
              isOrigin: stopIndex === 0,
            },
            serviceDate: prevServiceDay,
            ...(tripInsights !== undefined ? { insights: tripInsights } : {}),
          });
        }
      }
    }

    sortTimetableEntriesChronologically(entries);
    const totalAvailable = entries.length;
    let truncated = false;
    let result = entries;
    if (normalizedLimit !== undefined && entries.length > normalizedLimit) {
      result = entries.slice(0, normalizedLimit);
      truncated = true;
    }

    const elapsed = Math.round(performance.now() - t0);
    logger.verbose(
      `getUpcomingTimetableEntries: ${stopId} → ${result.length}/${totalAvailable} entries in ${elapsed}ms (${truncated ? 'truncated' : 'all'}) serviceDay=${formatDateKey(serviceDay)} prev=${formatDateKey(prevServiceDay)}`,
    );
    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: hasBoardable,
      totalEntries: fullDayCount,
    };
    return Promise.resolve({ success: true, data: result, truncated, meta });
  }

  getFullDayTimetableEntries(stopId: string, dateTime: Date): Promise<TimetableResult> {
    const t0 = performance.now();
    const emptyMeta: TimetableQueryMeta = {
      isBoardableOnServiceDay: false,
      totalEntries: 0,
    };
    const timetableGroups = this.timetable[stopId];
    if (!timetableGroups) {
      return Promise.resolve({ success: true, data: [], truncated: false, meta: emptyMeta });
    }

    const serviceDate = getServiceDay(dateTime);
    const activeServiceIds = this.getActiveServiceIds(serviceDate);
    const entries: TimetableEntry[] = [];

    for (const group of timetableGroups) {
      const resolved = this.resolvedPatterns.get(group.tp);
      if (!resolved) {
        continue;
      }

      const pattern = this.tripPatterns.get(group.tp);
      if (!pattern) {
        continue;
      }
      const totalStops = pattern.stops.length;
      const stopIndex = group.si;
      const isTerminalPosition = stopIndex === totalStops - 1;

      const tripInsights = this.resolveTripInsights(group.tp, stopIndex, serviceDate);
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!activeServiceIds.has(serviceId)) {
          continue;
        }
        const arrivals = group.a?.[serviceId];
        const pickupTypes = group.pt?.[serviceId];
        const dropOffTypes = group.dt?.[serviceId];
        for (let i = 0; i < times.length; i++) {
          const pickupType = (pickupTypes?.[i] ?? 0) as StopServiceType;
          const dropOffType = (dropOffTypes?.[i] ?? 0) as StopServiceType;
          entries.push({
            schedule: {
              departureMinutes: times[i],
              arrivalMinutes: arrivals?.[i] ?? times[i],
            },
            routeDirection: this.resolveRouteDirection(resolved, pattern, stopIndex),
            boarding: { pickupType, dropOffType },
            patternPosition: {
              stopIndex,
              totalStops,
              isTerminal: isTerminalPosition,
              isOrigin: stopIndex === 0,
            },
            ...(tripInsights !== undefined ? { insights: tripInsights } : {}),
          });
        }
      }
    }

    sortTimetableEntriesByDepartureTime(entries);
    const elapsed = Math.round(performance.now() - t0);
    logger.debug(
      `getFullDayTimetableEntries: ${stopId} → ${entries.length} entries in ${elapsed}ms`,
    );
    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: getTimetableEntriesState(entries) === 'boardable',
      totalEntries: entries.length,
    };
    return Promise.resolve({ success: true, data: entries, truncated: false, meta });
  }

  getRouteTypesForStop(stopId: string): Promise<Result<AppRouteTypeValue[]>> {
    const routeTypes = this.stopRouteTypeMap.get(stopId);
    if (routeTypes === undefined) {
      logger.verbose(`getRouteTypesForStop: ${stopId} → not found`);
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    logger.verbose(`getRouteTypesForStop: ${stopId} → [${routeTypes.join(', ')}]`);
    return Promise.resolve({ success: true, data: routeTypes });
  }

  getStopMetaById(stopId: string): Promise<Result<StopWithMeta>> {
    const meta = this.stopsMetaMap.get(stopId);
    if (meta) {
      return Promise.resolve({ success: true, data: meta });
    }
    return Promise.resolve({ success: false, error: `Stop not found: ${stopId}` });
  }

  getStopMetaByIds(stopIds: Set<string>): StopWithMeta[] {
    const result: StopWithMeta[] = [];
    for (const stopId of stopIds) {
      const meta = this.stopsMetaMap.get(stopId);
      if (meta) {
        result.push(meta);
      }
    }
    return result;
  }

  getStopsForRoutes(routeIds: Set<string>): Set<string> {
    const cache = this.getRouteStopsMap();
    const stopIds = new Set<string>();
    for (const routeId of routeIds) {
      const stops = cache.get(routeId);
      if (stops) {
        for (const stopId of stops) {
          stopIds.add(stopId);
        }
      }
    }
    logger.debug(`getStopsForRoutes: ${routeIds.size} routes → ${stopIds.size} stops`);
    return stopIds;
  }

  private getRouteStopsMap(): Map<string, Set<string>> {
    if (this.routeStopsCache) {
      return this.routeStopsCache;
    }
    const t0 = performance.now();
    const map = new Map<string, Set<string>>();
    for (const pattern of this.tripPatterns.values()) {
      let stops = map.get(pattern.route_id);
      if (!stops) {
        stops = new Set();
        map.set(pattern.route_id, stops);
      }
      for (const stop of pattern.stops) {
        stops.add(stop.id);
      }
    }
    this.routeStopsCache = map;
    logger.debug(
      `routeStopsCache built: ${map.size} routes in ${(performance.now() - t0).toFixed(2)}ms`,
    );
    return map;
  }

  getAllStops(): Promise<CollectionResult<Stop>> {
    const t0 = performance.now();
    const elapsed = Math.round(performance.now() - t0);
    logger.debug(`getAllStops: ${this.stops.length} stops in ${elapsed}ms`);
    return Promise.resolve({ success: true, data: this.stops, truncated: false });
  }

  async getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    if (this.shapesCache) {
      logger.debug(`getRouteShapes: ${this.shapesCache.length} shapes (cached)`);
      return { success: true, data: this.shapesCache, truncated: false };
    }
    this.shapesCache = await this.shapesPromise;
    logger.debug(`getRouteShapes: ${this.shapesCache.length} shapes`);
    return { success: true, data: this.shapesCache, truncated: false };
  }

  getAgency(agencyId: string): Promise<Result<Agency>> {
    const agency = this.agencyMap.get(agencyId);
    if (!agency) {
      return Promise.resolve({ success: false, error: `Agency not found: ${agencyId}` });
    }
    return Promise.resolve({ success: true, data: agency });
  }

  getAllSourceMeta(): Promise<CollectionResult<SourceMeta>> {
    return Promise.resolve({ success: true, data: this.sourceMetas, truncated: false });
  }

  resolveStopStats(stopId: string, serviceDate: Date): StopWithMeta['stats'] | undefined {
    const entry = this.stopInsightsMap.get(stopId);
    if (!entry) {
      return undefined;
    }
    const activeIds = this.getActiveServiceIds(getServiceDay(serviceDate));
    const groupKey = selectServiceGroup(entry.groups, activeIds);
    if (!groupKey) {
      return undefined;
    }
    return entry.stats[groupKey];
  }

  resolveRouteFreq(routeId: string, serviceDate: Date): number | undefined {
    const entry = this.routeFreqMap.get(routeId);
    if (!entry) {
      return undefined;
    }
    const activeIds = this.getActiveServiceIds(getServiceDay(serviceDate));
    const groupKey = selectServiceGroup(entry.groups, activeIds);
    if (!groupKey) {
      return undefined;
    }
    return entry.freqs[groupKey];
  }

  private resolveTripInsights(
    patternId: string,
    stopIndex: number,
    serviceDate: Date,
  ): { remainingMinutes: number; totalMinutes: number; freq: number } | undefined {
    const entry = this.patternStatsMap.get(patternId);
    if (!entry) {
      return undefined;
    }
    const activeIds = this.getActiveServiceIds(serviceDate);
    const groupKey = selectServiceGroup(entry.groups, activeIds);
    if (!groupKey) {
      return undefined;
    }
    const rd = entry.rds[groupKey];
    if (!rd) {
      return undefined;
    }
    const remainingMinutes = rd[stopIndex];
    if (remainingMinutes === undefined) {
      return undefined;
    }
    const freq = entry.freqs[groupKey];
    if (freq === undefined) {
      return undefined;
    }
    return { remainingMinutes, totalMinutes: rd[0], freq };
  }

  private resolveRouteDirection(
    resolved: ResolvedPattern,
    pattern: TripPattern,
    stopIndex: number,
  ): RouteDirection {
    const stop = pattern.stops[stopIndex];
    const src = this.headsignTranslations.get(resolved.sourcePrefix);
    return {
      route: resolved.route,
      tripHeadsign: {
        name: resolved.headsign,
        names: src?.trip_headsigns[resolved.headsign] ?? {},
      },
      stopHeadsign:
        stop.headsign != null
          ? {
              name: stop.headsign,
              names: src?.stop_headsigns[stop.headsign] ?? {},
            }
          : undefined,
      direction: pattern.direction,
    };
  }

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
