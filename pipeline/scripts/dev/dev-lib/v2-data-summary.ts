/**
 * Pure helpers for summarising per-source v2 DataBundle artifacts.
 *
 * Produces three kinds of basic facts per source:
 *
 *   1. Raw file sizes (data.json / insights.json / shapes.json)
 *   2. gzip-compressed sizes (proxy for transfer cost)
 *   3. Counts derived from DataBundle (entity volume)
 *
 * File-size sections cover all three v2 bundle files (data / insights /
 * shapes) for cross-bundle comparison, even though this module's
 * `counts` section is DataBundle-only. The CLI orchestrator can mix
 * these sections with sections from other bundle-summary libs.
 *
 * The CLI wrapper is responsible for locating sources, reading files,
 * measuring sizes, and gzip-compressing buffers. The functions here
 * are pure and deterministic.
 */

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import { type AnalysisSectionDefinition } from './analysis-sections';
import { renderTable } from './render-utils';

/**
 * Sizes of the three v2 bundle files for one source.
 *
 * `shapes` is nullable because some sources do not emit a shapes file
 * (no GTFS shapes.txt and no KSJ railway fallback). Treating a missing
 * file as `null` keeps `0` reserved for "file exists but is empty" —
 * the two states are not equivalent for the data-licensing or
 * pipeline-output audit perspective.
 */
export interface FileSizeStats {
  data: number;
  insights: number;
  shapes: number | null;
  total: number;
}

/**
 * Counts per DataBundle top-level section.
 *
 * One entry per key in the DataBundle interface, excluding metadata
 * keys (`bundle_version`, `kind`). The count rule is intentionally
 * naive so the section stays generic across schema changes:
 *
 *   - if `.data` is an array → array length
 *   - if `.data` is a plain object (record or struct) → top-level key count
 *
 * This means semantically heterogeneous values appear together:
 * `stops` (array of stops) reads as "number of stops", while
 * `calendar` (struct with `services` / `exceptions` arrays) reads as
 * `2` (= number of top-level keys in CalendarJson). Sections whose
 * top-level count is mechanically derived (`calendar` / `feedInfo` /
 * `translations` / `lookup`) are kept for completeness — see the
 * separate non-count section for richer breakdowns.
 *
 * Keyed as `Record<string, number>` rather than a fixed struct so
 * adding a new DataBundle key automatically produces a new column.
 */
export type DataBundleCounts = Record<string, number>;

const EXCLUDED_DATA_BUNDLE_KEYS = new Set(['bundle_version', 'kind']);

/**
 * Feed identity + declared validity, drawn strictly from feedInfo.
 *
 * `feedStart` / `feedEnd` are the raw `feedInfo.data.s` / `.e`
 * strings ("YYYYMMDD"; empty when the source omits them). Period
 * information aggregated across feedInfo + calendar lives in a
 * separate section ({@link PeriodsSummary}) so that `feed-info`
 * stays scoped to a single source-of-truth (FeedInfoJson).
 *
 * `feedInfo.pu` (publisher URL) and `feedInfo.v` (feed version) are
 * deliberately omitted. They are useful in a detail view but add
 * width without aiding "is this the right source?" identification
 * in a per-row summary.
 */
export interface FeedInfoSummary {
  publisher: string;
  lang: string;
  feedStart: string;
  feedEnd: string;
}

/**
 * Agency identity per source.
 *
 * `names` joins every agency name with `", "` (in source order).
 * `timezones` deduplicates first because real-world feeds typically
 * share a single timezone across all agencies in a single feed;
 * carrying duplicates would add noise without insight. Multi-agency
 * sources (e.g. ntbus has five agencies) therefore render as a
 * long `names` string but a short `timezones` string.
 */
export interface AgenciesSummary {
  count: number;
  names: string;
  timezones: string;
}

/**
 * Stops summary per source — every per-stop attribute lives here.
 *
 * Single section because every field is unambiguously a property of
 * one stop (location_type, lat/lon, wheelchair_boarding). Splitting
 * into geography / accessibility sub sections was considered but
 * rejected: an `accessibility` section is awkward in GTFS because
 * `wheelchair_boarding` exists on both stops and trips, so a unified
 * "accessibility" view would have to span sources.
 *
 * `locationTypeCounts` is keyed by the stringified `l` value
 * (matching the routes section's convention).
 *
 * `bbox` is `null` when the source has no stops; otherwise the four
 * numeric extents of `a` (lat) and `o` (lon). Two-decimal display
 * granularity (~1 km) is applied at render time only.
 *
 * `wheelchairAccessibleCount` is the number of stops whose
 * `wheelchair_boarding === 1` — confirmed wheelchair accessible.
 * Values of 0 / 2 / undefined are excluded from this count; readers
 * who care about the "no info" vs "not accessible" split can drop
 * to `analyze-v2-*` for distributions.
 *
 * `withParentCount` is the number of stops carrying a `ps`
 * (parent_station) reference — a proxy for how richly the source
 * models station / platform hierarchy. l=2 (entrance), l=3 (node),
 * l=4 (boarding area) always need `ps` per GTFS spec; l=0
 * (stop/platform) optionally references its parent station.
 *
 * The remaining three are coverage counts for optional supplementary
 * fields. `withPlatformCodeCount` counts stops carrying a `pc`
 * (platform_code). `withStopDescCount` / `withStopUrlCount` count
 * entries in the DataBundle `lookup` section's `stopDescs` /
 * `stopUrls` maps — these GTFS fields are normalized into `lookup`
 * for de-duplication, but each entry is keyed by stop_id so the
 * entry count equals the number of stops carrying that field.
 */
export interface StopsSummary {
  count: number;
  locationTypeCounts: Record<string, number>;
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null;
  wheelchairAccessibleCount: number;
  withParentCount: number;
  withPlatformCodeCount: number;
  withStopDescCount: number;
  withStopUrlCount: number;
}

/**
 * Routes summary per source.
 *
 * Drives the multi-subsection `routes` section: route_type mix,
 * naming coverage, color coverage, and description coverage, plus a
 * compact roll-up.
 *
 * `typeCounts` is a raw map keyed by GTFS `route_type` value (as
 * string); the formatter applies a human-readable label per type.
 * The `with*` counters count routes carrying a non-empty value for
 * the corresponding RouteV2Json field (`s`, `l`, `c`, `tc`, `desc`).
 */
export interface RoutesSummary {
  count: number;
  typeCounts: Record<string, number>;
  withShortName: number;
  withLongName: number;
  withColor: number;
  withTextColor: number;
  withDesc: number;
}

/**
 * Trip patterns summary per source.
 *
 * `tripPatterns` is an Athenai-internal abstraction (not a GTFS
 * concept): one record per unique route + headsign + direction +
 * ordered stop-sequence combination. Multiple GTFS trips collapse
 * into one pattern when they follow the same stops in the same order.
 *
 * `count` is the number of patterns.
 *
 * `direction0Count` / `direction1Count` / `directionNoneCount` split
 * patterns by `TripPatternJson.dir` (GTFS direction_id). `dir` is
 * `0 | 1 | undefined`; `undefined` (counted as `none`) means the
 * source does not provide direction_id — ODPT sources omit it
 * entirely, so they read as all-`none`.
 *
 * GTFS exposes a headsign at two levels, so both are counted:
 *   - `withTripHeadsignCount` — patterns whose trip-level headsign
 *     (`h`) is a non-empty string.
 *   - `withStopHeadsignCount` — patterns where at least one stop in
 *     the sequence carries a `stop_headsign` (`stops[].sh`). This is
 *     a pattern-level presence flag — the 1:n stop axis is collapsed
 *     with `some()`; per-stop coverage detail is left to `analyze-*`.
 *
 * The two together reveal a source's headsign convention: some
 * sources populate only `h`, some (e.g. keio-bus) leave `h` blank
 * and rely entirely on `sh`, and some populate both.
 */
export interface TripPatternsSummary {
  count: number;
  direction0Count: number;
  direction1Count: number;
  directionNoneCount: number;
  withTripHeadsignCount: number;
  withStopHeadsignCount: number;
}

/**
 * Translations coverage per source.
 *
 * Mirrors the six maps of {@link TranslationsJson} one-to-one so the
 * counts stay legible without aggregation across categories that
 * could otherwise mask zero-coverage segments.
 *
 * `languages` is the sorted union of every BCP-47 code observed
 * inside any of the six maps' value records (e.g. ["en", "ja"]).
 * Sources with no translations at all yield an empty array and zero
 * counts.
 */
export interface I18nCoverageSummary {
  languages: string[];
  agencyNames: number;
  routeLongNames: number;
  routeShortNames: number;
  stopNames: number;
  tripHeadsigns: number;
  stopHeadsigns: number;
}

/**
 * Consolidated period information across feedInfo and calendar.
 *
 * Brings three period axes onto one row for cross-comparison:
 *
 *   - `feedStart` / `feedEnd`        ← feedInfo.s / .e (declared)
 *   - `serviceStart` / `serviceEnd`  ← min/max of calendar.services s/e
 *   - `exceptionStart` / `exceptionEnd` ← min/max of calendar.exceptions[].d
 *
 * `feedValidity` is **also** rendered in the per-source `feed-info`
 * section (as feed-level metadata identity); the redundancy is
 * intentional. Reading them side-by-side reveals real-world
 * misalignment: feed validity stale relative to calendar, services
 * empty but exceptions populated (od9bus), or the inverse (vagfr,
 * where feedInfo is absent but calendar exists).
 *
 * `null` entries mean the corresponding section is empty in the
 * DataBundle (e.g. od9bus has no services, so serviceStart/End =
 * null).
 */
export interface PeriodsSummary {
  feedStart: string;
  feedEnd: string;
  serviceStart: string | null;
  serviceEnd: string | null;
  exceptionStart: string | null;
  exceptionEnd: string | null;
}

export interface V2DataVolumeStats {
  prefix: string;
  nameEn: string;
  fileSizes: FileSizeStats;
  gzipSizes: FileSizeStats;
  counts: DataBundleCounts;
  feedInfo: FeedInfoSummary;
  agencies: AgenciesSummary;
  routes: RoutesSummary;
  stops: StopsSummary;
  tripPatterns: TripPatternsSummary;
  i18nCoverage: I18nCoverageSummary;
  periods: PeriodsSummary;
}

export interface AnalyzeV2DataVolumeInput {
  prefix: string;
  nameEn: string;
  dataBundle: DataBundle;
  fileSizes: FileSizeStats;
  gzipSizes: FileSizeStats;
}

export type V2DataVolumeSectionName =
  | 'counts'
  | 'feed-info'
  | 'agencies'
  | 'routes'
  | 'stops'
  | 'trip-patterns'
  | 'i18n-coverage'
  | 'periods'
  | 'file-sizes'
  | 'gzip-sizes';

export type V2DataVolumeSectionDefinition = AnalysisSectionDefinition<
  V2DataVolumeStats[],
  V2DataVolumeSectionName
>;

const KIB = 1024;
const MIB = 1024 * 1024;

/**
 * Naive section-count rule used uniformly across every DataBundle key.
 *
 * Returns:
 *   - `data.length` when `.data` is an array
 *   - `Object.keys(.data).length` when `.data` is a plain object
 *   - `0` otherwise (defensive)
 *
 * The lack of recursion is intentional. This keeps the rule legible
 * (one number per section), schema-resilient (any new key is counted
 * the same way), and consistent (no per-section special-casing).
 */
function countSection(section: unknown): number {
  if (typeof section !== 'object' || section === null) {
    return 0;
  }
  const data = (section as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data.length;
  }
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data as Record<string, unknown>).length;
  }
  return 0;
}

/**
 * Build counts for every DataBundle top-level section, skipping
 * metadata keys (`bundle_version`, `kind`). Section order follows
 * `Object.entries(bundle)` (= declaration order in serialised JSON),
 * which propagates through to the rendered column order.
 */
function buildDataBundleCounts(bundle: DataBundle): DataBundleCounts {
  const result: DataBundleCounts = {};
  for (const [key, value] of Object.entries(bundle)) {
    if (EXCLUDED_DATA_BUNDLE_KEYS.has(key)) {
      continue;
    }
    result[key] = countSection(value);
  }
  return result;
}

/**
 * Build a FeedInfoSummary from a DataBundle.
 *
 * Carries empty `feedInfo` fields through as empty strings so the
 * renderer can replace them with the dash sentinel uniformly.
 */
function buildFeedInfoSummary(bundle: DataBundle): FeedInfoSummary {
  const fi = bundle.feedInfo.data;
  return {
    publisher: fi.pn,
    lang: fi.l,
    feedStart: fi.s,
    feedEnd: fi.e,
  };
}

/**
 * Collect the sorted union of language codes seen inside any of the
 * six translation maps.
 *
 * Each map's value is `Record<lang, translation>`, so the keys of
 * the inner record give the languages used for that entry. Empty
 * maps contribute nothing; an entirely empty TranslationsJson
 * yields an empty array.
 */
function extractTranslationLanguages(translations: DataBundle['translations']['data']): string[] {
  const langs = new Set<string>();
  const collect = (map: Record<string, Record<string, string>>) => {
    for (const langMap of Object.values(map)) {
      for (const lang of Object.keys(langMap)) {
        langs.add(lang);
      }
    }
  };
  collect(translations.agency_names);
  collect(translations.route_long_names);
  collect(translations.route_short_names);
  collect(translations.stop_names);
  collect(translations.trip_headsigns);
  collect(translations.stop_headsigns);
  return Array.from(langs).sort();
}

/**
 * Build an I18nCoverageSummary from a DataBundle.
 *
 * Counts are raw entry counts of each TranslationsJson map (= number
 * of primary keys, not number of translated languages). Sources
 * with no translations still produce a structurally valid summary
 * (all-zero counts, empty languages array).
 */
/**
 * Build a StopsSummary from a DataBundle.
 *
 * One pass through the stops array collects every aggregate to keep
 * cost linear in the stop count. Empty arrays produce zero counts,
 * an empty distribution, and a `null` bbox.
 */
function buildStopsSummary(bundle: DataBundle): StopsSummary {
  const stops = bundle.stops.data;
  const locationTypeCounts: Record<string, number> = {};
  let latMin = Number.POSITIVE_INFINITY;
  let latMax = Number.NEGATIVE_INFINITY;
  let lonMin = Number.POSITIVE_INFINITY;
  let lonMax = Number.NEGATIVE_INFINITY;
  let wheelchairAccessibleCount = 0;
  let withParentCount = 0;
  let withPlatformCodeCount = 0;
  for (const stop of stops) {
    const key = String(stop.l);
    locationTypeCounts[key] = (locationTypeCounts[key] ?? 0) + 1;
    if (stop.a < latMin) {
      latMin = stop.a;
    }
    if (stop.a > latMax) {
      latMax = stop.a;
    }
    if (stop.o < lonMin) {
      lonMin = stop.o;
    }
    if (stop.o > lonMax) {
      lonMax = stop.o;
    }
    if (stop.wb === 1) {
      wheelchairAccessibleCount += 1;
    }
    if (stop.ps !== undefined) {
      withParentCount += 1;
    }
    if (stop.pc !== undefined) {
      withPlatformCodeCount += 1;
    }
  }
  // stop_desc / stop_url are normalized into the `lookup` section
  // (keyed by stop_id) for de-duplication; the entry count equals
  // the number of stops carrying each field.
  const lookup = bundle.lookup.data;
  const withStopDescCount =
    lookup.stopDescs === undefined ? 0 : Object.keys(lookup.stopDescs).length;
  const withStopUrlCount = lookup.stopUrls === undefined ? 0 : Object.keys(lookup.stopUrls).length;
  return {
    count: stops.length,
    locationTypeCounts,
    bbox: stops.length === 0 ? null : { latMin, latMax, lonMin, lonMax },
    wheelchairAccessibleCount,
    withParentCount,
    withPlatformCodeCount,
    withStopDescCount,
    withStopUrlCount,
  };
}

/**
 * Build a RoutesSummary from a DataBundle.
 *
 * `typeCounts` is keyed by the stringified GTFS route_type value
 * (matching analyse-gtfs-routes.ts' convention). Empty `c` strings
 * count as no-color (= not included in `withColor`).
 */
function buildRoutesSummary(bundle: DataBundle): RoutesSummary {
  const routes = bundle.routes.data;
  const typeCounts: Record<string, number> = {};
  let withShortName = 0;
  let withLongName = 0;
  let withColor = 0;
  let withTextColor = 0;
  let withDesc = 0;
  for (const route of routes) {
    const key = String(route.t);
    typeCounts[key] = (typeCounts[key] ?? 0) + 1;
    if (route.s !== '') {
      withShortName += 1;
    }
    if (route.l !== '') {
      withLongName += 1;
    }
    if (route.c !== '') {
      withColor += 1;
    }
    if (route.tc !== '') {
      withTextColor += 1;
    }
    if (route.desc !== undefined && route.desc !== '') {
      withDesc += 1;
    }
  }
  return {
    count: routes.length,
    typeCounts,
    withShortName,
    withLongName,
    withColor,
    withTextColor,
    withDesc,
  };
}

/**
 * Build a TripPatternsSummary from a DataBundle.
 *
 * One pass over the `tripPatterns` records collects the direction_id
 * split and the headsign coverage count. `dir` is `0 | 1 | undefined`;
 * anything other than `0` / `1` (i.e. omitted) falls into
 * `directionNoneCount`.
 */
function buildTripPatternsSummary(bundle: DataBundle): TripPatternsSummary {
  const patterns = Object.values(bundle.tripPatterns.data);
  let direction0Count = 0;
  let direction1Count = 0;
  let directionNoneCount = 0;
  let withTripHeadsignCount = 0;
  let withStopHeadsignCount = 0;
  for (const pattern of patterns) {
    if (pattern.dir === 0) {
      direction0Count += 1;
    } else if (pattern.dir === 1) {
      direction1Count += 1;
    } else {
      directionNoneCount += 1;
    }
    if (pattern.h !== '') {
      withTripHeadsignCount += 1;
    }
    // `sh` is omitted (undefined) when absent; per the v2 schema it
    // is never an empty string, so an undefined check suffices.
    if (pattern.stops.some((stop) => stop.sh !== undefined)) {
      withStopHeadsignCount += 1;
    }
  }
  return {
    count: patterns.length,
    direction0Count,
    direction1Count,
    directionNoneCount,
    withTripHeadsignCount,
    withStopHeadsignCount,
  };
}

function buildI18nCoverageSummary(bundle: DataBundle): I18nCoverageSummary {
  const t = bundle.translations.data;
  return {
    languages: extractTranslationLanguages(t),
    agencyNames: Object.keys(t.agency_names).length,
    routeLongNames: Object.keys(t.route_long_names).length,
    routeShortNames: Object.keys(t.route_short_names).length,
    stopNames: Object.keys(t.stop_names).length,
    tripHeadsigns: Object.keys(t.trip_headsigns).length,
    stopHeadsigns: Object.keys(t.stop_headsigns).length,
  };
}

/**
 * Build an AgenciesSummary from a DataBundle.
 *
 * Joins names in source order; deduplicates timezones (real-world
 * feeds typically share one timezone across all agencies).
 */
function buildAgenciesSummary(bundle: DataBundle): AgenciesSummary {
  const agencies = bundle.agency.data;
  const names = agencies.map((a) => a.n).filter((n) => n !== '');
  const uniqueTimezones: string[] = [];
  for (const a of agencies) {
    if (a.tz !== '' && !uniqueTimezones.includes(a.tz)) {
      uniqueTimezones.push(a.tz);
    }
  }
  return {
    count: agencies.length,
    names: names.join(', '),
    timezones: uniqueTimezones.join(', '),
  };
}

/**
 * Find the min/max of a date axis across an array of GTFS-style
 * "YYYYMMDD" strings.
 *
 * Empty input yields `[null, null]` — distinguishable from a
 * present-but-empty zero date.
 */
function dateRange(dates: readonly string[]): [string | null, string | null] {
  let min: string | null = null;
  let max: string | null = null;
  for (const d of dates) {
    if (min === null || d < min) {
      min = d;
    }
    if (max === null || d > max) {
      max = d;
    }
  }
  return [min, max];
}

/**
 * Build a PeriodsSummary from a DataBundle.
 *
 * `feedStart` / `feedEnd` are echoed straight from feedInfo for
 * cross-comparison with the calendar-derived ranges. Empty calendar
 * arrays produce `null` for the corresponding range (no aggregation
 * fallback — empty means empty).
 */
function buildPeriodsSummary(bundle: DataBundle): PeriodsSummary {
  const fi = bundle.feedInfo.data;
  const services = bundle.calendar.data.services;
  const exceptions = bundle.calendar.data.exceptions;
  const [serviceStart, serviceEnd] = dateRange(services.flatMap((s) => [s.s, s.e]));
  const [exceptionStart, exceptionEnd] = dateRange(exceptions.map((e) => e.d));
  return {
    feedStart: fi.s,
    feedEnd: fi.e,
    serviceStart,
    serviceEnd,
    exceptionStart,
    exceptionEnd,
  };
}

export function analyzeV2DataVolume(input: AnalyzeV2DataVolumeInput): V2DataVolumeStats {
  return {
    prefix: input.prefix,
    nameEn: input.nameEn,
    fileSizes: input.fileSizes,
    gzipSizes: input.gzipSizes,
    counts: buildDataBundleCounts(input.dataBundle),
    feedInfo: buildFeedInfoSummary(input.dataBundle),
    agencies: buildAgenciesSummary(input.dataBundle),
    routes: buildRoutesSummary(input.dataBundle),
    stops: buildStopsSummary(input.dataBundle),
    tripPatterns: buildTripPatternsSummary(input.dataBundle),
    i18nCoverage: buildI18nCoverageSummary(input.dataBundle),
    periods: buildPeriodsSummary(input.dataBundle),
  };
}

function sumNumber(
  results: V2DataVolumeStats[],
  select: (result: V2DataVolumeStats) => number,
): number {
  return results.reduce((acc, result) => acc + select(result), 0);
}

function sumNullableNumber(
  results: V2DataVolumeStats[],
  select: (result: V2DataVolumeStats) => number | null,
): number {
  return results.reduce((acc, result) => {
    const value = select(result);
    return acc + (value ?? 0);
  }, 0);
}

/**
 * Format a byte count as a human-readable string with an adaptive unit.
 *
 * Uses KB/MB rather than KiB/MiB despite the 1024-based divisor to
 * match the conventions used by browser DevTools and most release
 * notes. The unit boundaries (>=1 MiB → MB, >=1 KiB → KB, else B)
 * keep small files readable instead of collapsing to "0.00 MB".
 *
 * Returns `'-'` for `null` to distinguish "file does not exist" from
 * a zero-byte file (which is rendered as `'0 B'`).
 */
export function formatBytes(value: number | null): string {
  if (value === null) {
    return '-';
  }
  if (value >= MIB) {
    return `${(value / MIB).toFixed(2)} MB`;
  }
  if (value >= KIB) {
    return `${(value / KIB).toFixed(1)} KB`;
  }
  return `${value} B`;
}

export function formatCompressionRatio(rawTotal: number, gzipTotal: number): string {
  if (rawTotal === 0) {
    return '-';
  }
  const ratio = gzipTotal / rawTotal;
  return `${(ratio * 100).toFixed(1)}%`;
}

function renderFileSizeRows(
  results: V2DataVolumeStats[],
  pick: (result: V2DataVolumeStats) => FileSizeStats,
): string {
  const header = ['source', 'prefix', 'data', 'insights', 'shapes', 'total'];
  const rows = results.map((result) => {
    const sizes = pick(result);
    return [
      result.nameEn,
      result.prefix,
      formatBytes(sizes.data),
      formatBytes(sizes.insights),
      formatBytes(sizes.shapes),
      formatBytes(sizes.total),
    ];
  });
  const totalData = sumNumber(results, (result) => pick(result).data);
  const totalInsights = sumNumber(results, (result) => pick(result).insights);
  const totalShapes = sumNullableNumber(results, (result) => pick(result).shapes);
  const totalAll = sumNumber(results, (result) => pick(result).total);
  rows.push([
    'totals',
    '',
    formatBytes(totalData),
    formatBytes(totalInsights),
    formatBytes(totalShapes),
    formatBytes(totalAll),
  ]);
  return renderTable(header, rows, 2);
}

function formatFileSizesSectionBody(results: V2DataVolumeStats[]): string {
  const totalRaw = sumNumber(results, (result) => result.fileSizes.total);
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, totalRaw=${formatBytes(totalRaw)}`,
    '',
    '### Summary',
    '',
    renderFileSizeRows(results, (result) => result.fileSizes),
  ];
  return lines.join('\n');
}

function formatGzipSizesSectionBody(results: V2DataVolumeStats[]): string {
  const totalRaw = sumNumber(results, (result) => result.fileSizes.total);
  const totalGzip = sumNumber(results, (result) => result.gzipSizes.total);
  const ratio = formatCompressionRatio(totalRaw, totalGzip);
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, totalRaw=${formatBytes(totalRaw)}, totalGzip=${formatBytes(totalGzip)}, ratio=${ratio}`,
    '',
    '### Summary',
    '',
    renderFileSizeRows(results, (result) => result.gzipSizes),
  ];
  return lines.join('\n');
}

/**
 * Collect the union of DataBundle section keys seen across `results`.
 *
 * In practice every source emits the same set of keys (the DataBundle
 * interface is fixed) so the union equals the keys of any single row.
 * Building it as a union still lets the formatter cope gracefully if
 * sources from incompatible schema versions are ever passed in.
 *
 * Order follows the first occurrence in `results[*].counts`, which
 * itself follows the JSON serialisation order (= DataBundle interface
 * declaration order). New keys flow through automatically.
 */
function collectDataBundleKeys(results: V2DataVolumeStats[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const result of results) {
    for (const key of Object.keys(result.counts)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

function formatCountsSectionBody(results: V2DataVolumeStats[]): string {
  const dataBundleKeys = collectDataBundleKeys(results);
  const header = ['source', 'prefix', ...dataBundleKeys];
  const rows: string[][] = results.map((result) => [
    result.nameEn,
    result.prefix,
    ...dataBundleKeys.map((key) => String(result.counts[key] ?? 0)),
  ]);
  rows.push([
    'totals',
    '',
    ...dataBundleKeys.map((key) => String(sumNumber(results, (r) => r.counts[key] ?? 0))),
  ]);
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sections=${dataBundleKeys.length}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, 2),
  ];
  return lines.join('\n');
}

/**
 * Format a GTFS-style "YYYYMMDD" string as "YYYY-MM-DD".
 *
 * Returns `-` for an empty / nullish / malformed input. The dash
 * keeps absent-vs-zero distinguishable in the same render pipeline as
 * the byte / count formatters elsewhere in this module.
 */
function formatGtfsDate(date: string | null | undefined): string {
  if (date === null || date === undefined || date.length !== 8) {
    return '-';
  }
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  const formattedStart = formatGtfsDate(start);
  const formattedEnd = formatGtfsDate(end);
  if (formattedStart === '-' && formattedEnd === '-') {
    return '-';
  }
  return `${formattedStart} → ${formattedEnd}`;
}

function formatFeedInfoSectionBody(results: V2DataVolumeStats[]): string {
  const header = ['source', 'prefix', 'publisher', 'lang', 'feedValidity'];
  const rows: string[][] = results.map((result) => {
    const fi = result.feedInfo;
    return [
      result.nameEn,
      result.prefix,
      fi.publisher === '' ? '-' : fi.publisher,
      fi.lang === '' ? '-' : fi.lang,
      formatDateRange(
        fi.feedStart === '' ? null : fi.feedStart,
        fi.feedEnd === '' ? null : fi.feedEnd,
      ),
    ];
  });
  // Totals row marker for visual consistency with the other sections;
  // string fields are not summable, so every data cell is rendered as '-'.
  rows.push(['totals', '', '-', '-', '-']);
  const missingFeed = results.filter(
    (r) => r.feedInfo.feedStart === '' && r.feedInfo.feedEnd === '',
  ).length;
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sourcesMissingFeedValidity=${missingFeed}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, header.length),
  ];
  return lines.join('\n');
}

/**
 * Human label for GTFS stops.txt `location_type` values.
 *
 * Mirrors the GTFS spec; unknown values fall back to the raw code
 * via the formatter.
 */
const LOCATION_TYPE_LABELS: Record<string, string> = {
  '0': 'stop',
  '1': 'station',
  '2': 'entrance',
  '3': 'node',
  '4': 'boardingArea',
};

function formatLocationTypeCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right));
  if (entries.length === 0) {
    return '-';
  }
  return entries
    .map(([value, count]) => {
      const label = LOCATION_TYPE_LABELS[value];
      return label === undefined ? `${value}:${count}` : `${label}:${count}`;
    })
    .join(', ');
}

/**
 * Format a numeric coordinate range with 2-decimal precision.
 *
 * 2 decimals (~1 km granularity) is a deliberate trade-off: it fits
 * comfortably in the table while still revealing source extents.
 * Readers who need sub-km precision can drop to `analyze-v2-*` or
 * read the bundle directly.
 */
function formatCoordRange(min: number, max: number): string {
  return `${min.toFixed(2)}..${max.toFixed(2)}`;
}

/**
 * Render the `stops` section as detail sub-sections + a roll-up
 * Summary.
 *
 * Sub-section structure (per the "Section = sub-sections + Summary"
 * design intent): each facet of StopV2Json gets its own light table.
 * Location types and geography form the roll-up Summary (the "how
 * many and where" view); the sparser accessibility / hierarchy facets
 * and the optional supplementary fields (platform_code / stop_desc /
 * stop_url) stay in their own detail sub-sections.
 */
function formatStopsSectionBody(results: V2DataVolumeStats[]): string {
  const totalStops = results.reduce((acc, r) => acc + r.stops.count, 0);
  const totalWheelchairAccessible = results.reduce(
    (acc, r) => acc + r.stops.wheelchairAccessibleCount,
    0,
  );
  const totalWithParent = results.reduce((acc, r) => acc + r.stops.withParentCount, 0);
  const totalWithPlatformCode = results.reduce((acc, r) => acc + r.stops.withPlatformCodeCount, 0);
  const totalWithStopDesc = results.reduce((acc, r) => acc + r.stops.withStopDescCount, 0);
  const totalWithStopUrl = results.reduce((acc, r) => acc + r.stops.withStopUrlCount, 0);
  const aggregatedTypes: Record<string, number> = {};
  const distinctTypes = new Set<string>();
  for (const r of results) {
    for (const [key, count] of Object.entries(r.stops.locationTypeCounts)) {
      aggregatedTypes[key] = (aggregatedTypes[key] ?? 0) + count;
      distinctTypes.add(key);
    }
  }
  // Cross-source bbox: union of all per-source bboxes (= overall geographic extent).
  let unionLatMin = Number.POSITIVE_INFINITY;
  let unionLatMax = Number.NEGATIVE_INFINITY;
  let unionLonMin = Number.POSITIVE_INFINITY;
  let unionLonMax = Number.NEGATIVE_INFINITY;
  let hasAnyBbox = false;
  for (const r of results) {
    if (r.stops.bbox === null) {
      continue;
    }
    hasAnyBbox = true;
    if (r.stops.bbox.latMin < unionLatMin) {
      unionLatMin = r.stops.bbox.latMin;
    }
    if (r.stops.bbox.latMax > unionLatMax) {
      unionLatMax = r.stops.bbox.latMax;
    }
    if (r.stops.bbox.lonMin < unionLonMin) {
      unionLonMin = r.stops.bbox.lonMin;
    }
    if (r.stops.bbox.lonMax > unionLonMax) {
      unionLonMax = r.stops.bbox.lonMax;
    }
  }
  const unionLatRange = hasAnyBbox ? formatCoordRange(unionLatMin, unionLatMax) : '-';
  const unionLonRange = hasAnyBbox ? formatCoordRange(unionLonMin, unionLonMax) : '-';
  const latRangeOf = (s: StopsSummary): string =>
    s.bbox === null ? '-' : formatCoordRange(s.bbox.latMin, s.bbox.latMax);
  const lonRangeOf = (s: StopsSummary): string =>
    s.bbox === null ? '-' : formatCoordRange(s.bbox.lonMin, s.bbox.lonMax);

  // --- Location types sub-section ---
  const typesHeader = ['source', 'prefix', 'count', 'locationTypes'];
  const typesRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.stops.count),
    formatLocationTypeCounts(r.stops.locationTypeCounts),
  ]);
  typesRows.push(['totals', '', String(totalStops), formatLocationTypeCounts(aggregatedTypes)]);

  // --- Geography sub-section ---
  const geoHeader = ['source', 'prefix', 'latRange', 'lonRange'];
  const geoRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    latRangeOf(r.stops),
    lonRangeOf(r.stops),
  ]);
  geoRows.push(['totals', '', unionLatRange, unionLonRange]);

  // --- Accessibility sub-section ---
  const accessibilityHeader = ['source', 'prefix', 'wheelchairAccessible'];
  const accessibilityRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.stops.wheelchairAccessibleCount),
  ]);
  accessibilityRows.push(['totals', '', String(totalWheelchairAccessible)]);

  // --- Hierarchy sub-section ---
  const hierarchyHeader = ['source', 'prefix', 'withParent'];
  const hierarchyRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.stops.withParentCount),
  ]);
  hierarchyRows.push(['totals', '', String(totalWithParent)]);

  // --- Supplementary fields sub-section ---
  // Coverage counts for optional GTFS fields: platform_code (on the
  // stop record) and stop_desc / stop_url (normalized into `lookup`).
  const supplementaryHeader = [
    'source',
    'prefix',
    'withPlatformCode',
    'withStopDesc',
    'withStopUrl',
  ];
  const supplementaryRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.stops.withPlatformCodeCount),
    String(r.stops.withStopDescCount),
    String(r.stops.withStopUrlCount),
  ]);
  supplementaryRows.push([
    'totals',
    '',
    String(totalWithPlatformCode),
    String(totalWithStopDesc),
    String(totalWithStopUrl),
  ]);

  // --- Summary sub-section (roll-up) ---
  const summaryHeader = ['source', 'prefix', 'count', 'locationTypes', 'latRange', 'lonRange'];
  const summaryRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.stops.count),
    formatLocationTypeCounts(r.stops.locationTypeCounts),
    latRangeOf(r.stops),
    lonRangeOf(r.stops),
  ]);
  summaryRows.push([
    'totals',
    '',
    String(totalStops),
    formatLocationTypeCounts(aggregatedTypes),
    unionLatRange,
    unionLonRange,
  ]);

  // Section layout: Totals → Summary (the roll-up, shown first so the
  // reader gets the whole picture) → detail sub-sections.
  return [
    '### Totals',
    '',
    `sources=${results.length}, totalStops=${totalStops}, distinctLocationTypes=${distinctTypes.size}, totalWheelchairAccessible=${totalWheelchairAccessible}, totalWithParent=${totalWithParent}`,
    '',
    '### Summary',
    '',
    renderTable(summaryHeader, summaryRows, summaryHeader.length),
    '',
    '### Location types',
    '',
    renderTable(typesHeader, typesRows, typesHeader.length),
    '',
    '### Hierarchy',
    '',
    renderTable(hierarchyHeader, hierarchyRows, 2),
    '',
    '### Accessibility',
    '',
    renderTable(accessibilityHeader, accessibilityRows, 2),
    '',
    '### Supplementary fields',
    '',
    renderTable(supplementaryHeader, supplementaryRows, 2),
    '',
    '### Geography',
    '',
    renderTable(geoHeader, geoRows, geoHeader.length),
  ].join('\n');
}

/**
 * Render the `direction_id` split as a compact breakdown string
 * (`0:X, 1:Y, none:Z`), mirroring the location-type / route-type
 * breakdown convention. All three keys are always shown so the
 * column stays predictable and `none:0` vs `none:5` reads as a
 * meaningful "is direction_id complete?" signal.
 */
function formatDirectionCounts(s: TripPatternsSummary): string {
  return `0:${s.direction0Count}, 1:${s.direction1Count}, none:${s.directionNoneCount}`;
}

/**
 * Render the `trip-patterns` section as a single Summary table.
 *
 * `TripPatternJson` carries little summarisable data — just the
 * direction_id split and the two headsign-level presence counts.
 * That is four data columns, which fits one table comfortably, so
 * the section stays flat (Totals → Summary) rather than adopting the
 * sub-section structure that pays off only for facet-rich sections
 * (routes, stops). The route / stop-sequence facets are left out:
 * distinct route count duplicates the routes section, and per-pattern
 * stop counts are distribution-style analysis (see `analyze-*`).
 */
function formatTripPatternsSectionBody(results: V2DataVolumeStats[]): string {
  const totalPatterns = results.reduce((acc, r) => acc + r.tripPatterns.count, 0);
  const totalDirection0 = results.reduce((acc, r) => acc + r.tripPatterns.direction0Count, 0);
  const totalDirection1 = results.reduce((acc, r) => acc + r.tripPatterns.direction1Count, 0);
  const totalDirectionNone = results.reduce((acc, r) => acc + r.tripPatterns.directionNoneCount, 0);
  const totalWithTripHeadsign = results.reduce(
    (acc, r) => acc + r.tripPatterns.withTripHeadsignCount,
    0,
  );
  const totalWithStopHeadsign = results.reduce(
    (acc, r) => acc + r.tripPatterns.withStopHeadsignCount,
    0,
  );
  const totalsDirectionCounts = `0:${totalDirection0}, 1:${totalDirection1}, none:${totalDirectionNone}`;

  const header = [
    'source',
    'prefix',
    'count',
    'directionCounts',
    'withTripHeadsign',
    'withStopHeadsign',
  ];
  const rows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.tripPatterns.count),
    formatDirectionCounts(r.tripPatterns),
    String(r.tripPatterns.withTripHeadsignCount),
    String(r.tripPatterns.withStopHeadsignCount),
  ]);
  rows.push([
    'totals',
    '',
    String(totalPatterns),
    totalsDirectionCounts,
    String(totalWithTripHeadsign),
    String(totalWithStopHeadsign),
  ]);

  return [
    '### Totals',
    '',
    `sources=${results.length}, totalTripPatterns=${totalPatterns}`,
    '',
    '### Summary',
    '',
    // directionCounts is a wide text column → all columns left-aligned.
    renderTable(header, rows, header.length),
  ].join('\n');
}

/**
 * Human label for the standard GTFS route_type values.
 *
 * Duplicated from `gtfs-routes-analysis.ts` rather than imported to
 * keep each dev-lib module self-contained. Unknown values fall back
 * to the raw numeric code (no label suffix).
 */
const ROUTE_TYPE_LABELS: Record<string, string> = {
  '0': 'tram',
  '1': 'subway',
  '2': 'rail',
  '3': 'bus',
  '4': 'ferry',
  '5': 'cable-tram',
  '6': 'aerial-lift',
  '7': 'funicular',
  '11': 'trolleybus',
  '12': 'monorail',
};

function formatTypeCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right));
  if (entries.length === 0) {
    return '-';
  }
  return entries
    .map(([value, count]) => {
      const label = ROUTE_TYPE_LABELS[value];
      return label === undefined ? `${value}:${count}` : `${label}:${count}`;
    })
    .join(', ');
}

/**
 * Render the `routes` section as detail sub-sections + a roll-up
 * Summary.
 *
 * Sub-section structure (per the "Section = sub-sections + Summary"
 * design intent): each facet of RouteV2Json gets its own light table
 * (2-4 columns), deliberately coarser than `analyze-gtfs-routes.ts`
 * — combination breakdowns (shortOnly / both / samePair / distinct
 * colors) stay in the analyze tool; here each facet is just a
 * presence count.
 */
function formatRoutesSectionBody(results: V2DataVolumeStats[]): string {
  const totalRoutes = results.reduce((acc, r) => acc + r.routes.count, 0);
  const aggregatedTypes: Record<string, number> = {};
  const distinctTypes = new Set<string>();
  for (const r of results) {
    for (const [key, count] of Object.entries(r.routes.typeCounts)) {
      aggregatedTypes[key] = (aggregatedTypes[key] ?? 0) + count;
      distinctTypes.add(key);
    }
  }
  const sum = (pick: (routes: RoutesSummary) => number): number =>
    results.reduce((acc, r) => acc + pick(r.routes), 0);

  // --- Route types sub-section ---
  const typesHeader = ['source', 'prefix', 'count', 'types'];
  const typesRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.routes.count),
    formatTypeCounts(r.routes.typeCounts),
  ]);
  typesRows.push(['totals', '', String(totalRoutes), formatTypeCounts(aggregatedTypes)]);

  // --- Naming sub-section ---
  const namingHeader = ['source', 'prefix', 'withShortName', 'withLongName'];
  const namingRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.routes.withShortName),
    String(r.routes.withLongName),
  ]);
  namingRows.push([
    'totals',
    '',
    String(sum((routes) => routes.withShortName)),
    String(sum((routes) => routes.withLongName)),
  ]);

  // --- Colors sub-section ---
  const colorsHeader = ['source', 'prefix', 'withColor', 'withTextColor'];
  const colorsRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.routes.withColor),
    String(r.routes.withTextColor),
  ]);
  colorsRows.push([
    'totals',
    '',
    String(sum((routes) => routes.withColor)),
    String(sum((routes) => routes.withTextColor)),
  ]);

  // --- Description sub-section ---
  const descHeader = ['source', 'prefix', 'withDesc'];
  const descRows: string[][] = results.map((r) => [r.nameEn, r.prefix, String(r.routes.withDesc)]);
  descRows.push(['totals', '', String(sum((routes) => routes.withDesc))]);

  // --- Summary sub-section (roll-up) ---
  const summaryHeader = ['source', 'prefix', 'count', 'types', 'withColor'];
  const summaryRows: string[][] = results.map((r) => [
    r.nameEn,
    r.prefix,
    String(r.routes.count),
    formatTypeCounts(r.routes.typeCounts),
    String(r.routes.withColor),
  ]);
  summaryRows.push([
    'totals',
    '',
    String(totalRoutes),
    formatTypeCounts(aggregatedTypes),
    String(sum((routes) => routes.withColor)),
  ]);

  // Section layout: Totals → Summary (the roll-up, shown first so the
  // reader gets the whole picture) → detail sub-sections.
  return [
    '### Totals',
    '',
    `sources=${results.length}, totalRoutes=${totalRoutes}, distinctRouteTypes=${distinctTypes.size}`,
    '',
    '### Summary',
    '',
    renderTable(summaryHeader, summaryRows, summaryHeader.length),
    '',
    '### Route types',
    '',
    // types is a wide text column → all columns left-aligned.
    renderTable(typesHeader, typesRows, typesHeader.length),
    '',
    '### Naming',
    '',
    renderTable(namingHeader, namingRows, 2),
    '',
    '### Colors',
    '',
    renderTable(colorsHeader, colorsRows, 2),
    '',
    '### Description',
    '',
    renderTable(descHeader, descRows, 2),
  ].join('\n');
}

/** Sum of the six TranslationsJson maps' entry counts. */
function i18nRowTotal(c: I18nCoverageSummary): number {
  return (
    c.agencyNames +
    c.routeLongNames +
    c.routeShortNames +
    c.stopNames +
    c.tripHeadsigns +
    c.stopHeadsigns
  );
}

function formatI18nCoverageSectionBody(results: V2DataVolumeStats[]): string {
  const header = [
    'source',
    'prefix',
    'langs',
    'langCount',
    'agencyNames',
    'routeLongNames',
    'routeShortNames',
    'stopNames',
    'tripHeadsigns',
    'stopHeadsigns',
    'total',
  ];
  const rows: string[][] = results.map((result) => {
    const c = result.i18nCoverage;
    return [
      result.nameEn,
      result.prefix,
      c.languages.length === 0 ? '-' : c.languages.join(', '),
      String(c.languages.length),
      String(c.agencyNames),
      String(c.routeLongNames),
      String(c.routeShortNames),
      String(c.stopNames),
      String(c.tripHeadsigns),
      String(c.stopHeadsigns),
      String(i18nRowTotal(c)),
    ];
  });
  const sumPer = (pick: (c: I18nCoverageSummary) => number): number =>
    results.reduce((acc, r) => acc + pick(r.i18nCoverage), 0);
  rows.push([
    'totals',
    '',
    '-',
    // langCount sum is the per-source-count sum, not the distinct lang count
    // (= distinctLangs is shown in the Totals subsection above).
    String(sumPer((c) => c.languages.length)),
    String(sumPer((c) => c.agencyNames)),
    String(sumPer((c) => c.routeLongNames)),
    String(sumPer((c) => c.routeShortNames)),
    String(sumPer((c) => c.stopNames)),
    String(sumPer((c) => c.tripHeadsigns)),
    String(sumPer((c) => c.stopHeadsigns)),
    String(sumPer(i18nRowTotal)),
  ]);
  const sourcesWithI18n = results.filter((r) => r.i18nCoverage.languages.length > 0).length;
  const allLangs = new Set<string>();
  for (const r of results) {
    for (const l of r.i18nCoverage.languages) {
      allLangs.add(l);
    }
  }
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sourcesWithI18n=${sourcesWithI18n}, distinctLangs=${allLangs.size}`,
    '',
    '### Summary',
    '',
    // 3 left-aligned label columns (source / prefix / langs); remaining
    // 8 numeric columns are right-aligned.
    renderTable(header, rows, 3),
  ];
  return lines.join('\n');
}

function formatAgenciesSectionBody(results: V2DataVolumeStats[]): string {
  const header = ['source', 'prefix', 'count', 'names', 'timezones'];
  const rows: string[][] = results.map((result) => [
    result.nameEn,
    result.prefix,
    String(result.agencies.count),
    result.agencies.names === '' ? '-' : result.agencies.names,
    result.agencies.timezones === '' ? '-' : result.agencies.timezones,
  ]);
  const totalAgencies = results.reduce((acc, r) => acc + r.agencies.count, 0);
  rows.push(['totals', '', String(totalAgencies), '-', '-']);
  const multiAgencySources = results.filter((r) => r.agencies.count > 1).length;
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, totalAgencies=${totalAgencies}, multiAgencySources=${multiAgencySources}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, header.length),
  ];
  return lines.join('\n');
}

function formatPeriodsSectionBody(results: V2DataVolumeStats[]): string {
  const header = ['source', 'prefix', 'feedValidity', 'servicePeriod', 'exceptionRange'];
  const rows: string[][] = results.map((result) => {
    const p = result.periods;
    return [
      result.nameEn,
      result.prefix,
      formatDateRange(p.feedStart === '' ? null : p.feedStart, p.feedEnd === '' ? null : p.feedEnd),
      formatDateRange(p.serviceStart, p.serviceEnd),
      formatDateRange(p.exceptionStart, p.exceptionEnd),
    ];
  });
  rows.push(['totals', '', '-', '-', '-']);
  const missingFeed = results.filter(
    (r) => r.periods.feedStart === '' && r.periods.feedEnd === '',
  ).length;
  const missingService = results.filter(
    (r) => r.periods.serviceStart === null && r.periods.serviceEnd === null,
  ).length;
  const missingException = results.filter(
    (r) => r.periods.exceptionStart === null && r.periods.exceptionEnd === null,
  ).length;
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, missingFeed=${missingFeed}, missingService=${missingService}, missingException=${missingException}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, header.length),
  ];
  return lines.join('\n');
}

export const V2_DATA_VOLUME_SECTIONS = {
  'file-sizes': {
    name: 'file-sizes',
    title: 'File sizes (raw)',
    description: 'Raw byte size of data.json, insights.json, and shapes.json per source.',
    render: formatFileSizesSectionBody,
  },
  'gzip-sizes': {
    name: 'gzip-sizes',
    title: 'File sizes (gzip)',
    description: 'gzip-compressed size of each bundle file, approximating transfer payload.',
    render: formatGzipSizesSectionBody,
  },
  counts: {
    name: 'counts',
    title: 'DataBundle counts (data.json)',
    description: 'Entity counts derived from each source DataBundle.',
    render: formatCountsSectionBody,
  },
  'feed-info': {
    name: 'feed-info',
    title: 'DataBundle feed-info (data.json)',
    description: 'Feed identity from feedInfo only: publisher / lang / declared validity (s..e).',
    render: formatFeedInfoSectionBody,
  },
  agencies: {
    name: 'agencies',
    title: 'DataBundle agencies (data.json)',
    description:
      'Agency identity per source: count / names (joined) / timezones (deduped). Multi-agency sources (e.g. ntbus=5) join values with ", ".',
    render: formatAgenciesSectionBody,
  },
  routes: {
    name: 'routes',
    title: 'DataBundle routes (data.json)',
    description:
      'Route inventory in detail sub-sections (Route types / Naming / Colors / Description) plus a roll-up Summary. Each facet is a presence count; combination breakdowns stay in analyze-gtfs-routes.',
    render: formatRoutesSectionBody,
  },
  stops: {
    name: 'stops',
    title: 'DataBundle stops (data.json)',
    description:
      'Summary of basic attributes in stops data: count, location_type distribution, parent_station coverage, wheelchair_boarding accessible count, platform_code / stop_desc / stop_url coverage, and lat/lon bbox.',
    render: formatStopsSectionBody,
  },
  'trip-patterns': {
    name: 'trip-patterns',
    title: 'DataBundle trip patterns (data.json)',
    description:
      'Trip pattern inventory (Athenai abstraction: unique route + headsign + direction + stop-sequence combination). Single Summary table. `directionCounts` is the direction_id 0/1/none split (ODPT sources omit direction_id so they read as all-none); `withTripHeadsign` / `withStopHeadsign` count patterns carrying a trip-level (`h`) / stop-level (`stops[].sh`) headsign, revealing the source headsign convention.',
    render: formatTripPatternsSectionBody,
  },
  'i18n-coverage': {
    name: 'i18n-coverage',
    title: 'DataBundle i18n-coverage (data.json)',
    description:
      'Translation coverage per TranslationsJson map. `langs` is the sorted union of language codes; the six count columns mirror the JSON fields one-to-one.',
    render: formatI18nCoverageSectionBody,
  },
  periods: {
    name: 'periods',
    title: 'DataBundle periods (data.json)',
    description:
      'Three date axes side-by-side: feedValidity (feedInfo), servicePeriod (calendar.services min..max), and exceptionRange (calendar.exceptions min..max). Empty axes appear as "-".',
    render: formatPeriodsSectionBody,
  },
} satisfies Record<V2DataVolumeSectionName, V2DataVolumeSectionDefinition>;

export const V2_DATA_VOLUME_SECTION_NAMES: readonly V2DataVolumeSectionName[] = [
  // Cross-bundle meta first: gives the overall "shape and weight"
  // before any per-content section, so later sections read in that
  // context.
  'file-sizes',
  'gzip-sizes',
  // Single-source sections within DataBundle (each cell maps to one
  // DataBundle key) — "what's in this bundle".
  'counts',
  'feed-info',
  'agencies',
  'routes',
  'stops',
  'trip-patterns',
  'i18n-coverage',
  // Composite sections within DataBundle (combine multiple keys) —
  // synthesis / interpretation comes last.
  'periods',
];
