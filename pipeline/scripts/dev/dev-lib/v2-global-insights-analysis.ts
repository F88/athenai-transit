/**
 * Pure analysis of the v2 GlobalInsightsBundle.
 *
 * Reads `public/data-v2/global/insights.json` (kind = `global-insights`)
 * and summarizes its single section `stopGeo` — cross-source spatial
 * metrics keyed by stopId.
 *
 * Per-source breakdown (by stopId prefix) is provided alongside the
 * global total so sources contributing many stops do not hide smaller
 * ones. Additional sub-sections cover the `nr` / `wp` distributions,
 * isolation distance bands, hub/monomorphic counts, connectivity
 * (`cn.ho`) stats, and Top-N leaderboards.
 *
 * No I/O. Formatter functions return strings.
 *
 * ## Testing philosophy
 *
 * Statistical correctness of the aggregation output is intentionally
 * not unit-tested. The numbers here are reductions over real pipeline
 * data whose "ground truth" is that same data, so the practical
 * validation path is manual review of the printed output. The
 * companion test file (`__tests__/v2-global-insights-analysis.test.ts`)
 * contains smoke tests only — verifying that functions return the
 * expected shape, handle missing sections gracefully, and format
 * without throwing. Those guard against type regressions and trivial
 * breakage during refactor, not against algorithm bugs.
 */

import type { GlobalInsightsBundle } from '../../../../src/types/data/transit-v2-json';
import { renderTable } from './render-utils';
import { sortedMedian, sortedPercentile } from './stats-utils';

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/**
 * Top-N size for every leaderboard rendered by this analyser
 * (most isolated / most connected / busiest neighborhoods).
 *
 * Kept intentionally small so the output stays scannable in a
 * terminal. Increase if a future analysis needs a deeper view.
 */
export const TOP_N = 10;

export const V2_GLOBAL_INSIGHTS_SECTION_NAMES = [
  'summary',
  'nr-distribution',
  'isolation-buckets',
  'connectivity',
  'hub-counts',
  'walkable-portal',
  'most-isolated-stops',
  'most-connected-stops',
  'busiest-neighborhoods',
] as const;

export type V2GlobalInsightsSectionName = (typeof V2_GLOBAL_INSIGHTS_SECTION_NAMES)[number];

/** Distribution summary for a numeric value array (unit-agnostic). */
export interface DistributionStats {
  count: number;
  mean: number;
  median: number;
  p90: number;
  std: number;
}

/** Count of stops that fall in each `nr` distance band (km-based). */
export interface IsolationBuckets {
  /** nr == 0 (colocated alternative, or single-route dataset). */
  zero: number;
  /** 0 < nr <= 0.1 km (100m). */
  under100m: number;
  /** 0.1 < nr <= 0.5 km. */
  under500m: number;
  /** 0.5 < nr <= 1.0 km. */
  under1km: number;
  /** 1.0 < nr <= 5.0 km. */
  under5km: number;
  /** nr > 5.0 km. */
  over5km: number;
}

/** Connectivity (`cn.ho`) stats aggregated over stops that have `cn`. */
export interface ConnectivityStats {
  /** Count of stops with cn.ho present. */
  count: number;
  /** Routes within 300m (cn.ho.rc). */
  rc: DistributionStats;
  /** Max routes within 300m at any single stop. */
  rcMax: number;
  /** Per-stop `cn.ho.freq` distribution (for each stop, stop times/day within 300m aggregated across unique routes at each route's max-freq stop). */
  freq: DistributionStats;
  /** Largest `cn.ho.freq` across all stops — identifies the stop whose 300m neighborhood is the busiest. */
  freqMax: number;
  /** Stops within 300m (cn.ho.sc). */
  sc: DistributionStats;
  /** Max stops within 300m at any single stop. */
  scMax: number;
  /**
   * Ratio `freq.mean / sc.mean`: average stop times per colocated stop.
   * High values indicate "few stops but high frequency" (urban trunks),
   * low values indicate "many stops sharing few trips" (residential).
   */
  freqPerSc: number;
}

/** Hub / monomorphic stop counts derived from cn.ho.rc. */
export interface HubCounts {
  /** Stops with rc >= 5 (hub indicator). */
  hub5: number;
  /** Stops with rc >= 10. */
  hub10: number;
  /** Stops with rc >= 20. */
  hub20: number;
  /** Stops with rc == 1 (only the stop's own route nearby). */
  mono: number;
}

/** Walkable portal (`wp`) summary for sources with parent_station data. */
export interface WalkablePortalStats {
  /** Count of stops with a valid wp value. */
  count: number;
  /** Distribution of wp (km) across stops with wp present. */
  distribution: DistributionStats;
  /** Min wp (km). */
  minKm: number;
  /** Max wp (km). */
  maxKm: number;
  /** Count of stops with wp <= 0.2 km (200m — "hidden walking shortcut"). */
  under200m: number;
}

/** Single-stop leaderboard entry. */
export interface LeaderboardEntry {
  source: string;
  stopId: string;
  nr?: number;
  cnRc?: number;
  cnFreq?: number;
  cnSc?: number;
}

/** Per-prefix summary of stopGeo entries. */
export interface StopGeoSourceStats {
  /** Source prefix extracted from stopId (`<prefix>:<rest>`). */
  source: string;
  /** Total stopGeo entries for this source. */
  stops: number;
  /** Entries with `wp` present (walkable-portal metric available). */
  withWp: number;
  /** Entries with `cn` present (connectivity metric available). */
  withCn: number;
  /** Min nr (km), excluding 0 (0 means "not meaningfully isolated"). */
  nrMinKm: number | null;
  /** Max nr (km). */
  nrMaxKm: number | null;
  /** Distribution of nr (km) across stops with nr > 0. */
  nrDistribution: DistributionStats;
  /** nr distance-band bucket counts. */
  isolationBuckets: IsolationBuckets;
  /** Connectivity (cn.ho) stats, or null when no stops have `cn`. */
  connectivity: ConnectivityStats | null;
  /** Hub and monomorphic counts derived from cn.ho.rc. */
  hubCounts: HubCounts;
  /** Walkable portal (wp) stats, or null when no stops have `wp`. */
  walkablePortal: WalkablePortalStats | null;
}

/** Overall summary including per-source breakdown and totals. */
export interface GlobalInsightsStats {
  /** Total stopGeo entries across all sources. */
  totalStops: number;
  /** Number of source prefixes observed. */
  totalSources: number;
  /** Per-source breakdown, sorted by stops descending. */
  perSource: StopGeoSourceStats[];
  /** Top-N leaderboards computed across all sources. */
  leaderboards: {
    /** Most isolated stops (highest nr). */
    mostIsolated: LeaderboardEntry[];
    /** Most connected stops (highest cn.ho.rc, ties broken by cn.ho.freq). */
    mostConnected: LeaderboardEntry[];
    /** Busiest neighborhoods (highest cn.ho.freq). */
    busiestNeighborhood: LeaderboardEntry[];
  };
}

/** Extract a `GlobalInsightsStats` from a parsed GlobalInsightsBundle. */
export function analyzeGlobalInsightsBundle(
  bundle: GlobalInsightsBundle,
): GlobalInsightsStats | null {
  const geoData = bundle.stopGeo?.data;
  if (!geoData) {
    return null;
  }

  interface Accumulator {
    stops: number;
    withWp: number;
    withCn: number;
    nrPositive: number[];
    isolationBuckets: IsolationBuckets;
    cnRcs: number[];
    cnFreqs: number[];
    cnScs: number[];
    hub5: number;
    hub10: number;
    hub20: number;
    mono: number;
    wpValues: number[];
    wpUnder200m: number;
  }
  const bySource = new Map<string, Accumulator>();

  // Raw per-stop entries, used to build cross-source leaderboards.
  const allEntries: {
    source: string;
    stopId: string;
    nr: number;
    rc?: number;
    freq?: number;
    sc?: number;
  }[] = [];

  for (const stopId of Object.keys(geoData)) {
    const entry = geoData[stopId];
    const prefix = stopId.split(':', 1)[0] || '?';
    let bucket = bySource.get(prefix);
    if (bucket === undefined) {
      bucket = {
        stops: 0,
        withWp: 0,
        withCn: 0,
        nrPositive: [],
        isolationBuckets: emptyIsolationBuckets(),
        cnRcs: [],
        cnFreqs: [],
        cnScs: [],
        hub5: 0,
        hub10: 0,
        hub20: 0,
        mono: 0,
        wpValues: [],
        wpUnder200m: 0,
      };
      bySource.set(prefix, bucket);
    }
    bucket.stops += 1;
    const rawEntry: (typeof allEntries)[number] = {
      source: prefix,
      stopId,
      nr: Number.isFinite(entry.nr) ? entry.nr : 0,
    };
    if (entry.wp !== undefined && Number.isFinite(entry.wp)) {
      bucket.withWp += 1;
      bucket.wpValues.push(entry.wp);
      if (entry.wp <= 0.2) {
        bucket.wpUnder200m += 1;
      }
    }
    if (entry.cn !== undefined) {
      bucket.withCn += 1;
      const ho = entry.cn.ho;
      if (ho !== undefined) {
        if (Number.isFinite(ho.rc)) {
          bucket.cnRcs.push(ho.rc);
          if (ho.rc >= 20) {
            bucket.hub20 += 1;
          }
          if (ho.rc >= 10) {
            bucket.hub10 += 1;
          }
          if (ho.rc >= 5) {
            bucket.hub5 += 1;
          }
          if (ho.rc === 1) {
            bucket.mono += 1;
          }
          rawEntry.rc = ho.rc;
        }
        if (Number.isFinite(ho.freq)) {
          bucket.cnFreqs.push(ho.freq);
          rawEntry.freq = ho.freq;
        }
        if (Number.isFinite(ho.sc)) {
          bucket.cnScs.push(ho.sc);
          rawEntry.sc = ho.sc;
        }
      }
    }
    if (Number.isFinite(entry.nr)) {
      accumulateIsolationBucket(bucket.isolationBuckets, entry.nr);
      if (entry.nr > 0) {
        bucket.nrPositive.push(entry.nr);
      }
    }
    allEntries.push(rawEntry);
  }

  if (bySource.size === 0) {
    return null;
  }

  const perSource: StopGeoSourceStats[] = [];
  let totalStops = 0;
  for (const [source, bucket] of bySource) {
    totalStops += bucket.stops;
    const nrDistribution = computeDistribution(bucket.nrPositive);
    let connectivity: ConnectivityStats | null = null;
    if (bucket.withCn > 0) {
      const rc = computeDistribution(bucket.cnRcs);
      const freq = computeDistribution(bucket.cnFreqs);
      const sc = computeDistribution(bucket.cnScs);
      connectivity = {
        count: bucket.withCn,
        rc,
        rcMax: bucket.cnRcs.length > 0 ? Math.max(...bucket.cnRcs) : 0,
        freq,
        freqMax: bucket.cnFreqs.length > 0 ? Math.max(...bucket.cnFreqs) : 0,
        sc,
        scMax: bucket.cnScs.length > 0 ? Math.max(...bucket.cnScs) : 0,
        freqPerSc: sc.mean > 0 ? freq.mean / sc.mean : 0,
      };
    }
    let walkablePortal: WalkablePortalStats | null = null;
    if (bucket.wpValues.length > 0) {
      walkablePortal = {
        count: bucket.wpValues.length,
        distribution: computeDistribution(bucket.wpValues),
        minKm: Math.min(...bucket.wpValues),
        maxKm: Math.max(...bucket.wpValues),
        under200m: bucket.wpUnder200m,
      };
    }
    perSource.push({
      source,
      stops: bucket.stops,
      withWp: bucket.withWp,
      withCn: bucket.withCn,
      nrMinKm: bucket.nrPositive.length > 0 ? Math.min(...bucket.nrPositive) : null,
      nrMaxKm: bucket.nrPositive.length > 0 ? Math.max(...bucket.nrPositive) : null,
      nrDistribution,
      isolationBuckets: bucket.isolationBuckets,
      connectivity,
      hubCounts: {
        hub5: bucket.hub5,
        hub10: bucket.hub10,
        hub20: bucket.hub20,
        mono: bucket.mono,
      },
      walkablePortal,
    });
  }
  perSource.sort((a, b) => b.stops - a.stops);

  const leaderboards = buildLeaderboards(allEntries);

  return {
    totalStops,
    totalSources: bySource.size,
    perSource,
    leaderboards,
  };
}

/**
 * Tie-breaker comparator used as the **last** sort step for every
 * leaderboard. Compares by `stopId` (lexicographic ascending) so the
 * Top-N output is deterministic when two stops have identical
 * primary / secondary metric values. Without this, `Array.sort` falls
 * back to engine-defined stability semantics and the leaderboard can
 * shift between runs over the same data.
 */
function tieBreakByStopId(a: { stopId: string }, b: { stopId: string }): number {
  return a.stopId < b.stopId ? -1 : a.stopId > b.stopId ? 1 : 0;
}

function buildLeaderboards(
  entries: {
    source: string;
    stopId: string;
    nr: number;
    rc?: number;
    freq?: number;
    sc?: number;
  }[],
): GlobalInsightsStats['leaderboards'] {
  // mostIsolated: sort by nr desc, then stopId asc for deterministic ties.
  const mostIsolated = [...entries]
    .filter((e) => e.nr > 0)
    .sort((a, b) => {
      if (b.nr !== a.nr) {
        return b.nr - a.nr;
      }
      return tieBreakByStopId(a, b);
    })
    .slice(0, TOP_N)
    .map<LeaderboardEntry>((e) => ({ source: e.source, stopId: e.stopId, nr: e.nr }));

  // mostConnected: sort by rc desc, then freq desc, then stopId asc.
  const mostConnected = [...entries]
    .filter((e) => e.rc !== undefined)
    .sort((a, b) => {
      if (b.rc !== a.rc) {
        return (b.rc ?? 0) - (a.rc ?? 0);
      }
      if (b.freq !== a.freq) {
        return (b.freq ?? 0) - (a.freq ?? 0);
      }
      return tieBreakByStopId(a, b);
    })
    .slice(0, TOP_N)
    .map<LeaderboardEntry>((e) => ({
      source: e.source,
      stopId: e.stopId,
      cnRc: e.rc,
      cnFreq: e.freq,
      cnSc: e.sc,
    }));

  // busiestNeighborhood: sort by freq desc, then stopId asc.
  const busiestNeighborhood = [...entries]
    .filter((e) => e.freq !== undefined)
    .sort((a, b) => {
      if (b.freq !== a.freq) {
        return (b.freq ?? 0) - (a.freq ?? 0);
      }
      return tieBreakByStopId(a, b);
    })
    .slice(0, TOP_N)
    .map<LeaderboardEntry>((e) => ({
      source: e.source,
      stopId: e.stopId,
      cnRc: e.rc,
      cnFreq: e.freq,
      cnSc: e.sc,
    }));

  return { mostIsolated, mostConnected, busiestNeighborhood };
}

function computeDistribution(values: number[]): DistributionStats {
  const count = values.length;
  if (count === 0) {
    return { count: 0, mean: 0, median: 0, p90: 0, std: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const median = sortedMedian(sorted);
  const p90 = sortedPercentile(sorted, 0.9);
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const std = Math.sqrt(variance);
  return { count, mean, median, p90, std };
}

function emptyIsolationBuckets(): IsolationBuckets {
  return { zero: 0, under100m: 0, under500m: 0, under1km: 0, under5km: 0, over5km: 0 };
}

function accumulateIsolationBucket(buckets: IsolationBuckets, nr: number): void {
  if (nr === 0) {
    buckets.zero += 1;
    return;
  }
  if (nr <= 0.1) {
    buckets.under100m += 1;
    return;
  }
  if (nr <= 0.5) {
    buckets.under500m += 1;
    return;
  }
  if (nr <= 1.0) {
    buckets.under1km += 1;
    return;
  }
  if (nr <= 5.0) {
    buckets.under5km += 1;
    return;
  }
  buckets.over5km += 1;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const STOP_GEO_SUMMARY_LEGEND = [
  '# Per-source breakdown of stopGeo entries. stopId is parsed as',
  '# `<prefix>:<rest>` to group rows by data source. The "TOTAL" row',
  '# aggregates all sources.',
  '#',
  '# stops      : stopGeo entries for this source',
  '# withWp(%)  : share of stops that have `wp` (walkable-portal metric,',
  '#              requires parent_station data upstream)',
  '# withCn(%)  : share of stops that have `cn` (connectivity metric,',
  '#              currently populated for Sunday/holiday pattern only)',
  '# nrMin(km)  : closest different-route neighbor (excludes nr=0)',
  '# nrMax(km)  : farthest different-route neighbor',
].join('\n');

const STOP_GEO_NR_DISTRIBUTION_LEGEND = [
  '# Distribution of `nr` (km) — distance to the nearest stop served by',
  '# a different route. Values of 0 are excluded because nr=0 means',
  '# "not meaningfully isolated" (colocated alternative or no alternative',
  '# exists), which conflates two very different situations.',
  '#',
  '# count : stops with nr > 0',
  '# mean  : mean distance to nearest different-route stop (km)',
  '# p50   : median — half of stops have a closer alternative, half farther',
  '# p90   : 90% of stops have an alternative within this distance',
  '# std   : population standard deviation (km)',
].join('\n');

const STOP_GEO_ISOLATION_BUCKETS_LEGEND = [
  '# Count of stops in each `nr` distance band. Gives the shape of the',
  '# isolation distribution at a glance — dense urban operators concentrate',
  '# in the low-distance buckets while rural/long-distance operators extend',
  '# toward the tail.',
  '#',
  '# nr=0       : colocated alternative OR no alternative exists at all',
  '# 0-100m     : walking-distance different-route stop',
  '# 100-500m   : short walk to a different-route stop',
  '# 500m-1km   : moderate walk / ~10 min on foot',
  '# 1-5km     : no walking alternative, transfer requires another vehicle',
  '# >5km      : truly isolated stop',
].join('\n');

const STOP_GEO_CONNECTIVITY_LEGEND = [
  '# Distribution of `cn.ho` — per-stop connectivity within a 300m radius',
  '# on Sunday/holiday calendar. Only stops that carry `cn` data are',
  '# counted (see `withCn(%)` in the Summary).',
  '#',
  '# count      : stops with cn.ho present',
  '# rcMean     : mean routes within 300m',
  '# rcP50      : median routes within 300m (outlier-resistant)',
  '# rcP90      : 90th percentile routes within 300m',
  '# rcMax      : max routes within 300m at any single stop',
  '# freqMean   : mean stop times/day within 300m',
  '# freqP50    : median stop times/day within 300m',
  '# freqP90    : 90th percentile stop times/day within 300m',
  '# freqMax    : max stop times/day within 300m',
  '# scMean     : mean stops within 300m',
  '# scP50      : median stops within 300m',
  '# scMax      : max stops within 300m',
  '# freqPerSc  : freqMean / scMean — stop times per colocated stop.',
  '#              High = "few stops but high frequency" (urban trunks),',
  '#              low = "many stops sharing few trips" (residential).',
].join('\n');

const STOP_GEO_HUB_LEGEND = [
  '# Counts of hub and monomorphic stops derived from `cn.ho.rc`',
  '# (number of routes within 300m on holiday/Sunday pattern).',
  '#',
  '# hub5+       : stops with 5+ routes within 300m (neighborhood hub)',
  '# hub10+      : stops with 10+ routes within 300m (major hub)',
  '# hub20+      : stops with 20+ routes within 300m (trunk hub)',
  '# mono(rc=1)  : stops where only a single route exists within 300m',
  '#               (isolated service — either rural or single-operator area)',
].join('\n');

const STOP_GEO_WP_LEGEND = [
  '# Distribution of `wp` (km) — distance to the nearest stop with a',
  '# different `parent_station`. Only populated for sources whose GTFS',
  '# provides `parent_station` data (see `withWp(%)` in the Summary).',
  '#',
  '# count     : stops with wp present',
  '# min       : closest inter-station walking distance (km)',
  '# mean/p50  : mean / median walking distance to a different station',
  '# p90       : 90% of stops have a different station within this distance',
  '# max       : farthest nearest-different-station distance',
  '# std       : population standard deviation (km)',
  '# under200m : stops with wp <= 0.2 km — "hidden walking shortcut"',
  '#             between two unrelated station complexes',
].join('\n');

const STOP_GEO_LEADERBOARD_ISOLATED_LEGEND = [
  '# Top-N stops ranked by `nr` descending — the most isolated stops',
  '# in the whole dataset. stopId only (no stop name available from',
  '# GlobalInsightsBundle alone).',
].join('\n');

const STOP_GEO_LEADERBOARD_CONNECTED_LEGEND = [
  '# Top-N stops ranked by `cn.ho.rc` descending (ties broken by freq).',
  '# These are the trunk hubs — highest route density within 300m.',
].join('\n');

const STOP_GEO_LEADERBOARD_BUSIEST_LEGEND = [
  '# Top-N stops ranked by `cn.ho.freq` descending — the busiest',
  '# neighborhoods by stop times per day within 300m (holiday/Sunday).',
].join('\n');

/** Format a GlobalInsightsStats as a multi-section human-readable report. */
export function formatGlobalInsightsAnalysis(
  stats: GlobalInsightsStats | null,
  options: { analyzedAt?: Date; sections?: V2GlobalInsightsSectionName[] } = {},
): string {
  const analyzedAt = options.analyzedAt ?? new Date();
  const header = [
    '# Athenai Transit — V2 GlobalInsightsBundle analysis',
    '',
    `# Analyzed at: ${analyzedAt.toISOString()}`,
    '# Summary of `public/data-v2/global/insights.json` (kind =',
    '# `global-insights`). Currently covers the `stopGeo` section only.',
    '# Sections follow the GlobalInsightsBundle type declaration order.',
    '# Each subsection has its own inline legend.',
  ].join('\n');

  if (stats === null) {
    return `${header}\n\nNo stopGeo data found.`;
  }

  const requestedSections =
    options.sections === undefined || options.sections.length === 0
      ? V2_GLOBAL_INSIGHTS_SECTION_NAMES
      : options.sections;
  const renderedSections: string[] = [];

  for (const sectionName of requestedSections) {
    if (sectionName === 'summary') {
      renderedSections.push(formatSummaryTable(stats));
      continue;
    }
    if (sectionName === 'nr-distribution') {
      renderedSections.push(formatNrDistributionTable(stats.perSource));
      continue;
    }
    if (sectionName === 'isolation-buckets') {
      renderedSections.push(formatIsolationBucketsTable(stats.perSource));
      continue;
    }
    if (sectionName === 'connectivity') {
      renderedSections.push(formatConnectivityTable(stats.perSource));
      continue;
    }
    if (sectionName === 'hub-counts') {
      renderedSections.push(formatHubCountsTable(stats.perSource));
      continue;
    }
    if (sectionName === 'walkable-portal') {
      renderedSections.push(formatWalkablePortalTable(stats.perSource));
      continue;
    }
    if (sectionName === 'most-isolated-stops') {
      renderedSections.push(formatLeaderboardMostIsolated(stats.leaderboards.mostIsolated));
      continue;
    }
    if (sectionName === 'most-connected-stops') {
      renderedSections.push(formatLeaderboardMostConnected(stats.leaderboards.mostConnected));
      continue;
    }
    if (sectionName === 'busiest-neighborhoods') {
      renderedSections.push(
        formatLeaderboardBusiestNeighborhood(stats.leaderboards.busiestNeighborhood),
      );
    }
  }

  const sections = [
    header,
    '',
    '# stopGeo',
    '',
    ...renderedSections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
  ];
  return sections.join('\n');
}

function fmtNum(n: number | null, decimals = 2): string {
  if (n === null || !Number.isFinite(n)) {
    return '-';
  }
  return n.toFixed(decimals);
}

function fmtPct(part: number, total: number): string {
  if (total === 0) {
    return '-';
  }
  return ((part / total) * 100).toFixed(1);
}

function formatSummaryTable(stats: GlobalInsightsStats): string {
  const header = ['source', 'stops', 'withWp(%)', 'withCn(%)', 'nrMin(km)', 'nrMax(km)'];
  const totalWithWp = stats.perSource.reduce((acc, r) => acc + r.withWp, 0);
  const totalWithCn = stats.perSource.reduce((acc, r) => acc + r.withCn, 0);
  const nrMins = stats.perSource.map((r) => r.nrMinKm).filter((v): v is number => v !== null);
  const nrMaxes = stats.perSource.map((r) => r.nrMaxKm).filter((v): v is number => v !== null);
  const body: string[][] = stats.perSource.map((r) => [
    r.source,
    String(r.stops),
    fmtPct(r.withWp, r.stops),
    fmtPct(r.withCn, r.stops),
    fmtNum(r.nrMinKm),
    fmtNum(r.nrMaxKm),
  ]);
  body.push([
    'TOTAL',
    String(stats.totalStops),
    fmtPct(totalWithWp, stats.totalStops),
    fmtPct(totalWithCn, stats.totalStops),
    nrMins.length > 0 ? fmtNum(Math.min(...nrMins)) : '-',
    nrMaxes.length > 0 ? fmtNum(Math.max(...nrMaxes)) : '-',
  ]);
  return `## Summary\n\n${STOP_GEO_SUMMARY_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatNrDistributionTable(rows: StopGeoSourceStats[]): string {
  const header = ['source', 'count', 'mean(km)', 'p50(km)', 'p90(km)', 'std(km)'];
  const body = rows.map((r) => [
    r.source,
    String(r.nrDistribution.count),
    fmtNum(r.nrDistribution.mean),
    fmtNum(r.nrDistribution.median),
    fmtNum(r.nrDistribution.p90),
    fmtNum(r.nrDistribution.std),
  ]);
  return `## Distribution of nr (km)\n\n${STOP_GEO_NR_DISTRIBUTION_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatIsolationBucketsTable(rows: StopGeoSourceStats[]): string {
  const header = ['source', 'nr=0', '0-100m', '100-500m', '500m-1km', '1-5km', '>5km'];
  const body = rows.map((r) => {
    const b = r.isolationBuckets;
    return [
      r.source,
      String(b.zero),
      String(b.under100m),
      String(b.under500m),
      String(b.under1km),
      String(b.under5km),
      String(b.over5km),
    ];
  });
  return `## Isolation buckets (nr distance bands)\n\n${STOP_GEO_ISOLATION_BUCKETS_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatConnectivityTable(rows: StopGeoSourceStats[]): string {
  const header = [
    'source',
    'count',
    'rcMean',
    'rcP50',
    'rcP90',
    'rcMax',
    'freqMean',
    'freqP50',
    'freqP90',
    'freqMax',
    'scMean',
    'scP50',
    'scMax',
    'freqPerSc',
  ];
  const body = rows.map((r) => {
    const c = r.connectivity;
    if (c === null) {
      return [r.source, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
    }
    return [
      r.source,
      String(c.count),
      fmtNum(c.rc.mean, 1),
      fmtNum(c.rc.median, 1),
      fmtNum(c.rc.p90, 1),
      String(c.rcMax),
      fmtNum(c.freq.mean, 1),
      fmtNum(c.freq.median, 1),
      fmtNum(c.freq.p90, 1),
      String(c.freqMax),
      fmtNum(c.sc.mean, 1),
      fmtNum(c.sc.median, 1),
      String(c.scMax),
      fmtNum(c.freqPerSc, 1),
    ];
  });
  return `## Connectivity within 300m (cn.ho, holiday/Sunday pattern)\n\n${STOP_GEO_CONNECTIVITY_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatHubCountsTable(rows: StopGeoSourceStats[]): string {
  const header = ['source', 'hub5+', 'hub10+', 'hub20+', 'mono(rc=1)'];
  const body = rows.map((r) => [
    r.source,
    String(r.hubCounts.hub5),
    String(r.hubCounts.hub10),
    String(r.hubCounts.hub20),
    String(r.hubCounts.mono),
  ]);
  return `## Hub / monomorphic counts (derived from cn.ho.rc)\n\n${STOP_GEO_HUB_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatWalkablePortalTable(rows: StopGeoSourceStats[]): string {
  const header = [
    'source',
    'count',
    'min(km)',
    'mean(km)',
    'p50(km)',
    'p90(km)',
    'max(km)',
    'std(km)',
    'under200m',
  ];
  const body: string[][] = [];
  for (const r of rows) {
    const w = r.walkablePortal;
    if (w === null) {
      continue;
    }
    body.push([
      r.source,
      String(w.count),
      fmtNum(w.minKm),
      fmtNum(w.distribution.mean),
      fmtNum(w.distribution.median),
      fmtNum(w.distribution.p90),
      fmtNum(w.maxKm),
      fmtNum(w.distribution.std),
      String(w.under200m),
    ]);
  }
  if (body.length === 0) {
    return `## Distribution of wp (km)\n\n${STOP_GEO_WP_LEGEND}\n\n(no source has parent_station data — wp field is empty everywhere)`;
  }
  return `## Distribution of wp (km)\n\n${STOP_GEO_WP_LEGEND}\n\n${renderTable(header, body)}`;
}

function formatLeaderboardMostIsolated(entries: LeaderboardEntry[]): string {
  const header = ['rank', 'source', 'stopId', 'nr(km)'];
  const body = entries.map((e, i) => [String(i + 1), e.source, e.stopId, fmtNum(e.nr ?? null)]);
  return `## Top ${TOP_N} most isolated stops\n\n${STOP_GEO_LEADERBOARD_ISOLATED_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatLeaderboardMostConnected(entries: LeaderboardEntry[]): string {
  const header = ['rank', 'source', 'stopId', 'rc', 'freq', 'sc'];
  const body = entries.map((e, i) => [
    String(i + 1),
    e.source,
    e.stopId,
    e.cnRc !== undefined ? String(e.cnRc) : '-',
    e.cnFreq !== undefined ? String(e.cnFreq) : '-',
    e.cnSc !== undefined ? String(e.cnSc) : '-',
  ]);
  return `## Top ${TOP_N} most connected stops (rc desc)\n\n${STOP_GEO_LEADERBOARD_CONNECTED_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

function formatLeaderboardBusiestNeighborhood(entries: LeaderboardEntry[]): string {
  const header = ['rank', 'source', 'stopId', 'freq', 'rc', 'sc'];
  const body = entries.map((e, i) => [
    String(i + 1),
    e.source,
    e.stopId,
    e.cnFreq !== undefined ? String(e.cnFreq) : '-',
    e.cnRc !== undefined ? String(e.cnRc) : '-',
    e.cnSc !== undefined ? String(e.cnSc) : '-',
  ]);
  return `## Top ${TOP_N} busiest neighborhoods (freq desc)\n\n${STOP_GEO_LEADERBOARD_BUSIEST_LEGEND}\n\n${renderTable(
    header,
    body,
  )}`;
}

/**
 * Render a simple padded ASCII table. The first column is left-aligned and
 * remaining columns are right-aligned so numeric values line up cleanly.
 */
