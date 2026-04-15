/**
 * Pure analysis of a v2 per-source InsightsBundle.
 *
 * Aggregates duration statistics from `tripPatternStats`:
 *   - per-pattern distribution (each pattern counted once)
 *   - per-trip distribution (each pattern counted `freq` times)
 * Plus shared min/max across the valid pattern set.
 *
 * No I/O. Formatter functions are side-effect free and return strings so
 * the CLI wrapper can direct them to stdout.
 */

import type { InsightsBundle } from '../../../../src/types/data/transit-v2-json';

/** Thresholds (minutes) for the "long trip share" columns. */
export const OVER_THRESHOLDS_MINUTES = [30, 60, 90] as const;

/** Distribution summary for either a per-pattern or a per-trip view. */
export interface DistributionStats {
  /** Count of observations in this view. */
  count: number;
  /** Arithmetic mean total minutes. */
  meanMin: number;
  /** Median (p50) total minutes. */
  medianMin: number;
  /** 90th percentile total minutes. */
  p90Min: number;
  /** Population standard deviation of total minutes. */
  stdMin: number;
}

/** Aggregated duration stats for a single source. */
export interface InsightsSourceStats {
  /** Source prefix (e.g. 'kbus'). */
  source: string;
  /** Resource nameEn, or prefix when name resolution failed. */
  nameEn: string;
  /** Min rd[0] across all valid patterns (same for pattern and trip view). */
  minMin: number;
  /** Max rd[0] across all valid patterns (same for pattern and trip view). */
  maxMin: number;
  /**
   * Min / mean / median / max of rd.length (stop count per pattern),
   * pattern-weighted. Indicates the structural size of each trip pattern.
   */
  minStops: number;
  meanStops: number;
  medianStops: number;
  maxStops: number;
  /** Distribution with each pattern counted exactly once. */
  byPattern: DistributionStats;
  /** Distribution with each pattern counted `freq` times. */
  byTrip: DistributionStats;
  /**
   * Percent of trips (freq-weighted) whose rd[0] exceeds each threshold
   * in {@link OVER_THRESHOLDS_MINUTES}. Same order as the constant.
   */
  pctTripOver: number[];
  /** Service groups summary for this source. */
  serviceGroups: ServiceGroupsSummary;
  /** Trip pattern geometry summary, or null when section is absent. */
  tripPatternGeo: TripPatternGeoSummary | null;
  /** Stop stats summary, or null when section is absent. */
  stopStats: StopStatsSummary | null;
}

/** Summary of the `serviceGroups` section. */
export interface ServiceGroupsSummary {
  /** Total number of service groups in this source. */
  groupCount: number;
  /** Total count of service_ids across all groups. */
  serviceIdCount: number;
  /** Group keys in declared order (e.g. ['wd','sa','su']). */
  keys: string[];
  /** Service id count per group, aligned with `keys`. */
  groupSizes: number[];
  /** Count of standard keys (wd/sa/su/wk/all). */
  stdKeyCount: number;
  /** Count of non-standard keys (everything else, typically d-bitmask). */
  nonStdKeyCount: number;
}

const STANDARD_SG_KEYS = new Set(['wd', 'sa', 'su', 'wk', 'all']);

/**
 * Summary of the `stopStats` section.
 *
 * Each stop is represented by its "busiest" values across all service
 * groups that mention it:
 *   - freq / rc / rtc → max across groups (peak activity)
 *   - ed              → min across groups (earliest start of any day)
 *   - ld              → max across groups (latest end of any day)
 */
export interface StopStatsSummary {
  /** Count of distinct stopIds appearing in any service group. */
  stops: number;
  /** Min of per-stop max freq (quietest stop). */
  minFreq: number;
  /** Mean of per-stop max freq (departures/day on the busiest day). */
  meanFreq: number;
  /** Max of per-stop max freq (busiest stop anywhere). */
  maxFreq: number;
  /** Distribution of per-stop max freq across stops. */
  freqDistribution: DistributionStats;
  /** Max route count at any single stop. */
  maxRc: number;
  /** Max route type count at any single stop. */
  maxRtc: number;
  /**
   * Source-wide earliest departure (minutes from midnight, min of ed).
   * `null` when no ed values are present.
   */
  earliestMinutes: number | null;
  /**
   * Source-wide latest departure (minutes from midnight, max of ld).
   * Values >= 1440 represent overnight service past midnight.
   * `null` when no ld values are present.
   */
  latestMinutes: number | null;
}

/**
 * Summary of the `tripPatternGeo` section.
 *
 * IMPORTANT: `dist` and `pathDist` are straight-line based (Haversine
 * between consecutive stop coordinates), not real road distance. They
 * under-represent actual route length on winding streets.
 */
export interface TripPatternGeoSummary {
  /** Number of patterns with a geo entry. */
  patterns: number;
  /** Number of patterns flagged as circular (cl=true). */
  circular: number;
  /** Percent of patterns flagged as circular. */
  circularPct: number;
  /** Min pathDist across all patterns (km). */
  pathDistMinKm: number;
  /** Mean pathDist across all patterns (km). */
  pathDistMeanKm: number;
  /** Median pathDist across all patterns (km). */
  pathDistMedianKm: number;
  /** Max pathDist across all patterns (km). */
  pathDistMaxKm: number;
  /** Full distribution of pathDist (km), all patterns included. */
  pathDistDistribution: DistributionStats;
  /**
   * Mean straight-line dist across non-circular patterns (km). `null`
   * when there are no non-circular patterns.
   */
  distMeanKm: number | null;
  /**
   * Median straight-line dist across non-circular patterns (km). `null`
   * when there are no non-circular patterns.
   */
  distMedianKm: number | null;
  /**
   * Mean ratio of `dist / pathDist` across non-circular patterns.
   * 1.0 = perfectly straight, lower = more wandering. `null` when
   * there are no non-circular patterns.
   */
  straightRatioMean: number | null;
}

/**
 * Compute summary statistics from an InsightsBundle.
 *
 * Returns `null` when the bundle has no `tripPatternStats` data or no valid
 * patterns (so the caller can skip the source with a warning instead of
 * emitting a zero-filled row).
 */
export function analyzeInsightsBundle(
  source: string,
  nameEn: string,
  bundle: InsightsBundle,
): InsightsSourceStats | null {
  const statsData = bundle.tripPatternStats?.data;
  if (!statsData) {
    return null;
  }

  const serviceGroups = summarizeServiceGroups(bundle);
  const tripPatternGeo = summarizeTripPatternGeo(bundle);
  const stopStats = summarizeStopStats(bundle);

  const patternValues: number[] = [];
  const tripValues: number[] = [];
  const stopCounts: number[] = [];

  for (const serviceGroup of Object.keys(statsData)) {
    const patterns = statsData[serviceGroup];
    for (const patternId of Object.keys(patterns)) {
      const entry = patterns[patternId];
      const { freq, rd } = entry;
      if (!Array.isArray(rd) || rd.length < 2) {
        continue;
      }
      const total = rd[0];
      if (!Number.isFinite(total) || total <= 0) {
        continue;
      }
      patternValues.push(total);
      stopCounts.push(rd.length);
      for (let i = 0; i < freq; i++) {
        tripValues.push(total);
      }
    }
  }

  if (patternValues.length === 0) {
    return null;
  }

  const byPattern = computeDistribution(patternValues);
  const byTrip = computeDistribution(tripValues);
  const minMin = Math.min(...patternValues);
  const maxMin = Math.max(...patternValues);
  const minStops = Math.min(...stopCounts);
  const maxStops = Math.max(...stopCounts);
  const meanStops = stopCounts.reduce((acc, v) => acc + v, 0) / stopCounts.length;
  const sortedStops = [...stopCounts].sort((a, b) => a - b);
  const medianStops = sortedStops[Math.floor(sortedStops.length / 2)];
  const pctTripOver = OVER_THRESHOLDS_MINUTES.map((threshold) => {
    if (tripValues.length === 0) {
      return 0;
    }
    const over = tripValues.filter((v) => v > threshold).length;
    return (over / tripValues.length) * 100;
  });

  return {
    source,
    nameEn,
    minMin,
    maxMin,
    minStops,
    meanStops,
    medianStops,
    maxStops,
    byPattern,
    byTrip,
    pctTripOver,
    serviceGroups,
    tripPatternGeo,
    stopStats,
  };
}

/** Extract a per-source ServiceGroupsSummary from the bundle. */
function summarizeServiceGroups(bundle: InsightsBundle): ServiceGroupsSummary {
  const groups = bundle.serviceGroups?.data ?? [];
  const keys = groups.map((g) => g.key);
  const groupSizes = groups.map((g) => g.serviceIds.length);
  const serviceIdCount = groupSizes.reduce((acc, n) => acc + n, 0);
  const stdKeyCount = keys.filter((k) => STANDARD_SG_KEYS.has(k)).length;
  const nonStdKeyCount = keys.length - stdKeyCount;
  return {
    groupCount: groups.length,
    serviceIdCount,
    keys,
    groupSizes,
    stdKeyCount,
    nonStdKeyCount,
  };
}

/** Extract a per-source TripPatternGeoSummary from the bundle. */
function summarizeTripPatternGeo(bundle: InsightsBundle): TripPatternGeoSummary | null {
  const geoData = bundle.tripPatternGeo?.data;
  if (!geoData) {
    return null;
  }
  const entries = Object.values(geoData);
  if (entries.length === 0) {
    return null;
  }

  const pathDists = entries.map((e) => e.pathDist).filter((v) => Number.isFinite(v));
  if (pathDists.length === 0) {
    return null;
  }

  const circular = entries.filter((e) => e.cl).length;
  const circularPct = (circular / entries.length) * 100;

  const pathDistMinKm = Math.min(...pathDists);
  const pathDistMaxKm = Math.max(...pathDists);
  const pathDistMeanKm = pathDists.reduce((acc, v) => acc + v, 0) / pathDists.length;
  const sortedPathDists = [...pathDists].sort((a, b) => a - b);
  const pathDistMedianKm = sortedPathDists[Math.floor(sortedPathDists.length / 2)];
  const pathDistDistribution = computeDistribution(pathDists);

  const nonCircular = entries.filter((e) => !e.cl && e.pathDist > 0);
  const distMeanKm =
    nonCircular.length > 0
      ? nonCircular.reduce((acc, e) => acc + e.dist, 0) / nonCircular.length
      : null;
  let distMedianKm: number | null = null;
  if (nonCircular.length > 0) {
    const sortedDists = nonCircular.map((e) => e.dist).sort((a, b) => a - b);
    distMedianKm = sortedDists[Math.floor(sortedDists.length / 2)];
  }
  const straightRatioMean =
    nonCircular.length > 0
      ? nonCircular.reduce((acc, e) => acc + e.dist / e.pathDist, 0) / nonCircular.length
      : null;

  return {
    patterns: entries.length,
    circular,
    circularPct,
    pathDistMinKm,
    pathDistMeanKm,
    pathDistMedianKm,
    pathDistMaxKm,
    pathDistDistribution,
    distMeanKm,
    distMedianKm,
    straightRatioMean,
  };
}

/**
 * Aggregate `stopStats` by taking the "busiest sg" values per stop.
 *
 * For each stopId found in any service group, merge across groups:
 *   freq/rc/rtc = max, ed = min, ld = max. Then summarize across stops.
 */
function summarizeStopStats(bundle: InsightsBundle): StopStatsSummary | null {
  const statsData = bundle.stopStats?.data;
  if (!statsData) {
    return null;
  }
  // Per-stop best-of aggregation across all service groups.
  const perStop = new Map<
    string,
    { freq: number; rc: number; rtc: number; ed: number | null; ld: number | null }
  >();
  for (const sg of Object.keys(statsData)) {
    const stops = statsData[sg];
    for (const stopId of Object.keys(stops)) {
      const s = stops[stopId];
      const cur = perStop.get(stopId);
      if (cur === undefined) {
        perStop.set(stopId, {
          freq: s.freq,
          rc: s.rc,
          rtc: s.rtc,
          ed: Number.isFinite(s.ed) ? s.ed : null,
          ld: Number.isFinite(s.ld) ? s.ld : null,
        });
      } else {
        cur.freq = Math.max(cur.freq, s.freq);
        cur.rc = Math.max(cur.rc, s.rc);
        cur.rtc = Math.max(cur.rtc, s.rtc);
        if (Number.isFinite(s.ed)) {
          cur.ed = cur.ed === null ? s.ed : Math.min(cur.ed, s.ed);
        }
        if (Number.isFinite(s.ld)) {
          cur.ld = cur.ld === null ? s.ld : Math.max(cur.ld, s.ld);
        }
      }
    }
  }

  if (perStop.size === 0) {
    return null;
  }

  const freqs: number[] = [];
  let maxRc = 0;
  let maxRtc = 0;
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const [, v] of perStop) {
    freqs.push(v.freq);
    if (v.rc > maxRc) {
      maxRc = v.rc;
    }
    if (v.rtc > maxRtc) {
      maxRtc = v.rtc;
    }
    if (v.ed !== null) {
      earliest = earliest === null ? v.ed : Math.min(earliest, v.ed);
    }
    if (v.ld !== null) {
      latest = latest === null ? v.ld : Math.max(latest, v.ld);
    }
  }

  const meanFreq = freqs.reduce((acc, n) => acc + n, 0) / freqs.length;
  const minFreq = Math.min(...freqs);
  const maxFreq = Math.max(...freqs);
  const freqDistribution = computeDistribution(freqs);

  return {
    stops: perStop.size,
    minFreq,
    meanFreq,
    maxFreq,
    freqDistribution,
    maxRc,
    maxRtc,
    earliestMinutes: earliest,
    latestMinutes: latest,
  };
}

/**
 * Compute a DistributionStats from a raw value array.
 *
 * Uses population std (divide by n, not n-1) since the values represent the
 * full observed set, not a sample. Median and p90 use the nearest-rank
 * method (`arr[floor(n * q)]`) — simple and deterministic for datasets
 * where interpolation would complicate interpretation.
 */
function computeDistribution(values: number[]): DistributionStats {
  const count = values.length;
  if (count === 0) {
    return { count: 0, meanMin: 0, medianMin: 0, p90Min: 0, stdMin: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const meanMin = sum / count;
  const medianMin = sorted[Math.floor(count / 2)];
  const p90Min = sorted[Math.floor(count * 0.9)];
  const variance = sorted.reduce((acc, v) => acc + (v - meanMin) ** 2, 0) / count;
  const stdMin = Math.sqrt(variance);
  return { count, meanMin, medianMin, p90Min, stdMin };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format one or more source stats as a human-readable multi-section string.
 *
 * Rows are sorted by `byTrip.meanMin` descending. Two tables are emitted:
 *
 *   1. Overview — source / nameEn / patterns / trips / minMin / maxMin / pctTripOver60
 *   2. Per-view distribution — for each source, per-pattern and per-trip
 *      distribution (mean / median / p90 / std)
 */
export function formatInsightsAnalysis(
  rows: InsightsSourceStats[],
  options: { analyzedAt?: Date } = {},
): string {
  if (rows.length === 0) {
    return 'No insights data found.';
  }
  const sorted = [...rows].sort((a, b) => b.byTrip.meanMin - a.byTrip.meanMin);
  const analyzedAt = options.analyzedAt ?? new Date();

  const sections = [
    '# Athenai Transit — V2 InsightsBundle analysis',
    '',
    `# Analyzed at: ${analyzedAt.toISOString()}`,
    '# Per-source summary of `public/data-v2/<source>/insights.json`.',
    '# Covers serviceGroups (calendar segmentation), tripPatternStats',
    '# (pattern/trip duration distribution), tripPatternGeo (straight-',
    '# line geometry — handle with care), and stopStats (per-stop',
    '# activity, aggregated as "busiest service group"). Sections',
    '# follow the InsightsBundle type declaration order. Each',
    '# subsection has its own inline legend.',
    '',
    '# serviceGroups',
    '',
    formatServiceGroupsTable(sorted),
    '',
    formatServiceGroupsKeysDetail(sorted),
    '',
    '# tripPatternStats',
    '',
    formatOverviewTable(sorted),
    '',
    formatDistributionTable(sorted),
    '',
    '# tripPatternGeo',
    '',
    formatTripPatternGeoTable(sorted),
    '',
    formatPathDistDistributionTable(sorted),
    '',
    '# stopStats',
    '',
    formatStopStatsOverview(sorted),
    '',
    formatStopStatsDistribution(sorted),
  ];

  return sections.join('\n');
}

function fmtNum(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function formatOverviewTable(rows: InsightsSourceStats[]): string {
  const overCols = OVER_THRESHOLDS_MINUTES.map((t) => `pctOver${t}(%)`);
  const header = [
    'source',
    'nameEn',
    'patterns',
    'trips',
    'min(min)',
    'max(min)',
    'minStops',
    'meanStops',
    'medStops',
    'maxStops',
    ...overCols,
  ];
  const body = rows.map((r) => [
    r.source,
    r.nameEn,
    String(r.byPattern.count),
    String(r.byTrip.count),
    fmtNum(r.minMin),
    fmtNum(r.maxMin),
    String(r.minStops),
    fmtNum(r.meanStops),
    String(r.medianStops),
    String(r.maxStops),
    ...r.pctTripOver.map((v) => fmtNum(v)),
  ]);
  return `## Overview\n\n${TRIP_PATTERN_STATS_OVERVIEW_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatDistributionTable(rows: InsightsSourceStats[]): string {
  const header = ['source', 'view', 'count', 'mean(min)', 'p50(min)', 'p90(min)', 'std(min)'];
  const body: string[][] = [];
  for (const r of rows) {
    body.push([
      r.source,
      'pattern',
      String(r.byPattern.count),
      fmtNum(r.byPattern.meanMin),
      fmtNum(r.byPattern.medianMin),
      fmtNum(r.byPattern.p90Min),
      fmtNum(r.byPattern.stdMin),
    ]);
    body.push([
      r.source,
      'trip',
      String(r.byTrip.count),
      fmtNum(r.byTrip.meanMin),
      fmtNum(r.byTrip.medianMin),
      fmtNum(r.byTrip.p90Min),
      fmtNum(r.byTrip.stdMin),
    ]);
  }
  return `## Distribution of trip duration (minutes)\n\n${TRIP_PATTERN_STATS_DISTRIBUTION_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatServiceGroupsTable(rows: InsightsSourceStats[]): string {
  const header = ['source', 'nameEn', 'groups', 'serviceIds', 'stdKeys', 'nonStdKeys'];
  const body = rows.map((r) => {
    const sg = r.serviceGroups;
    return [
      r.source,
      r.nameEn,
      String(sg.groupCount),
      String(sg.serviceIdCount),
      String(sg.stdKeyCount),
      String(sg.nonStdKeyCount),
    ];
  });
  return `## Summary\n\n${SERVICE_GROUPS_SUMMARY_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatServiceGroupsKeysDetail(rows: InsightsSourceStats[]): string {
  const lines: string[] = ['## Keys detail', '', SERVICE_GROUPS_KEYS_DETAIL_LEGEND, ''];
  for (const r of rows) {
    const sg = r.serviceGroups;
    const keysWithSize = sg.keys.map((k, i) => `${k}(${sg.groupSizes[i]})`).join(' ');
    lines.push(`${r.source.padEnd(8)} ${keysWithSize}`);
  }
  return lines.join('\n');
}

function formatTripPatternGeoTable(rows: InsightsSourceStats[]): string {
  // Columns suffixed with "*" are derived from the pipeline-estimated
  // `cl` (circular) flag. See the inline legend below for details.
  const header = [
    'source',
    'nameEn',
    'patterns',
    'circular*',
    'circular*(%)',
    'pathDistMin(km)',
    'pathDistMean(km)',
    'pathDistMed(km)',
    'pathDistMax(km)',
    'distMean*(km)',
    'distMed*(km)',
    'straightRatio*',
  ];
  const body = rows.map((r) => {
    const g = r.tripPatternGeo;
    if (g === null) {
      return [r.source, r.nameEn, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
    }
    return [
      r.source,
      r.nameEn,
      String(g.patterns),
      String(g.circular),
      fmtNum(g.circularPct),
      fmtNum(g.pathDistMinKm, 2),
      fmtNum(g.pathDistMeanKm, 2),
      fmtNum(g.pathDistMedianKm, 2),
      fmtNum(g.pathDistMaxKm, 2),
      g.distMeanKm !== null ? fmtNum(g.distMeanKm, 2) : '-',
      g.distMedianKm !== null ? fmtNum(g.distMedianKm, 2) : '-',
      g.straightRatioMean !== null ? fmtNum(g.straightRatioMean, 2) : '-',
    ];
  });
  return `## Overview\n\n${TRIP_PATTERN_GEO_OVERVIEW_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatPathDistDistributionTable(rows: InsightsSourceStats[]): string {
  const header = [
    'source',
    'count',
    'min(km)',
    'mean(km)',
    'p50(km)',
    'p90(km)',
    'max(km)',
    'std(km)',
  ];
  const body = rows.map((r) => {
    const g = r.tripPatternGeo;
    if (g === null) {
      return [r.source, '-', '-', '-', '-', '-', '-', '-'];
    }
    const d = g.pathDistDistribution;
    return [
      r.source,
      String(d.count),
      fmtNum(g.pathDistMinKm, 2),
      fmtNum(d.meanMin, 2),
      fmtNum(d.medianMin, 2),
      fmtNum(d.p90Min, 2),
      fmtNum(g.pathDistMaxKm, 2),
      fmtNum(d.stdMin, 2),
    ];
  });
  return `## Distribution of pathDist (km)\n\n${TRIP_PATTERN_GEO_DISTRIBUTION_LEGEND}\n\n${renderTable(header, body)}`;
}

/** Format minutes-from-midnight as HH:MM, supporting 24h+ values. */
function fmtHhmm(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) {
    return '-';
  }
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatStopStatsOverview(rows: InsightsSourceStats[]): string {
  const header = [
    'source',
    'nameEn',
    'stops',
    'meanFreq',
    'medFreq',
    'maxFreq',
    'maxRc',
    'maxRtc',
    'earliest',
    'latest',
  ];
  const body = rows.map((r) => {
    const s = r.stopStats;
    if (s === null) {
      return [r.source, r.nameEn, '-', '-', '-', '-', '-', '-', '-', '-'];
    }
    return [
      r.source,
      r.nameEn,
      String(s.stops),
      fmtNum(s.meanFreq),
      fmtNum(s.freqDistribution.medianMin),
      String(s.maxFreq),
      String(s.maxRc),
      String(s.maxRtc),
      fmtHhmm(s.earliestMinutes),
      fmtHhmm(s.latestMinutes),
    ];
  });
  return `## Overview\n\n${STOP_STATS_OVERVIEW_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatStopStatsDistribution(rows: InsightsSourceStats[]): string {
  const header = ['source', 'count', 'min', 'mean', 'p50', 'p90', 'max', 'std'];
  const body = rows.map((r) => {
    const s = r.stopStats;
    if (s === null) {
      return [r.source, '-', '-', '-', '-', '-', '-', '-'];
    }
    const d = s.freqDistribution;
    return [
      r.source,
      String(d.count),
      String(s.minFreq),
      fmtNum(d.meanMin),
      fmtNum(d.medianMin),
      fmtNum(d.p90Min),
      String(s.maxFreq),
      fmtNum(d.stdMin),
    ];
  });
  return `## Distribution of stop freq (per day)\n\n${STOP_STATS_DISTRIBUTION_LEGEND}\n\n${renderTable(header, body)}`;
}

const SERVICE_GROUPS_SUMMARY_LEGEND = [
  '# Summarizes how the pipeline segments the calendar into service groups',
  '# for stats lookup.',
  '#',
  '# groups      : total number of service groups in this source',
  '# serviceIds  : total GTFS service_ids across all groups',
  '# stdKeys     : count of groups with a standard key',
  '#               (wd=weekday, sa=Saturday, su=Sunday, wk=weekend,',
  '#                all=every day)',
  '# nonStdKeys  : count of groups with a non-standard key',
  '#               (d-bitmask, e.g. d0000100 = Friday only)',
].join('\n');

const SERVICE_GROUPS_KEYS_DETAIL_LEGEND = [
  '# Per-source listing of each group key and its service_id count.',
  '# Useful for spotting unusual weekly patterns or sources with many',
  '# operating days.',
].join('\n');

const TRIP_PATTERN_STATS_OVERVIEW_LEGEND = [
  '# patterns   : distinct trip patterns in the source',
  '# trips      : total departures (sum of freq across service groups)',
  '# min / max  : shortest / longest pattern total duration (minutes)',
  '# minStops   : fewest stops in any pattern (rd.length)',
  '# meanStops  : mean stops per pattern',
  '# medStops   : median stops per pattern (outlier-resistant)',
  '# maxStops   : most stops in any pattern',
  `# pctOverN   : % of trips (freq-weighted) whose total > N min (N = ${OVER_THRESHOLDS_MINUTES.join(', ')})`,
].join('\n');

const TRIP_PATTERN_STATS_DISTRIBUTION_LEGEND = [
  '# Every statistic (mean / p50 / p90 / std) describes the distribution',
  '# of trip-pattern total duration (rd[0]) in minutes.',
  '#',
  '# view = how each pattern contributes to the distribution:',
  '#   pattern : each distinct trip pattern counted once',
  '#             (what route shapes this operator designs)',
  '#   trip    : each pattern counted freq times (actual operated trips)',
  '#             (what durations riders actually experience)',
  '#',
  '# count : number of observations in the view',
  '# mean  : mean trip duration',
  '# p50   : median trip duration — half of trips are shorter, half are longer',
  '# p90   : 90th percentile trip duration — only the longest 10% exceed this',
  '# std   : standard deviation of trip duration (larger = more spread)',
].join('\n');

const TRIP_PATTERN_GEO_OVERVIEW_LEGEND = [
  '# IMPORTANT (straight-line basis):',
  '#   `dist` and `pathDist` are computed by the pipeline as Haversine',
  '#   straight-line distances between consecutive stop coordinates.',
  '#   They do NOT reflect real road distance and will under-represent',
  '#   winding routes. Handle with care.',
  '#',
  '# IMPORTANT (cl is an estimate — columns marked "*"):',
  '#   The `cl` flag is set when the first and last stop_id in a pattern',
  '#   are equal — a rule-based guess by the pipeline, not an operator-',
  '#   authoritative "this is a circular route" declaration. It can miss',
  '#   circular routes that terminate at a different platform of the',
  '#   same station, or mis-flag figure-eight routes. Treat all columns',
  '#   suffixed "*" as estimates.',
  '#',
  '# patterns         : number of patterns with a tripPatternGeo entry',
  '# circular*        : count of patterns flagged as circular (cl=true)',
  '# circular*(%)     : share of circular-flagged patterns',
  '# pathDistMin/Max  : shortest/longest sum of stop-to-stop straight',
  '#                    lines (km)',
  '# pathDistMean     : mean path distance across all patterns (km)',
  '# pathDistMed      : median path distance across all patterns (km,',
  '#                    outlier-resistant)',
  '# distMean*        : mean origin-to-terminal straight-line distance',
  '#                    across patterns NOT flagged as circular (km)',
  '# distMed*         : median origin-to-terminal straight-line distance',
  '#                    across patterns NOT flagged as circular (km)',
  '# straightRatio*   : mean of (dist / pathDist) across patterns NOT',
  '#                    flagged as circular. 1.0 = perfectly straight,',
  '#                    lower = more detour / wandering',
].join('\n');

const TRIP_PATTERN_GEO_DISTRIBUTION_LEGEND = [
  '# Distribution of pathDist across all patterns (cl-independent).',
  '# Uses the same statistic definitions as the duration distribution:',
  '#',
  '# count : number of patterns with a valid pathDist',
  '# mean  : arithmetic mean path distance (km)',
  '# p50   : median path distance — half of patterns are shorter',
  '# p90   : 90th percentile — only the longest 10% exceed this',
  '# std   : population standard deviation of path distance (km)',
].join('\n');

const STOP_STATS_OVERVIEW_LEGEND = [
  '# Per-stop values are aggregated as "busiest service group": for',
  '# each stopId, freq/rc/rtc take the max across service groups, ed',
  '# takes the min, ld takes the max. This yields the peak profile',
  '# for each stop regardless of which weekly pattern (wd/sa/su/etc.)',
  '# was most representative.',
  '#',
  '# stops     : distinct stopIds present in any service group',
  '# meanFreq  : mean of per-stop busiest-day freq',
  '# medFreq   : median of per-stop busiest-day freq (outlier-resistant)',
  '# maxFreq   : max of per-stop busiest-day freq (busiest stop anywhere)',
  '# maxRc     : max route count at any single stop (hub indicator)',
  '# maxRtc    : max route-type count at any single stop (multimodal)',
  '# earliest  : source-wide earliest departure (HH:MM, 24h+ overnight)',
  '# latest    : source-wide latest departure (HH:MM, 24h+ overnight)',
].join('\n');

const STOP_STATS_DISTRIBUTION_LEGEND = [
  '# Distribution of per-stop "busiest day" freq across stops.',
  '# Each stopId contributes a single value (max freq across its',
  '# service groups).',
  '#',
  '# count : number of stops',
  '# mean  : mean busiest-day freq per stop',
  '# p50   : median — half of stops see fewer, half see more',
  '# p90   : 90% of stops are at most this busy; only the top 10% exceed',
  '# std   : population standard deviation of per-stop freq',
].join('\n');

/**
 * Render a simple padded ASCII table. The first column is left-aligned and
 * remaining columns are right-aligned so numeric values line up cleanly.
 */
function renderTable(header: string[], body: string[][]): string {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...body.map((row) => row[i]?.length ?? 0)),
  );
  const pad = (row: string[]): string =>
    row.map((cell, i) => (i <= 1 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [pad(header), sep, ...body.map(pad)].join('\n');
}
