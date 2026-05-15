/**
 * Top-level coordinator for v2 output summaries.
 *
 * Layered structure:
 *
 *   entry script (summarize-v2-outputs.ts)
 *       │
 *       ▼
 *   v2-outputs-summary.ts  (this module: combines per-bundle summaries)
 *       │
 *       ▼
 *   v2-data-summary.ts / v2-insights-summary.ts / v2-shapes-summary.ts
 *   v2-global-insights-summary.ts                                ... (per-bundle sub libs)
 *
 * Each sub lib owns one bundle type's analyse + render. This module
 * defines the combined row type, exposes the union of section names,
 * dispatches section rendering to the right sub lib, and produces
 * the complete report (header + Overall summary + selected sections).
 *
 * Two dispatch styles exist because not every bundle is per-source:
 *
 *   - per-source sub libs (data / insights / shapes) feed off the
 *     `V2OutputsRow[]` array. The combined row holds one slot per
 *     sub lib so rows stay row-aligned across sections.
 *   - per-all-datasources sub libs (global-insights) feed off a single
 *     summary object passed alongside the rows array. There is no
 *     per-source axis to iterate over.
 *
 * Composed indicators that draw on multiple sub libs (e.g.
 * "bytes per trip" = data.fileSizes.data / insights.tripsTotal)
 * belong in this module, not in any single sub lib — sub libs do not
 * know about each other.
 */

import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '@contracts/data/transit-v2-json';

import {
  analyzeV2DataVolume,
  formatBytes,
  formatCompressionRatio,
  V2_DATA_VOLUME_SECTION_NAMES,
  V2_DATA_VOLUME_SECTIONS,
  type FileSizeStats,
  type V2DataVolumeSectionName,
  type V2DataVolumeStats,
} from './v2-data-summary';
import {
  analyzeV2GlobalInsightsSummary,
  V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES,
  V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS,
  type GlobalInsightsBundleSummary,
  type V2GlobalInsightsSummarySectionName,
} from './v2-global-insights-summary';
import {
  analyzeV2InsightsSummary,
  V2_INSIGHTS_SUMMARY_SECTION_NAMES,
  V2_INSIGHTS_SUMMARY_SECTIONS,
  type V2InsightsSummary,
  type V2InsightsSummarySectionName,
} from './v2-insights-summary';
import {
  analyzeV2ShapesSummary,
  V2_SHAPES_SUMMARY_SECTION_NAMES,
  V2_SHAPES_SUMMARY_SECTIONS,
  type V2ShapesSummary,
  type V2ShapesSummarySectionName,
} from './v2-shapes-summary';

/** Union of section names contributed by every sub lib. */
export type V2OutputsSectionName =
  | V2DataVolumeSectionName
  | V2InsightsSummarySectionName
  | V2ShapesSummarySectionName
  | V2GlobalInsightsSummarySectionName;

/**
 * Meta-counts sections, one per bundle. Grouped together at the
 * front of the report so the reader gets the "shape of every bundle"
 * before drilling into per-bundle detail.
 */
const META_COUNTS_SECTION_NAMES: readonly V2OutputsSectionName[] = [
  'counts', // DataBundle
  'shapes-counts', // ShapesBundle
  'insights-counts', // InsightsBundle
  'global-insights-counts', // GlobalInsightsBundle
];

export const V2_OUTPUTS_SECTION_NAMES: readonly V2OutputsSectionName[] = [
  // Cross-bundle file size meta first.
  'file-sizes',
  'gzip-sizes',
  // Per-bundle generic counts (also meta — "shape of each bundle").
  ...META_COUNTS_SECTION_NAMES,
  // DataBundle detail sections (after counts).
  ...V2_DATA_VOLUME_SECTION_NAMES.filter(
    (n) => n !== 'counts' && n !== 'file-sizes' && n !== 'gzip-sizes',
  ),
  // ShapesBundle detail (volume).
  ...V2_SHAPES_SUMMARY_SECTION_NAMES.filter((n) => n !== 'shapes-counts'),
  // InsightsBundle detail (trip-volume).
  ...V2_INSIGHTS_SUMMARY_SECTION_NAMES.filter((n) => n !== 'insights-counts'),
  // GlobalInsightsBundle file-size block (last — single-artifact tail).
  ...V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES.filter((n) => n !== 'global-insights-counts'),
];

/**
 * Compact description records for `--list-sections` output, ordered
 * to match {@link V2_OUTPUTS_SECTION_NAMES}.
 */
function describeOne(name: V2OutputsSectionName): {
  name: V2OutputsSectionName;
  title: string;
  description: string;
} {
  if (isDataSectionName(name)) {
    const s = V2_DATA_VOLUME_SECTIONS[name];
    return { name, title: s.title, description: s.description };
  }
  if (isShapesSectionName(name)) {
    const s = V2_SHAPES_SUMMARY_SECTIONS[name];
    return { name, title: s.title, description: s.description };
  }
  if (isInsightsSectionName(name)) {
    const s = V2_INSIGHTS_SUMMARY_SECTIONS[name];
    return { name, title: s.title, description: s.description };
  }
  if (isGlobalSectionName(name)) {
    const s = V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS[name];
    return { name, title: s.title, description: s.description };
  }
  const _exhaustive: never = name;
  return _exhaustive;
}

export const V2_OUTPUTS_SECTION_DESCRIPTIONS: readonly {
  name: V2OutputsSectionName;
  title: string;
  description: string;
}[] = V2_OUTPUTS_SECTION_NAMES.map(describeOne);

/** Combined per-source result row, one slot per per-source sub lib. */
export interface V2OutputsRow {
  prefix: string;
  nameEn: string;
  /** DataBundle-derived stats and per-file sizes. */
  data: V2DataVolumeStats;
  /** InsightsBundle-derived trip-volume summary. */
  insights: V2InsightsSummary;
  /** ShapesBundle-derived geometry counts. */
  shapes: V2ShapesSummary;
}

export interface AnalyzeV2OutputsInput {
  prefix: string;
  nameEn: string;
  dataBundle: DataBundle;
  /** `null` when insights.json is missing for this source. */
  insights: InsightsBundle | null;
  /** `null` when shapes.json is missing for this source. */
  shapesBundle: ShapesBundle | null;
  fileSizes: FileSizeStats;
  gzipSizes: FileSizeStats;
}

export function analyzeV2Outputs(input: AnalyzeV2OutputsInput): V2OutputsRow {
  const data = analyzeV2DataVolume({
    prefix: input.prefix,
    nameEn: input.nameEn,
    dataBundle: input.dataBundle,
    fileSizes: input.fileSizes,
    gzipSizes: input.gzipSizes,
  });
  const insights = analyzeV2InsightsSummary({
    prefix: input.prefix,
    nameEn: input.nameEn,
    insights: input.insights,
  });
  const shapes = analyzeV2ShapesSummary({
    prefix: input.prefix,
    nameEn: input.nameEn,
    shapesBundle: input.shapesBundle,
  });
  return { prefix: input.prefix, nameEn: input.nameEn, data, insights, shapes };
}

export interface AnalyzeV2GlobalInput {
  bundle: GlobalInsightsBundle | null;
  fileSize: number | null;
  gzipSize: number | null;
}

export function analyzeV2GlobalSummary(input: AnalyzeV2GlobalInput): GlobalInsightsBundleSummary {
  return analyzeV2GlobalInsightsSummary({
    bundle: input.bundle,
    fileSize: input.fileSize,
    gzipSize: input.gzipSize,
  });
}

function isDataSectionName(name: V2OutputsSectionName): name is V2DataVolumeSectionName {
  return (V2_DATA_VOLUME_SECTION_NAMES as readonly string[]).includes(name);
}

function isInsightsSectionName(name: V2OutputsSectionName): name is V2InsightsSummarySectionName {
  return (V2_INSIGHTS_SUMMARY_SECTION_NAMES as readonly string[]).includes(name);
}

function isShapesSectionName(name: V2OutputsSectionName): name is V2ShapesSummarySectionName {
  return (V2_SHAPES_SUMMARY_SECTION_NAMES as readonly string[]).includes(name);
}

function isGlobalSectionName(
  name: V2OutputsSectionName,
): name is V2GlobalInsightsSummarySectionName {
  return (V2_GLOBAL_INSIGHTS_SUMMARY_SECTION_NAMES as readonly string[]).includes(name);
}

function wrapSection(title: string, description: string, body: string): string {
  return [`## ${title}`, '', description, '', body].join('\n');
}

function renderSection(
  rows: V2OutputsRow[],
  global: GlobalInsightsBundleSummary,
  sectionName: V2OutputsSectionName,
): string {
  if (isDataSectionName(sectionName)) {
    const section = V2_DATA_VOLUME_SECTIONS[sectionName];
    return wrapSection(
      section.title,
      section.description,
      section.render(rows.map((row) => row.data)),
    );
  }
  if (isInsightsSectionName(sectionName)) {
    const section = V2_INSIGHTS_SUMMARY_SECTIONS[sectionName];
    return wrapSection(
      section.title,
      section.description,
      section.render(rows.map((row) => row.insights)),
    );
  }
  if (isShapesSectionName(sectionName)) {
    const section = V2_SHAPES_SUMMARY_SECTIONS[sectionName];
    return wrapSection(
      section.title,
      section.description,
      section.render(rows.map((row) => row.shapes)),
    );
  }
  if (isGlobalSectionName(sectionName)) {
    const section = V2_GLOBAL_INSIGHTS_SUMMARY_SECTIONS[sectionName];
    return wrapSection(section.title, section.description, section.render(global));
  }
  const _exhaustive: never = sectionName;
  return _exhaustive;
}

function formatOverallSummary(rows: V2OutputsRow[], global: GlobalInsightsBundleSummary): string {
  let totalRaw = 0;
  let totalGzip = 0;
  let totalStops = 0;
  let totalRoutes = 0;
  let totalTripPatterns = 0;
  let withInsights = 0;
  let withShapes = 0;
  for (const row of rows) {
    totalRaw += row.data.fileSizes.total;
    totalGzip += row.data.gzipSizes.total;
    totalStops += row.data.counts.stops ?? 0;
    totalRoutes += row.data.counts.routes ?? 0;
    totalTripPatterns += row.data.counts.tripPatterns ?? 0;
    // Count actual InsightsBundle presence — not `tripsTotal !== null`,
    // which would also exclude a present bundle that simply has no
    // `tripPatternStats` section.
    if (row.insights.bundlePresent) {
      withInsights += 1;
    }
    if (row.shapes.shapes.routes !== null) {
      withShapes += 1;
    }
  }
  const globalLabel =
    global.fileSize === null
      ? 'absent'
      : `${formatBytes(global.fileSize)} (gzip ${formatBytes(global.gzipSize)})`;
  return [
    '## Overall summary',
    '',
    'Per-source overview of payload size, DataBundle entity counts, and InsightsBundle / ShapesBundle availability. Cross-source GlobalInsightsBundle status is appended.',
    '',
    `sources=${rows.length}, sourcesWithInsights=${withInsights}, sourcesWithShapes=${withShapes}`,
    `totalRaw=${formatBytes(totalRaw)}, totalGzip=${formatBytes(totalGzip)}, ratio=${formatCompressionRatio(totalRaw, totalGzip)}`,
    `entities: stops=${totalStops}, routes=${totalRoutes}, tripPatterns=${totalTripPatterns}`,
    `global/insights.json: ${globalLabel}`,
  ].join('\n');
}

export function formatV2OutputsAnalysis(
  rows: V2OutputsRow[],
  global: GlobalInsightsBundleSummary,
  options: {
    analyzedAt?: Date;
    sections?: V2OutputsSectionName[];
    sourceRootLabel?: string;
  } = {},
): string {
  if (rows.length === 0 && global.fileSize === null) {
    return 'No v2 outputs found.';
  }
  const analyzedAt = options.analyzedAt ?? new Date();
  // Stable ascending sort by `prefix`. This is a *summarise* tool —
  // its row order should be reproducible across runs, not driven by
  // an analytic dimension (size, freq, etc.). Same key for every
  // per-source section so rows align horizontally across the report.
  const sorted = [...rows].sort((a, b) => a.prefix.localeCompare(b.prefix));
  const requestedSections =
    options.sections === undefined || options.sections.length === 0
      ? V2_OUTPUTS_SECTION_NAMES
      : options.sections;
  const sourceRootLabel = options.sourceRootLabel ?? 'public/data-v2';
  const renderedSections = requestedSections.map((sectionName) =>
    renderSection(sorted, global, sectionName),
  );
  return [
    '# Athenai Transit — V2 outputs summary',
    '',
    `# Analyzed at: ${analyzedAt.toISOString()}`,
    `# Reads ${sourceRootLabel}/{prefix}/{data,insights,shapes}.json and ${sourceRootLabel}/global/insights.json`,
    '# Sizes are in KB (1024 B) and MB (1024 KB); shapes "-" means no shapes.json on disk.',
    "# 'tripsTotal' = Σ tripPatternStats[sg][p].freq (= trips.txt row count, day-agnostic); 'tripsMax' = busiest sg's total.",
    '',
    formatOverallSummary(sorted, global),
    '',
    ...renderedSections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
  ].join('\n');
}
