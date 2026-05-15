/**
 * Pure helpers for summarising per-source v2 InsightsBundle files.
 *
 * Per-source trip volume is captured by two max-leaning indicators so
 * a sg-tail-heavy source (e.g. VAG Freiburg, 20 service groups) is not
 * misrepresented by a median that gets pulled toward niche-day values.
 *
 * For distribution-style analysis (mean / p90 / std of ride durations
 * etc.), see `analyze-v2-insights.ts` — this module is the
 * "summary" counterpart, not a replacement.
 *
 * The CLI orchestrator is responsible for locating sources and reading
 * files. The functions here are pure and deterministic.
 */

import type { InsightsBundle } from '@contracts/data/transit-v2-json';

import { type AnalysisSectionDefinition } from './analysis-sections';
import { renderTable } from './render-utils';

/**
 * Per-source trip-volume summary derived from a single InsightsBundle.
 *
 * Two max-leaning indicators replace the previous median-based view,
 * which silently misrepresented sources whose service-group axis is
 * heavy-tailed (the median collapses toward a handful of niche-day
 * groups even when the source's actual operational scale is on a few
 * dominant groups):
 *
 *   - `tripsTotal` ・・・ `Σ_{sg, pattern} freq`. Because every GTFS
 *     trip_id belongs to exactly one (service_id, pattern) tuple,
 *     this sum equals the trip_id row count in trips.txt. It is
 *     **day-agnostic** and serves as a pure data-volume indicator.
 *   - `tripsMax` ・・・ `max_{sg} (Σ_{pattern} freq)`. Trip count on
 *     the source's busiest operational day. Captures the peak
 *     processing load and the realistic per-day scale.
 *
 * Both fields are `null` when the source has no `tripPatternStats`
 * section (e.g. insights.json is missing). `0` is reserved for
 * "section present but no trips", which should not occur given the
 * pipeline filters out empty groups, but is handled defensively.
 */
export interface TripVolumeSummary {
  tripsTotal: number | null;
  tripsMax: number | null;
  /** Number of service groups defined for this source. */
  serviceGroupCount: number;
}

/**
 * Counts per InsightsBundle top-level section.
 *
 * Same generic rule as DataBundleCounts: `.data` is either an array
 * (length) or a Record (top-level key count). Excludes metadata
 * fields (`bundle_version`, `kind`). Optional sections (e.g.
 * `tripPatternStats`) that are absent from the bundle contribute a
 * `0` count rather than being omitted from the result — the section
 * list stays uniform across sources.
 */
export type InsightsBundleCounts = Record<string, number>;

export interface V2InsightsSummary {
  prefix: string;
  nameEn: string;
  /**
   * Whether `insights.json` was present on disk for this source.
   * Distinct from "has trip volume": a bundle can be present yet
   * carry no `tripPatternStats` section, leaving `tripsTotal` null.
   */
  bundlePresent: boolean;
  counts: InsightsBundleCounts;
  tripVolume: TripVolumeSummary;
}

export interface AnalyzeV2InsightsSummaryInput {
  prefix: string;
  nameEn: string;
  /**
   * Loaded InsightsBundle, or `null` when insights.json is missing or
   * fails to parse. `null` propagates to {@link TripVolumeSummary}'s
   * `tripsTotal` and `tripsMax` as `null`, and `serviceGroupCount` as `0`.
   */
  insights: InsightsBundle | null;
}

export type V2InsightsSummarySectionName = 'insights-counts' | 'trip-volume';

const INSIGHTS_BUNDLE_EXCLUDED_KEYS = new Set(['bundle_version', 'kind']);

/**
 * Naive section-count rule, identical to the DataBundle version.
 * Kept locally to keep this sub lib self-contained.
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
 * Build counts for every InsightsBundle top-level section.
 *
 * Visits every key declared on `InsightsBundle` (via the type union)
 * so optional-but-absent sections still appear with a `0` count —
 * matching the uniform-column behaviour of the DataBundle counts.
 */
function buildInsightsBundleCounts(insights: InsightsBundle | null): InsightsBundleCounts {
  const result: InsightsBundleCounts = {
    serviceGroups: 0,
    tripPatternStats: 0,
    tripPatternGeo: 0,
    stopStats: 0,
  };
  if (insights === null) {
    return result;
  }
  for (const [key, value] of Object.entries(insights)) {
    if (INSIGHTS_BUNDLE_EXCLUDED_KEYS.has(key)) {
      continue;
    }
    result[key] = countSection(value);
  }
  return result;
}

export type V2InsightsSummarySectionDefinition = AnalysisSectionDefinition<
  V2InsightsSummary[],
  V2InsightsSummarySectionName
>;

/**
 * Compute the per-service-group trip-count totals for a source.
 *
 * Returns one entry per service group present in `tripPatternStats`.
 * Each value is the sum of `freq` across every pattern in that group.
 *
 * Returns an empty array when `tripPatternStats` is absent.
 */
export function computeTripCountsPerServiceGroup(insights: InsightsBundle | null): number[] {
  if (insights === null || insights.tripPatternStats === undefined) {
    return [];
  }
  const result: number[] = [];
  for (const groupStats of Object.values(insights.tripPatternStats.data)) {
    let sum = 0;
    for (const stats of Object.values(groupStats)) {
      sum += stats.freq;
    }
    result.push(sum);
  }
  return result;
}

export function analyzeV2InsightsSummary(input: AnalyzeV2InsightsSummaryInput): V2InsightsSummary {
  const perGroupTrips = computeTripCountsPerServiceGroup(input.insights);
  const hasInsights = perGroupTrips.length > 0;
  // tripsTotal sums every (sg, pattern) freq; each GTFS trip_id is
  // counted exactly once because trip → service_id → sg is 1:1:1.
  // tripsMax picks the busiest sg's total — the source's peak day.
  const tripsTotal = hasInsights ? perGroupTrips.reduce((a, b) => a + b, 0) : null;
  const tripsMax = hasInsights ? Math.max(...perGroupTrips) : null;
  return {
    prefix: input.prefix,
    nameEn: input.nameEn,
    bundlePresent: input.insights !== null,
    counts: buildInsightsBundleCounts(input.insights),
    tripVolume: {
      tripsTotal,
      tripsMax,
      // `serviceGroups` is a required InsightsBundle section, so its
      // length is the authoritative count of groups defined for the
      // source — distinct from the number of groups that happen to
      // appear in the optional `tripPatternStats` section.
      serviceGroupCount: input.insights === null ? 0 : input.insights.serviceGroups.data.length,
    },
  };
}

function formatInteger(value: number | null): string {
  return value === null ? '-' : String(value);
}

function sumNumber(
  results: V2InsightsSummary[],
  select: (result: V2InsightsSummary) => number,
): number {
  return results.reduce((acc, result) => acc + select(result), 0);
}

function sumNullable(
  results: V2InsightsSummary[],
  select: (result: V2InsightsSummary) => number | null,
): number {
  return results.reduce((acc, result) => acc + (select(result) ?? 0), 0);
}

function collectInsightsBundleKeys(results: V2InsightsSummary[]): string[] {
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

function formatInsightsCountsSectionBody(results: V2InsightsSummary[]): string {
  const insightsKeys = collectInsightsBundleKeys(results);
  const header = ['source', 'prefix', ...insightsKeys];
  const rows: string[][] = results.map((result) => [
    result.nameEn,
    result.prefix,
    ...insightsKeys.map((key) => String(result.counts[key] ?? 0)),
  ]);
  rows.push([
    'totals',
    '',
    ...insightsKeys.map((key) => String(sumNumber(results, (r) => r.counts[key] ?? 0))),
  ]);
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sections=${insightsKeys.length}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, 2),
  ];
  return lines.join('\n');
}

function formatTripVolumeSectionBody(results: V2InsightsSummary[]): string {
  const header = ['source', 'prefix', 'tripsTotal', 'tripsMax', 'serviceGroups'];
  const rows = results.map((result) => [
    result.nameEn,
    result.prefix,
    formatInteger(result.tripVolume.tripsTotal),
    formatInteger(result.tripVolume.tripsMax),
    String(result.tripVolume.serviceGroupCount),
  ]);
  // Totals row: tripsTotal sums naturally (= overall trip_id count
  // across all sources). tripsMax is a per-source peak, so the sum
  // would conflate different peak days — show '-' instead.
  rows.push([
    'totals',
    '',
    String(sumNullable(results, (r) => r.tripVolume.tripsTotal)),
    '-',
    String(sumNumber(results, (r) => r.tripVolume.serviceGroupCount)),
  ]);
  const missing = results.filter((result) => !result.bundlePresent).length;
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sourcesMissingInsights=${missing}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, 2),
  ];
  return lines.join('\n');
}

export const V2_INSIGHTS_SUMMARY_SECTIONS = {
  'insights-counts': {
    name: 'insights-counts',
    title: 'InsightsBundle counts (insights.json)',
    description: 'Entity counts derived from each source InsightsBundle.',
    render: formatInsightsCountsSectionBody,
  },
  'trip-volume': {
    name: 'trip-volume',
    title: 'InsightsBundle trip volume (insights.json)',
    description:
      'Two max-leaning indicators per source: tripsTotal (day-agnostic, = trips.txt row count) and tripsMax (busiest service group). Median view was withdrawn because it misrepresented sources with heavy-tailed service-group distributions.',
    render: formatTripVolumeSectionBody,
  },
} satisfies Record<V2InsightsSummarySectionName, V2InsightsSummarySectionDefinition>;

export const V2_INSIGHTS_SUMMARY_SECTION_NAMES: readonly V2InsightsSummarySectionName[] = [
  'insights-counts',
  'trip-volume',
];
