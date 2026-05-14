/**
 * Pure helpers for summarising the v2 GlobalInsightsBundle.
 *
 * GlobalInsightsBundle is a **per-all-datasources** artifact: a single
 * `public/data-v2/global/insights.json` file that consolidates
 * cross-source spatial metrics (stopGeo). It has no per-source axis,
 * so this sub lib's render takes a singleton summary object instead
 * of an array of per-source rows.
 *
 * Minimum-viable stub: raw file size, gzip file size, and the number
 * of stopGeo entries. These three numbers answer "how big is the
 * global artifact and how many stops does it cover", which is the
 * baseline question before deciding what richer indicators to add.
 *
 * The CLI orchestrator loads the bundle and measures sizes once;
 * this module does not perform I/O.
 */

import type { GlobalInsightsBundle } from '../../../../src/types/data/transit-v2-json';
import { type AnalysisSectionDefinition } from './analysis-sections';

/**
 * Summary for a single GlobalInsightsBundle artifact.
 *
 * When `global/insights.json` is missing, the nullable scalar fields
 * (`fileSize`, `gzipSize`, `stopGeoEntries`, `stopsWithWp`) are
 * `null`, and the collection fields (`counts`, `stopsWithCnByGroup`)
 * are empty objects — distinct from a present-but-empty bundle. The
 * absence is informative on its own (the bundle may not have been
 * generated for the current dataset).
 */
export interface GlobalInsightsBundleSummary {
  /** Raw byte size of global/insights.json (or null when missing). */
  fileSize: number | null;
  /** gzip-compressed byte size of global/insights.json (or null when missing). */
  gzipSize: number | null;
  /** Number of `stopGeo` entries (or null when missing / section omitted). */
  stopGeoEntries: number | null;
  /** Generic top-level counts (same rule as DataBundle counts). */
  counts: GlobalInsightsBundleCounts;
  /** Number of stops carrying `wp` (parent_station distance). */
  stopsWithWp: number | null;
  /**
   * Stops carrying `cn` (300m connectivity) bucketed by service-group
   * key. The map is empty when no stops have `cn`.
   */
  stopsWithCnByGroup: Record<string, number>;
}

export interface AnalyzeV2GlobalInsightsSummaryInput {
  /** `null` when global/insights.json is missing. */
  bundle: GlobalInsightsBundle | null;
  /** Raw file size in bytes, or null when missing. */
  fileSize: number | null;
  /** gzip-compressed file size in bytes, or null when missing. */
  gzipSize: number | null;
}

export type V2GlobalInsightsSummarySectionName = 'global-insights-counts' | 'global-insights';

export type V2GlobalInsightsSummarySectionDefinition = AnalysisSectionDefinition<
  GlobalInsightsBundleSummary,
  V2GlobalInsightsSummarySectionName
>;

/**
 * Counts per GlobalInsightsBundle top-level section.
 *
 * Same generic rule as DataBundleCounts: `.data` is either an array
 * (length) or a Record (top-level key count). GlobalInsightsBundle
 * currently has only `stopGeo` so this is a single-column view.
 */
export type GlobalInsightsBundleCounts = Record<string, number>;

const GLOBAL_INSIGHTS_EXCLUDED_KEYS = new Set(['bundle_version', 'kind']);

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

export function buildGlobalInsightsBundleCounts(
  bundle: GlobalInsightsBundle | null,
): GlobalInsightsBundleCounts {
  // A missing bundle yields an empty count set, distinct from a
  // present-but-empty bundle (which still reports its section keys,
  // e.g. `stopGeo: 0`).
  if (bundle === null) {
    return {};
  }
  const result: GlobalInsightsBundleCounts = {};
  for (const [key, value] of Object.entries(bundle)) {
    if (GLOBAL_INSIGHTS_EXCLUDED_KEYS.has(key)) {
      continue;
    }
    result[key] = countSection(value);
  }
  return result;
}

export function analyzeV2GlobalInsightsSummary(
  input: AnalyzeV2GlobalInsightsSummaryInput,
): GlobalInsightsBundleSummary {
  const stopGeoData =
    input.bundle === null || input.bundle.stopGeo === undefined ? null : input.bundle.stopGeo.data;
  const stopGeoEntries = stopGeoData === null ? null : Object.keys(stopGeoData).length;
  let stopsWithWp: number | null = null;
  const stopsWithCnByGroup: Record<string, number> = {};
  if (stopGeoData !== null) {
    stopsWithWp = 0;
    for (const stopGeo of Object.values(stopGeoData)) {
      if (stopGeo.wp !== undefined) {
        stopsWithWp += 1;
      }
      if (stopGeo.cn !== undefined) {
        for (const groupKey of Object.keys(stopGeo.cn)) {
          stopsWithCnByGroup[groupKey] = (stopsWithCnByGroup[groupKey] ?? 0) + 1;
        }
      }
    }
  }
  return {
    fileSize: input.fileSize,
    gzipSize: input.gzipSize,
    stopGeoEntries,
    counts: buildGlobalInsightsBundleCounts(input.bundle),
    stopsWithWp,
    stopsWithCnByGroup,
  };
}

function formatGlobalInsightsCountsSectionBody(summary: GlobalInsightsBundleSummary): string {
  // Singleton block: GlobalInsightsBundle is per-all-datasources, not
  // per-source, so rendered as a key/value list rather than a table.
  const lines = [
    '### Totals',
    '',
    `sections=${Object.keys(summary.counts).length}`,
    '',
    '### Summary',
    '',
  ];
  for (const [key, count] of Object.entries(summary.counts)) {
    lines.push(`- ${key}:  ${count}`);
  }
  return lines.join('\n');
}

function formatCoverage(count: number | null, denominator: number | null): string {
  if (count === null) {
    return '-';
  }
  if (denominator === null || denominator === 0) {
    return String(count);
  }
  const pct = ((count / denominator) * 100).toFixed(1);
  return `${count} (${pct}%)`;
}

function formatGlobalInsightsSectionBody(summary: GlobalInsightsBundleSummary): string {
  const lines = [
    '### Totals',
    '',
    summary.fileSize === null ? 'global/insights.json: not found' : 'global/insights.json: found',
    '',
    '### Summary',
    '',
    `- stops with wp:        ${formatCoverage(summary.stopsWithWp, summary.stopGeoEntries)}`,
  ];
  const cnKeys = Object.keys(summary.stopsWithCnByGroup).sort();
  if (cnKeys.length === 0) {
    lines.push(`- stops with cn:        -`);
  } else {
    for (const groupKey of cnKeys) {
      lines.push(
        `- stops with cn[${groupKey}]:  ${formatCoverage(summary.stopsWithCnByGroup[groupKey], summary.stopGeoEntries)}`,
      );
    }
  }
  return lines.join('\n');
}

export const V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS = {
  'global-insights-counts': {
    name: 'global-insights-counts',
    title: 'GlobalInsightsBundle counts (global/insights.json)',
    description: 'Entity counts derived from the GlobalInsightsBundle.',
    render: formatGlobalInsightsCountsSectionBody,
  },
  'global-insights': {
    name: 'global-insights',
    title: 'GlobalInsightsBundle (global/insights.json)',
    description:
      'Cross-source stopGeo coverage. Reports the share of stops carrying `wp` (parent_station distance) and `cn` (300m connectivity, per service group).',
    render: formatGlobalInsightsSectionBody,
  },
} satisfies Record<V2GlobalInsightsSummarySectionName, V2GlobalInsightsSummarySectionDefinition>;

export const V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES: readonly V2GlobalInsightsSummarySectionName[] =
  ['global-insights-counts', 'global-insights'];
