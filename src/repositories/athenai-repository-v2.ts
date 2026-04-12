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
 * - TimetableEntry / ContextualTimetableEntry: per-departure boarding info and pattern position
 * - Shapes lazy-loaded in background after create()
 * - Stop.agency_id is empty string (v2 GTFS spec compliance)
 * - location_type=1 (station) stops are filtered out until the UI
 *   supports station grouping (v2 pipeline outputs all location_types)
 * - create() returns CreateResult with loadResult for error tracking
 */

import type {
  CalendarExceptionJson,
  CalendarServiceJson,
  TranslationsJson,
} from '../types/data/transit-json';
import type {
  LookupV2Json,
  ServiceGroupEntry,
  TimetableGroupV2Json,
} from '../types/data/transit-v2-json';
import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type { Agency, Route, AppRouteTypeValue, Stop } from '../types/app/transit';
import type {
  ContextualTimetableEntry,
  RouteDirection,
  SourceMeta,
  StopServiceType,
  StopWithMeta,
  TimetableEntry,
  TripPattern,
} from '../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableQueryMeta,
  TimetableResult,
  UpcomingTimetableResult,
} from '../types/app/repository';
import { getTimetableEntriesState } from '../domain/transit/timetable-utils';
import { MAX_STOPS_RESULT } from './transit-repository';
import type { TransitRepository } from './transit-repository';
import type { TransitDataSourceV2 } from '../datasources/transit-data-source-v2';
import type { SourceDataV2 } from '../datasources/transit-data-source-v2';
import { FetchDataSourceV2 } from '../datasources/fetch-data-source-v2';
import { createLogger } from '../lib/logger';
import { getServiceDay, getServiceDayMinutes } from '../domain/transit/service-day';
import { selectServiceGroup } from '../domain/transit/select-service-group';
import { APP_ROUTE_TYPES } from '../config/route-types';
import {
  binarySearchFirstGte,
  computeActiveServiceIds,
  extractPrefix,
  formatDateKey,
  minutesToDate,
} from '../domain/transit/calendar-utils';
import { injectOriginLang } from '../domain/transit/i18n/inject-origin-lang';
import { AGENCY_ATTRIBUTES } from '../config/agency-attributes';

/** Set of valid AppRouteTypeValue integers. Values outside this set are normalized to -1. */
const VALID_ROUTE_TYPE_VALUES = new Set<number>(APP_ROUTE_TYPES.map((rt) => rt.value));

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
  stopsMetaMap: Map<string, StopWithMeta>;
  routeMap: Map<string, Route>;
  agencyMap: Map<string, Agency>;
  tripPatterns: Map<string, TripPattern>;
  resolvedPatterns: Map<string, ResolvedPattern>;
  timetable: Record<string, TimetableGroupV2Json[]>;
  calendarServices: CalendarServiceJson[];
  calendarExceptions: Map<string, CalendarExceptionJson[]>;
  stopRouteTypeMap: Map<string, AppRouteTypeValue[]>;
  translationsMap: TranslationsJson;
  headsignTranslations: HeadsignTranslationsByPrefix;
  lookup: LookupV2Json;
  sourceMetas: SourceMeta[];
}

// ---------------------------------------------------------------------------
// Stop filtering
// ---------------------------------------------------------------------------

/**
 * Filter v2 stops to only include location_type=0 (stop/platform).
 *
 * The v2 pipeline outputs all location_types including l=1 (parent
 * station), but the UI does not yet support station grouping. Parent
 * stations have no timetable entries and would confusingly display
 * "本日の運行は終了しました".
 *
 * TODO: Remove this filter when the UI adds station grouping support.
 * The pipeline data is ready — only this filter needs to be removed.
 */
function isVisibleStop(stop: { l: number }): boolean {
  return stop.l === 0;
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
  // --- Feed language map ---
  // Build prefix → feed_lang for normalizing translatable data below.
  // GTFS base values (stop_name, trip_headsign, etc.) are in the language
  // declared by feed_lang (feed_info.txt). We inject the base value under
  // that language key into translation records so the resolver can find it
  // as a language candidate. See Issue #107.
  //
  // feed_lang is per-feed (per-source), so a single value per prefix is
  // correct — unlike agency_lang which is per-agency and could differ
  // within a multi-agency feed.
  //
  // Fallback: when feed_lang is empty (e.g. VAG Freiburg), use the first
  // non-empty agency_lang from the source as a best-effort approximation.
  const feedLangByPrefix = new Map<string, string>();
  for (const source of sources) {
    const feedLang = source.data.feedInfo.data.l;
    if (feedLang) {
      feedLangByPrefix.set(source.prefix, feedLang);
    } else {
      // Fallback to first non-empty agency_lang
      for (const a of source.data.agency.data) {
        if (a.l) {
          feedLangByPrefix.set(source.prefix, a.l);
          break;
        }
      }
    }
  }

  // --- Translations ---
  // headsigns/stop_headsigns are kept per-source to preserve agency-specific
  // translations. Other maps use prefixed IDs and don't collide.
  const translationsMap: TranslationsJson = {
    headsigns: {},
    stop_headsigns: {},
    stop_names: {},
    route_names: {},
    agency_names: {},
  };
  const headsignTranslations: HeadsignTranslationsByPrefix = new Map();
  for (const source of sources) {
    const t = source.data.translations.data;
    const feedLang = feedLangByPrefix.get(source.prefix);

    // Normalize headsign/stop_headsign translations: inject base value
    // (the headsign text itself) under feed_lang when not already present.
    const headsigns: Record<string, Record<string, string>> = {};
    for (const [text, langMap] of Object.entries(t.headsigns)) {
      headsigns[text] = injectOriginLang(langMap, text, feedLang);
    }
    const stopHeadsigns: Record<string, Record<string, string>> = {};
    for (const [text, langMap] of Object.entries(t.stop_headsigns)) {
      stopHeadsigns[text] = injectOriginLang(langMap, text, feedLang);
    }
    headsignTranslations.set(source.prefix, {
      headsigns,
      stop_headsigns: stopHeadsigns,
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
  }

  // --- Agencies ---
  // Pipeline outputs data-source fields only (AgencyV2Json).
  // Display names (long/short) and brand colors come from
  // agency-attributes.ts, merged here at runtime.
  const agencyMap = new Map<string, Agency>();
  for (const source of sources) {
    const feedLang = feedLangByPrefix.get(source.prefix);
    for (const a of source.data.agency.data) {
      const attrs = AGENCY_ATTRIBUTES[a.i];
      agencyMap.set(a.i, {
        agency_id: a.i,
        agency_name: a.n,
        agency_long_name: attrs?.longName.ja ?? '',
        agency_short_name: attrs?.shortName.ja ?? '',
        agency_names: injectOriginLang(translationsMap.agency_names[a.i] ?? {}, a.n, feedLang),
        agency_long_names: attrs?.longName ?? {},
        agency_short_names: attrs?.shortName ?? {},
        agency_url: a.u,
        agency_lang: a.l ?? '',
        agency_timezone: a.tz ?? '',
        agency_fare_url: a.fu ?? '',
        agency_colors: attrs?.colors ?? [],
      });
    }
  }

  // debug log
  // for (const [id, ag] of agencyMap) {
  //   logger.debug(`[AgencyMap] Agency ${id}:` + JSON.stringify(ag, null, 2));
  // }

  // --- Stops (v2: no agency_id) ---
  // Currently excludes location_type=1 (parent station) stops because
  // the UI does not yet support station grouping. Parent stations have
  // no timetable entries and display "本日の運行は終了しました", which
  // is confusing. When the UI adds station grouping support, remove
  // this filter to include parent stations.
  // See: v2 pipeline outputs all location_types (unlike v1 which
  // only output l=0). The data is available in DataBundle.stops.
  const stops: Stop[] = sources
    .flatMap((s) => s.data.stops.data)
    .filter(isVisibleStop)
    .map((s) => ({
      stop_id: s.i,
      stop_name: s.n,
      stop_names: injectOriginLang(
        translationsMap.stop_names[s.i] ?? {},
        s.n,
        feedLangByPrefix.get(extractPrefix(s.i)),
      ),
      stop_lat: s.a,
      stop_lon: s.o,
      location_type: s.l,
      // v2: GTFS spec has no agency_id on stops. Agency is resolved
      // via timetable -> tripPattern -> route -> agency_id.
      agency_id: '',
      // v2 optional fields — omitted when the source does not provide them.
      ...(s.wb !== undefined && { wheelchair_boarding: s.wb }),
      ...(s.ps !== undefined && { parent_station: s.ps }),
      ...(s.pc !== undefined && { platform_code: s.pc }),
    }));

  // --- Routes ---
  const routeMap = new Map<string, Route>();
  for (const source of sources) {
    const feedLang = feedLangByPrefix.get(source.prefix);
    for (const r of source.data.routes.data) {
      routeMap.set(r.i, {
        route_id: r.i,
        route_short_name: r.s,
        route_short_names: injectOriginLang({}, r.s, feedLang),
        route_long_name: r.l,
        route_long_names: injectOriginLang(translationsMap.route_names[r.i] ?? {}, r.l, feedLang),
        route_type: (VALID_ROUTE_TYPE_VALUES.has(r.t) ? r.t : -1) as AppRouteTypeValue,
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
  // Convert TripPatternJson (pipeline JSON schema) to TripPattern (app-internal type).
  // This decouples downstream logic from the JSON structure so that future
  // TripPatternJson changes (e.g. per-stop attributes) are absorbed here.
  const tripPatterns = new Map<string, TripPattern>();
  for (const source of sources) {
    for (const [id, pattern] of Object.entries(source.data.tripPatterns.data)) {
      tripPatterns.set(id, {
        route_id: pattern.r,
        headsign: pattern.h,
        direction: pattern.dir,
        stops: pattern.stops.map((s) => ({
          id: s.id,
          ...(s.sh != null ? { headsign: s.sh } : {}),
          ...(s.sd != null ? { shapeDistTraveled: s.sd } : {}),
        })),
      });
    }
  }

  // --- Resolved patterns (pre-computed for O(1) lookup) ---
  const resolvedPatterns = new Map<string, ResolvedPattern>();
  for (const [id, pattern] of tripPatterns) {
    const route = routeMap.get(pattern.route_id);
    if (route) {
      resolvedPatterns.set(id, {
        route,
        headsign: pattern.headsign,
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
  const stopRouteTypeMap = new Map<string, AppRouteTypeValue[]>();
  const stopAgenciesMap = new Map<string, Agency[]>();
  const stopRoutesMap = new Map<string, Route[]>();

  for (const [stopId, groups] of Object.entries(timetable)) {
    const types = new Set<AppRouteTypeValue>();
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
      ...new Set(
        source.data.routes.data.map((r) =>
          VALID_ROUTE_TYPE_VALUES.has(r.t) ? (r.t as AppRouteTypeValue) : (-1 as AppRouteTypeValue),
        ),
      ),
    ].sort((a, b) => a - b);

    sourceMetas.push({
      id: source.prefix,
      name: agency?.agency_short_name || source.prefix,
      version: fi.v,
      validity: { startDate: fi.s, endDate: fi.e },
      routeTypes: sourceRouteTypes,
      keywords: [],
      stats: {
        // Count only l=0 stops to match the repository's stop filter.
        // When location_type=1 support is added to the UI, update this
        // to include all location_types from the pipeline output.
        stopCount: source.data.stops.data.filter((s) => s.l === 0).length,
        routeCount: source.data.routes.data.length,
      },
    });
  }

  // --- StopWithMeta map (stop_id → StopWithMeta) ---
  const stopsMetaMap = new Map<string, StopWithMeta>();
  for (const stop of stops) {
    stopsMetaMap.set(stop.stop_id, {
      stop,
      agencies: stopAgenciesMap.get(stop.stop_id) ?? [],
      routes: stopRoutesMap.get(stop.stop_id) ?? [],
    });
  }

  return {
    stops,
    stopsMetaMap,
    routeMap,
    agencyMap,
    tripPatterns,
    resolvedPatterns,
    timetable,
    calendarServices,
    calendarExceptions,
    stopRouteTypeMap,
    translationsMap,
    headsignTranslations,
    lookup,
    sourceMetas,
  };
}

// ---------------------------------------------------------------------------
// Stop insights enrichment (stopStats + stopGeo)
// ---------------------------------------------------------------------------

/**
 * Enrich stopsMetaMap with per-stop stats and geo data from insights bundles.
 *
 * - stopStats: from per-source InsightsBundle (all service groups stored
 *   in stopInsightsMap for date-aware resolution via resolveStopStats)
 * - stopGeo: from GlobalInsightsBundle
 *
 * Errors (network failures, invalid bundles) are logged as warnings
 * but do not prevent initialization. Stats and geo are optional
 * enhancements — stopsMetaMap entries remain valid without them.
 */
async function enrichStopInsights(
  stopsMetaMap: Map<string, StopWithMeta>,
  prefixes: string[],
  dataSource: TransitDataSourceV2,
  stopInsightsMap: Map<
    string,
    {
      groups: ServiceGroupEntry[];
      stats: Partial<Record<string, NonNullable<StopWithMeta['stats']>>>;
    }
  >,
): Promise<void> {
  const t0 = performance.now();

  // Load per-source insights and global insights in parallel
  const [insightsResults, globalResult] = await Promise.all([
    Promise.allSettled(prefixes.map((prefix) => dataSource.loadInsights(prefix))),
    dataSource.loadGlobalInsights().catch((e) => {
      logger.warn('Failed to load global insights:', e);
      return null;
    }),
  ]);

  // Apply stopStats from per-source insights
  let statsCount = 0;
  for (let i = 0; i < insightsResults.length; i++) {
    const r = insightsResults[i];
    if (r.status === 'rejected') {
      logger.warn(`Failed to load insights for ${prefixes[i]}:`, r.reason);
      continue;
    }
    if (!r.value) {
      continue;
    }
    const insights = r.value;
    if (!insights.stopStats) {
      continue;
    }

    const groups = insights.serviceGroups.data;
    if (groups.length === 0) {
      continue;
    }

    // Store all service groups' stats for date-aware resolution.
    for (const [groupKey, groupStats] of Object.entries(insights.stopStats.data)) {
      for (const [stopId, s] of Object.entries(groupStats)) {
        const meta = stopsMetaMap.get(stopId);
        if (!meta) {
          continue;
        }
        let entry = stopInsightsMap.get(stopId);
        if (!entry) {
          // Groups are set from the first source to populate this entry.
          // This assumes each stop ID belongs to at most one source (prefixed IDs).
          // If two sources share a stop ID, stats from the second source's group
          // keys may not be resolvable via selectServiceGroup.
          entry = { groups, stats: {} };
          stopInsightsMap.set(stopId, entry);
        }
        entry.stats[groupKey] = {
          freq: s.freq,
          routeCount: s.rc,
          routeTypeCount: s.rtc,
          earliestDeparture: s.ed,
          latestDeparture: s.ld,
        };
        statsCount++;
      }
    }
  }

  // Apply stopGeo from global insights
  let geoCount = 0;
  if (globalResult?.stopGeo) {
    for (const [stopId, g] of Object.entries(globalResult.stopGeo.data)) {
      const meta = stopsMetaMap.get(stopId);
      if (!meta) {
        continue;
      }
      meta.geo = {
        nearestRoute: g.nr,
        walkablePortal: g.wp,
        connectivity: g.cn
          ? Object.fromEntries(
              Object.entries(g.cn).map(([group, c]) => [
                group,
                { routeCount: c.rc, freq: c.freq, stopCount: c.sc },
              ]),
            )
          : undefined,
      };
      geoCount++;
    }
  }

  const elapsed = Math.round(performance.now() - t0);
  logger.info(
    `Stop insights enriched in ${elapsed}ms: stats=${statsCount} stops, geo=${geoCount} stops`,
  );
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

  // Lazy-initialized reverse map: route_id → Set<stop_id>.
  // Built on first getStopsForRoutes() call by scanning all tripPatterns once.
  // Safe to cache because tripPatterns are immutable after load.
  private routeStopsCache: Map<string, Set<string>> | null = null;

  // Per-stop insights for date-aware stats resolution.
  // Populated by enrichStopInsights, queried by resolveStopStats.
  private stopInsightsMap = new Map<
    string,
    {
      groups: ServiceGroupEntry[];
      stats: Partial<Record<string, NonNullable<StopWithMeta['stats']>>>;
    }
  >();

  // Per-route freq for date-aware frequency resolution.
  // Populated by loadAllShapesWithInsights, queried by resolveRouteFreq.
  private routeFreqMap = new Map<
    string,
    {
      groups: ServiceGroupEntry[];
      freqs: Partial<Record<string, number>>;
    }
  >();

  // Shapes: background-loaded after create()
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

  /** Start background loading of shapes and insights for all loaded prefixes. */
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

    // Create the repository instance first, then populate its internal maps.
    // stopInsightsMap is populated by enrichStopInsights (below), and
    // routeFreqMap is populated by loadAllShapesWithInsights (background).
    // Both mutate the instance's maps after construction — this is intentional:
    // constructor injection would require blocking on shapes load (which runs
    // in background) or breaking the symmetry between the two maps.
    // The mutation is confined to create() — no external code observes the
    // intermediate state before this method returns.
    const repository = new AthenaiRepositoryV2(merged);

    // Enrich stopsMetaMap with insights (stopStats + stopGeo).
    // Errors are logged but non-fatal — stats/geo are optional enhancements.
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
    // Start background shapes loading after repository creation
    repository.startShapesLoad(loadResult.loaded, dataSource);
    return { repository, loadResult };
  }

  // ---------------------------------------------------------------------------
  // Shapes background loading
  // ---------------------------------------------------------------------------

  private async loadAllShapesWithInsights(
    prefixes: string[],
    dataSource: TransitDataSourceV2,
  ): Promise<RouteShape[]> {
    const t0 = performance.now();

    // Load shapes and insights in parallel
    const [shapesResults, insightsResults] = await Promise.all([
      Promise.allSettled(prefixes.map((prefix) => dataSource.loadShapes(prefix))),
      Promise.allSettled(prefixes.map((prefix) => dataSource.loadInsights(prefix))),
    ]);

    // Build per-route insights lookup from all insights bundles.
    // tripPatternGeo is keyed by pattern ID; we resolve to route ID
    // via resolvedPatterns to find the best freq and geo for each route.
    // When multiple patterns exist for a route, sum their freq.
    const routeFreq = new Map<string, number>();
    const routeGeo = new Map<string, { pathDist: number; isCircular: boolean }>();

    for (const r of insightsResults) {
      if (r.status !== 'fulfilled' || !r.value) {
        continue;
      }
      const insights = r.value;

      // Geo: keyed by pattern ID, service-group independent
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

      // Freq: keyed by service group, then pattern ID.
      // Store all service groups' freq for date-aware resolution.
      if (insights.tripPatternStats) {
        const serviceGroups = insights.serviceGroups.data;
        for (const [groupKey, groupStats] of Object.entries(insights.tripPatternStats.data)) {
          for (const [patternId, stats] of Object.entries(groupStats)) {
            const resolved = this.resolvedPatterns.get(patternId);
            if (!resolved) {
              continue;
            }
            const routeId = resolved.route.route_id;

            // Store per-group freq in routeFreqMap for resolveRouteFreq
            let entry = this.routeFreqMap.get(routeId);
            if (!entry) {
              // Groups from the first source; assumes route IDs are source-prefixed.
              // See stopInsightsMap comment for multi-source assumption.
              entry = { groups: serviceGroups, freqs: {} };
              this.routeFreqMap.set(routeId, entry);
            }
            entry.freqs[groupKey] = (entry.freqs[groupKey] ?? 0) + stats.freq;
          }
        }

        // Also populate routeFreq (used for RouteShape.freq initial value)
        // using the first group as default
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

    // Build shapes with insights enrichment
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

  // ---------------------------------------------------------------------------
  // TransitRepository implementation
  // ---------------------------------------------------------------------------

  /** {@inheritDoc TransitRepository.getStopsInBounds} */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    const t0 = performance.now();
    const effectiveLimit = Math.min(limit, MAX_STOPS_RESULT);
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
    const sorted: { meta: StopWithMeta; distKm: number }[] = [];
    for (const meta of this.stopsMetaMap.values()) {
      const { stop } = meta;
      const dlat = stop.stop_lat - center.lat;
      const dlng = stop.stop_lon - center.lng;
      // Rough approximation: 1 degree lat ~ 111km, 1 degree lng ~ 91km (at 35 N)
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

  /** {@inheritDoc TransitRepository.getUpcomingTimetableEntries} */
  getUpcomingTimetableEntries(
    stopId: string,
    now: Date,
    limit?: number,
  ): Promise<UpcomingTimetableResult> {
    const t0 = performance.now();
    const timetableGroups = this.timetable[stopId];
    if (!timetableGroups) {
      return Promise.resolve({ success: false, error: `No departure data for stop: ${stopId}` });
    }

    const serviceDay = getServiceDay(now);
    const todayServiceIds = this.getActiveServiceIds(serviceDay);

    // Track full-day metadata during scan.
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

      // pattern is guaranteed to exist when resolved exists — both are built
      // from the same tripPatterns map during initialization. Guard defensively
      // to prevent incorrect isTerminal=true when totalStops=0, stopIndex=-1.
      const pattern = this.tripPatterns.get(group.tp);
      if (!pattern) {
        continue;
      }
      const totalStops = pattern.stops.length;
      // For circular routes, the same stop_id appears at both index 0 and last.
      // Pre-compute both indices to resolve per-entry using boarding types.
      const firstIndex = pattern.stops.findIndex((s) => s.id === stopId);
      let lastIndex = -1;
      for (let k = pattern.stops.length - 1; k >= 0; k--) {
        if (pattern.stops[k].id === stopId) {
          lastIndex = k;
          break;
        }
      }
      const isCircularStop = firstIndex !== lastIndex;

      // Today's services
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!todayServiceIds.has(serviceId)) {
          continue;
        }
        const arrivals = group.a?.[serviceId];
        const pickupTypes = group.pt?.[serviceId];
        const dropOffTypes = group.dt?.[serviceId];

        // Count full-day entries and check boardability before time filtering.
        for (let j = 0; j < times.length; j++) {
          fullDayCount++;
          if (!hasBoardable) {
            const pt = (pickupTypes?.[j] ?? 0) as StopServiceType;
            const si = isCircularStop && pt === 1 ? lastIndex : firstIndex;
            const isTerminal = si === totalStops - 1;
            if (pt !== 1 && !isTerminal) {
              hasBoardable = true;
            }
          }
        }

        const startIdx = binarySearchFirstGte(times, nowMinutes);
        for (let i = startIdx; i < times.length; i++) {
          const pickupType = (pickupTypes?.[i] ?? 0) as StopServiceType;
          const dropOffType = (dropOffTypes?.[i] ?? 0) as StopServiceType;
          // Circular routes: same stop_id at first and last position.
          // Use pickupType to distinguish: terminal arrivals have pickupType=1.
          const stopIndex = isCircularStop && pickupType === 1 ? lastIndex : firstIndex;
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
              isTerminal: stopIndex === totalStops - 1,
              isOrigin: stopIndex === 0,
            },
            serviceDate: serviceDay,
          });
        }
      }

      // Previous service day's overnight times (departures >= 24:00 from yesterday)
      for (const [serviceId, times] of Object.entries(group.d)) {
        if (!yesterdayServiceIds.has(serviceId)) {
          continue;
        }
        const arrivals = group.a?.[serviceId];
        const pickupTypes = group.pt?.[serviceId];
        const dropOffTypes = group.dt?.[serviceId];

        // Count overnight entries (>= 1440) for meta consistency with data.
        for (let j = 0; j < times.length; j++) {
          if (times[j] < 1440) {
            continue;
          }
          fullDayCount++;
          if (!hasBoardable) {
            const pt = (pickupTypes?.[j] ?? 0) as StopServiceType;
            const si = isCircularStop && pt === 1 ? lastIndex : firstIndex;
            const isTerminal = si === totalStops - 1;
            if (pt !== 1 && !isTerminal) {
              hasBoardable = true;
            }
          }
        }

        const overnightTarget = nowMinutes + 1440;
        const startIdx = binarySearchFirstGte(times, overnightTarget);
        for (let i = startIdx; i < times.length; i++) {
          const pickupType = (pickupTypes?.[i] ?? 0) as StopServiceType;
          const dropOffType = (dropOffTypes?.[i] ?? 0) as StopServiceType;
          const stopIndex = isCircularStop && pickupType === 1 ? lastIndex : firstIndex;
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
              isTerminal: stopIndex === totalStops - 1,
              isOrigin: stopIndex === 0,
            },
            serviceDate: prevServiceDay,
          });
        }
      }
    }

    // Sort by actual chronological time using serviceDate + departureMinutes.
    // Simple departureMinutes comparison is insufficient because overnight entries
    // from the previous service day (e.g., prevDay + 1900 min) must interleave
    // correctly with today's entries (e.g., today + 400 min).
    entries.sort((a, b) => {
      const aTime = minutesToDate(a.serviceDate, a.schedule.departureMinutes).getTime();
      const bTime = minutesToDate(b.serviceDate, b.schedule.departureMinutes).getTime();
      return aTime - bTime;
    });
    const totalAvailable = entries.length;
    let truncated = false;
    let result = entries;
    if (limit !== undefined && entries.length > limit) {
      result = entries.slice(0, limit);
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

  /** {@inheritDoc TransitRepository.getFullDayTimetableEntries} */
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

      // pattern is guaranteed to exist when resolved exists — both are built
      // from the same tripPatterns map during initialization. Guard defensively
      // to prevent incorrect isTerminal=true when totalStops=0, stopIndex=-1.
      const pattern = this.tripPatterns.get(group.tp);
      if (!pattern) {
        continue;
      }
      const totalStops = pattern.stops.length;
      const firstIndex = pattern.stops.findIndex((s) => s.id === stopId);
      let lastIndex = -1;
      for (let k = pattern.stops.length - 1; k >= 0; k--) {
        if (pattern.stops[k].id === stopId) {
          lastIndex = k;
          break;
        }
      }
      const isCircularStop = firstIndex !== lastIndex;

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
          const stopIndex = isCircularStop && pickupType === 1 ? lastIndex : firstIndex;
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
              isTerminal: stopIndex === totalStops - 1,
              isOrigin: stopIndex === 0,
            },
          });
        }
      }
    }

    entries.sort((a, b) => a.schedule.departureMinutes - b.schedule.departureMinutes);
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

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<AppRouteTypeValue[]>> {
    const routeTypes = this.stopRouteTypeMap.get(stopId);
    if (routeTypes === undefined) {
      logger.verbose(`getRouteTypesForStop: ${stopId} → not found`);
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    logger.verbose(`getRouteTypesForStop: ${stopId} → [${routeTypes.join(', ')}]`);
    return Promise.resolve({ success: true, data: routeTypes });
  }

  /** {@inheritDoc TransitRepository.getStopMetaById} */
  getStopMetaById(stopId: string): Promise<Result<StopWithMeta>> {
    const meta = this.stopsMetaMap.get(stopId);
    if (meta) {
      return Promise.resolve({ success: true, data: meta });
    }
    return Promise.resolve({ success: false, error: `Stop not found: ${stopId}` });
  }

  /** {@inheritDoc TransitRepository.getStopMetaByIds} */
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

  /** {@inheritDoc TransitRepository.getStopsForRoutes} */
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

  /** Builds and caches the route_id → stop_ids reverse map on first call. */
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

  /** {@inheritDoc TransitRepository.resolveStopStats} */
  resolveStopStats(stopId: string, serviceDate: Date): StopWithMeta['stats'] | undefined {
    const entry = this.stopInsightsMap.get(stopId);
    if (!entry) {
      return undefined;
    }
    const activeIds = this.getActiveServiceIds(serviceDate);
    const groupKey = selectServiceGroup(entry.groups, activeIds);
    if (!groupKey) {
      return undefined;
    }
    return entry.stats[groupKey];
  }

  /** {@inheritDoc TransitRepository.resolveRouteFreq} */
  resolveRouteFreq(routeId: string, serviceDate: Date): number | undefined {
    const entry = this.routeFreqMap.get(routeId);
    if (!entry) {
      return undefined;
    }
    const activeIds = this.getActiveServiceIds(serviceDate);
    const groupKey = selectServiceGroup(entry.groups, activeIds);
    if (!groupKey) {
      return undefined;
    }
    return entry.freqs[groupKey];
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a RouteDirection for a specific stop in a trip pattern.
   *
   * Resolves both trip-level and stop-level headsigns with their
   * translations into {@link TranslatableText} objects. Effective
   * headsign selection is deferred to the display name resolver.
   */
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
        names: src?.headsigns[resolved.headsign] ?? {},
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
