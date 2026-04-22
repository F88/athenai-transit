import type { CalendarExceptionJson, TranslationsJson } from '../../types/data/transit-json';
import type {
  AgencyV2Json,
  LookupV2Json,
  RouteV2Json,
  TimetableGroupV2Json,
} from '../../types/data/transit-v2-json';
import type { Agency, AppRouteTypeValue, Route, Stop } from '../../types/app/transit';
import type { SourceMeta, StopWithMeta, TripPattern } from '../../types/app/transit-composed';
import type { SourceDataV2 } from '../../datasources/transit-data-source-v2';
import { APP_ROUTE_TYPES } from '../../config/route-types';
import { AGENCY_ATTRIBUTES, type AgencyAttributes } from '../../config/agency-attributes';
import { extractPrefix } from '../../domain/transit/calendar-utils';
import { injectOriginLang } from '../../domain/transit/i18n/inject-origin-lang';
import { normalizeAgencyColorPairs } from '@/domain/transit/color-resolver/agency-colors';
import {
  normalizeRouteGtfsColors,
  type NormalizedRouteGtfsColors,
} from '@/domain/transit/color-resolver/route-colors';
import type {
  HeadsignTranslationsByPrefix,
  MergedDataV2,
  PatternTimetableEntry,
  ResolvedPattern,
} from './types';

/** Set of valid AppRouteTypeValue integers. Values outside this set are normalized to -1. */
const VALID_ROUTE_TYPE_VALUES = new Set<number>(APP_ROUTE_TYPES.map((rt) => rt.value));

function normalizeAppRouteType(routeType: number): AppRouteTypeValue {
  return (VALID_ROUTE_TYPE_VALUES.has(routeType) ? routeType : -1) as AppRouteTypeValue;
}

/**
 * Applies app-side overrides for known route color data-quality issues.
 *
 * This function is intentionally exception-based. It does not perform
 * general GTFS color normalization; that is handled by
 * `normalizeRouteGtfsColors`.
 *
 * Currently this is used only for known feed-specific cases where the
 * raw route color pair is technically present but not suitable for UI
 * display, such as Kanto Bus routes that provide `000000/000000`.
 *
 * The override policy is curated by the app and relies on stable
 * agency-specific metadata in `AGENCY_ATTRIBUTES`.
 *
 * @param route Raw route JSON used to inspect feed-provided color fields.
 * @param colors Already-normalized GTFS route colors.
 * @returns Route colors after applying known app-side exception rules.
 */
function applyRouteColorDataQualityOverrides(
  route: Pick<RouteV2Json, 'ai' | 'c' | 'tc'>,
  colors: NormalizedRouteGtfsColors,
): NormalizedRouteGtfsColors {
  const rawRouteColor = route.c?.trim().toUpperCase() ?? '';
  const rawRouteTextColor = route.tc?.trim().toUpperCase() ?? '';

  const KANTO_BUS_AGENCY_ID = 'ktbus:8011201001183';

  // Override rule for Kanto Bus (ktbus)
  if (route.ai === KANTO_BUS_AGENCY_ID) {
    // black on black is a common issue with Kanto Bus route colors.
    if (rawRouteColor === '000000' && rawRouteTextColor === '000000') {
      const primaryAgencyColor = AGENCY_ATTRIBUTES[route.ai]?.colors?.[0];
      if (primaryAgencyColor) {
        return normalizeRouteGtfsColors(primaryAgencyColor.bg, primaryAgencyColor.text);
      }
    }
  }

  return colors;
}

function buildAgencyRecord(
  agency: AgencyV2Json,
  feedLang: string | undefined,
  agencyNameTranslations: Record<string, string>,
  attrs: AgencyAttributes | undefined,
): Agency {
  return {
    agency_id: agency.i,
    agency_name: agency.n,
    agency_long_name: attrs?.longName.ja ?? '',
    agency_short_name: attrs?.shortName.ja ?? '',
    agency_names: injectOriginLang(agencyNameTranslations, agency.n, feedLang),
    agency_long_names: attrs?.longName ?? {},
    agency_short_names: attrs?.shortName ?? {},
    agency_url: agency.u,
    agency_lang: agency.l ?? '',
    agency_timezone: agency.tz ?? '',
    agency_fare_url: agency.fu ?? '',
    agency_colors: normalizeAgencyColorPairs(attrs?.colors ?? []),
  };
}

function buildRouteRecord(
  route: RouteV2Json,
  feedLang: string | undefined,
  routeShortNameTranslations: Record<string, string>,
  routeLongNameTranslations: Record<string, string>,
): Route {
  // Normalize route colors first so they can be used in the fallback logic when applying data-quality overrides.
  const colors = applyRouteColorDataQualityOverrides(
    route,
    normalizeRouteGtfsColors(route.c, route.tc),
  );

  return {
    route_id: route.i,
    route_short_name: route.s,
    route_short_names: injectOriginLang(routeShortNameTranslations, route.s, feedLang),
    route_long_name: route.l,
    route_long_names: injectOriginLang(routeLongNameTranslations, route.l, feedLang),
    route_type: normalizeAppRouteType(route.t),
    route_color: colors.routeColor,
    route_text_color: colors.routeTextColor,
    agency_id: route.ai,
  };
}

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

/** Merge multiple v2 SourceDataV2 into a single unified dataset. */
export function mergeSourcesV2(sources: SourceDataV2[]): MergedDataV2 {
  const feedLangByPrefix = new Map<string, string>();
  for (const source of sources) {
    const feedLang = source.data.feedInfo.data.l;
    if (feedLang) {
      feedLangByPrefix.set(source.prefix, feedLang);
    } else {
      for (const a of source.data.agency.data) {
        if (a.l) {
          feedLangByPrefix.set(source.prefix, a.l);
          break;
        }
      }
    }
  }

  const translationsMap: TranslationsJson = {
    agency_names: {},
    route_long_names: {},
    route_short_names: {},
    stop_names: {},
    trip_headsigns: {},
    stop_headsigns: {},
  };
  const headsignTranslations: HeadsignTranslationsByPrefix = new Map();
  for (const source of sources) {
    const t = source.data.translations.data;
    const feedLang = feedLangByPrefix.get(source.prefix);

    const tripHeadsigns: Record<string, Record<string, string>> = {};
    if (t.trip_headsigns) {
      for (const [text, langMap] of Object.entries(t.trip_headsigns)) {
        tripHeadsigns[text] = injectOriginLang(langMap, text, feedLang);
      }
    }
    const stopHeadsigns: Record<string, Record<string, string>> = {};
    if (t.stop_headsigns) {
      for (const [text, langMap] of Object.entries(t.stop_headsigns)) {
        stopHeadsigns[text] = injectOriginLang(langMap, text, feedLang);
      }
    }
    headsignTranslations.set(source.prefix, {
      trip_headsigns: tripHeadsigns,
      stop_headsigns: stopHeadsigns,
    });

    if (t.stop_names) {
      Object.assign(translationsMap.stop_names, t.stop_names);
    }
    if (t.route_long_names) {
      Object.assign(translationsMap.route_long_names, t.route_long_names);
    }
    if (t.route_short_names) {
      Object.assign(translationsMap.route_short_names, t.route_short_names);
    }
    if (t.agency_names) {
      Object.assign(translationsMap.agency_names, t.agency_names);
    }
  }

  const agencyMap = new Map<string, Agency>();
  for (const source of sources) {
    const feedLang = feedLangByPrefix.get(source.prefix);
    for (const a of source.data.agency.data) {
      agencyMap.set(
        a.i,
        buildAgencyRecord(
          a,
          feedLang,
          translationsMap.agency_names[a.i] ?? {},
          AGENCY_ATTRIBUTES[a.i],
        ),
      );
    }
  }

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
      agency_id: '',
      ...(s.wb !== undefined && { wheelchair_boarding: s.wb }),
      ...(s.ps !== undefined && { parent_station: s.ps }),
      ...(s.pc !== undefined && { platform_code: s.pc }),
    }));

  const routeMap = new Map<string, Route>();
  for (const source of sources) {
    const feedLang = feedLangByPrefix.get(source.prefix);
    for (const r of source.data.routes.data) {
      routeMap.set(
        r.i,
        buildRouteRecord(
          r,
          feedLang,
          translationsMap.route_short_names[r.i] ?? {},
          translationsMap.route_long_names[r.i] ?? {},
        ),
      );
    }
  }

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

  const timetable: Record<string, TimetableGroupV2Json[]> = {};
  const timetableByPattern = new Map<string, PatternTimetableEntry[]>();
  for (const source of sources) {
    for (const [stopId, groups] of Object.entries(source.data.timetable.data)) {
      if (timetable[stopId]) {
        timetable[stopId].push(...groups);
      } else {
        timetable[stopId] = [...groups];
      }

      for (const group of groups) {
        let patternEntries = timetableByPattern.get(group.tp);
        if (!patternEntries) {
          patternEntries = [];
          timetableByPattern.set(group.tp, patternEntries);
        }
        patternEntries.push({ stopId, group });
      }
    }
  }

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
        stopCount: source.data.stops.data.filter((s) => s.l === 0).length,
        routeCount: source.data.routes.data.length,
      },
    });
  }

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
    timetableByPattern,
    calendarServices,
    calendarExceptions,
    stopRouteTypeMap,
    translationsMap,
    headsignTranslations,
    lookup,
    sourceMetas,
  };
}
