import type {
  CalendarExceptionJson,
  CalendarServiceJson,
  TranslationsJson,
} from '../../types/data/transit-json';
import type {
  LookupV2Json,
  ServiceGroupEntry,
  TimetableGroupV2Json,
} from '../../types/data/transit-v2-json';
import type { Agency, AppRouteTypeValue, Route, Stop } from '../../types/app/transit';
import type { SourceMeta, StopWithMeta, TripPattern } from '../../types/app/transit-composed';

/** Result of loading sources, including error information. */
export interface LoadResult {
  /** Prefixes that loaded successfully. */
  loaded: string[];
  /** Prefixes that failed to load, with their errors. */
  failed: { prefix: string; error: Error }[];
}

/** Stop-keyed timetable rows regrouped by trip pattern for snapshot lookup. */
export interface PatternTimetableEntry {
  stopId: string;
  group: TimetableGroupV2Json;
}

/** Per-source headsign translations, keyed by source prefix. */
export type HeadsignTranslationsByPrefix = Map<
  string,
  {
    trip_headsigns: Record<string, Record<string, string>>;
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
  timetable: Record<string, TimetableGroupV2Json[]>;
  timetableByPattern: Map<string, PatternTimetableEntry[]>;
  calendarServices: CalendarServiceJson[];
  calendarExceptions: Map<string, CalendarExceptionJson[]>;
  stopRouteTypeMap: Map<string, AppRouteTypeValue[]>;
  translationsMap: TranslationsJson;
  headsignTranslations: HeadsignTranslationsByPrefix;
  lookup: LookupV2Json;
  sourceMetas: SourceMeta[];
}

export interface StopInsightsEntry {
  groups: ServiceGroupEntry[];
  stats: Partial<Record<string, NonNullable<StopWithMeta['stats']>>>;
}

export interface RouteFreqEntry {
  groups: ServiceGroupEntry[];
  freqs: Partial<Record<string, number>>;
}

export interface PatternStatsEntry {
  groups: ServiceGroupEntry[];
  rds: Partial<Record<string, number[]>>;
  freqs: Partial<Record<string, number>>;
}
