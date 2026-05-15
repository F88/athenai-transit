/**
 * Pure helpers for summarising per-source v2 ShapesBundle files.
 *
 * Minimum-viable stub: reports the number of routes that have shapes,
 * the total polyline count, and the total point count. These three
 * numbers double as a proxy for "render cost on the map" since
 * polyline / point counts drive Canvas / SVG vertex processing.
 *
 * File size for `shapes.json` is already covered by
 * `v2-data-summary.ts`'s file-sizes / gzip-sizes sections, so it is
 * intentionally NOT duplicated here.
 *
 * The CLI orchestrator is responsible for locating sources and reading
 * files. The functions here are pure and deterministic.
 */

import type { ShapesBundle } from '@contracts/data/transit-v2-json';

import { getDistanceKmLight } from '../../../src/lib/geo-utils';
import { type AnalysisSectionDefinition } from './analysis-sections';
import { renderTable } from './render-utils';

/**
 * Per-source shape-volume summary derived from a single ShapesBundle.
 *
 * All four fields are `null` when shapes.json is missing for the
 * source (distinguishable from `0` which means the file exists but is
 * empty).
 *
 * `totalLengthKm` is the sum of Haversine distances between
 * consecutive points across every polyline. It surfaces the physical
 * scale of the network (= draw distance, tile prefetch range) which
 * the per-source point count alone cannot reveal — a dense city
 * network can have more points than a long-distance rail line of the
 * same physical extent.
 *
 * `routes` is duplicated in the generic `ShapesBundleCounts` view
 * (= the same number) but kept here so the volume section is
 * self-contained.
 */
export interface ShapesBundleSummary {
  /** Number of routes that carry shape geometry. */
  routes: number | null;
  /** Total polyline count across every route. */
  polylines: number | null;
  /** Total point count across every polyline. */
  points: number | null;
  /** Sum of Haversine segment lengths in km across every polyline. */
  totalLengthKm: number | null;
}

/**
 * Counts per ShapesBundle top-level section.
 *
 * Same generic rule as DataBundleCounts: `.data` is either an array
 * (length) or a Record (top-level key count). For ShapesBundle there
 * is only one section (`shapes`) so this collapses to a single
 * column matching DataBundle counts' shape ("which top-level keys
 * exist and how big is each").
 *
 * Optional shapes.json absent from disk results in `shapes: 0`. The
 * CLI orchestrator sets the entire `shapes` slot rather than
 * propagating `null` through every count, mirroring how DataBundle
 * counts treat missing-section semantics.
 */
export type ShapesBundleCounts = Record<string, number>;

export interface V2ShapesSummary {
  prefix: string;
  nameEn: string;
  counts: ShapesBundleCounts;
  shapes: ShapesBundleSummary;
}

export interface AnalyzeV2ShapesSummaryInput {
  prefix: string;
  nameEn: string;
  /** `null` when shapes.json is missing for this source. */
  shapesBundle: ShapesBundle | null;
}

export type V2ShapesSummarySectionName = 'shapes-counts' | 'shapes-volume';

const SHAPES_BUNDLE_EXCLUDED_KEYS = new Set(['bundle_version', 'kind']);

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

function buildShapesBundleCounts(bundle: ShapesBundle | null): ShapesBundleCounts {
  const result: ShapesBundleCounts = { shapes: 0 };
  if (bundle === null) {
    return result;
  }
  for (const [key, value] of Object.entries(bundle)) {
    if (SHAPES_BUNDLE_EXCLUDED_KEYS.has(key)) {
      continue;
    }
    result[key] = countSection(value);
  }
  return result;
}

export type V2ShapesSummarySectionDefinition = AnalysisSectionDefinition<
  V2ShapesSummary[],
  V2ShapesSummarySectionName
>;

export function analyzeV2ShapesSummary(input: AnalyzeV2ShapesSummaryInput): V2ShapesSummary {
  const bundle = input.shapesBundle;
  const counts = buildShapesBundleCounts(bundle);
  if (bundle === null) {
    return {
      prefix: input.prefix,
      nameEn: input.nameEn,
      counts,
      shapes: { routes: null, polylines: null, points: null, totalLengthKm: null },
    };
  }
  let routes = 0;
  let polylines = 0;
  let points = 0;
  let totalLengthKm = 0;
  for (const routePolylines of Object.values(bundle.shapes.data)) {
    routes += 1;
    polylines += routePolylines.length;
    for (const polyline of routePolylines) {
      points += polyline.length;
      // Sum Haversine segment lengths within this polyline.
      // Allocation-free helper keeps total cost linear in the point count.
      for (let i = 1; i < polyline.length; i++) {
        const prev = polyline[i - 1];
        const curr = polyline[i];
        totalLengthKm += getDistanceKmLight(prev[0], prev[1], curr[0], curr[1]);
      }
    }
  }
  return {
    prefix: input.prefix,
    nameEn: input.nameEn,
    counts,
    shapes: { routes, polylines, points, totalLengthKm },
  };
}

function formatInteger(value: number | null): string {
  return value === null ? '-' : String(value);
}

/**
 * Format a distance in km with 2-decimal precision; `null` → dash.
 *
 * 2 decimals (= 10 m granularity) matches the precision of the
 * Haversine helper itself and keeps the column width predictable.
 */
function formatKm(value: number | null): string {
  return value === null ? '-' : value.toFixed(2);
}

function sumNullableNumber(
  results: V2ShapesSummary[],
  select: (result: V2ShapesSummary) => number | null,
): number {
  return results.reduce((acc, result) => {
    const value = select(result);
    return acc + (value ?? 0);
  }, 0);
}

function collectShapesBundleKeys(results: V2ShapesSummary[]): string[] {
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

function formatShapesCountsSectionBody(results: V2ShapesSummary[]): string {
  const shapesKeys = collectShapesBundleKeys(results);
  const header = ['source', 'prefix', ...shapesKeys];
  const rows: string[][] = results.map((result) => [
    result.nameEn,
    result.prefix,
    ...shapesKeys.map((key) => String(result.counts[key] ?? 0)),
  ]);
  const sumPerKey = (key: string): number =>
    results.reduce((acc, r) => acc + (r.counts[key] ?? 0), 0);
  rows.push(['totals', '', ...shapesKeys.map((key) => String(sumPerKey(key)))]);
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sections=${shapesKeys.length}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, 2),
  ];
  return lines.join('\n');
}

function formatShapesVolumeSectionBody(results: V2ShapesSummary[]): string {
  const header = ['source', 'prefix', 'routes', 'polylines', 'points', 'totalLengthKm'];
  const rows = results.map((result) => [
    result.nameEn,
    result.prefix,
    formatInteger(result.shapes.routes),
    formatInteger(result.shapes.polylines),
    formatInteger(result.shapes.points),
    formatKm(result.shapes.totalLengthKm),
  ]);
  rows.push([
    'totals',
    '',
    String(sumNullableNumber(results, (r) => r.shapes.routes)),
    String(sumNullableNumber(results, (r) => r.shapes.polylines)),
    String(sumNullableNumber(results, (r) => r.shapes.points)),
    formatKm(sumNullableNumber(results, (r) => r.shapes.totalLengthKm)),
  ]);
  const missing = results.filter((result) => result.shapes.routes === null).length;
  const lines = [
    '### Totals',
    '',
    `sources=${results.length}, sourcesMissingShapes=${missing}`,
    '',
    '### Summary',
    '',
    renderTable(header, rows, 2),
  ];
  return lines.join('\n');
}

export const V2_SHAPES_SUMMARY_SECTIONS = {
  'shapes-counts': {
    name: 'shapes-counts',
    title: 'ShapesBundle counts (shapes.json)',
    description: 'Entity counts derived from each source ShapesBundle.',
    render: formatShapesCountsSectionBody,
  },
  'shapes-volume': {
    name: 'shapes-volume',
    title: 'ShapesBundle volume (shapes.json)',
    description:
      'Per-source shape volume detail: routes / polylines / points (render-cost proxies) plus totalLengthKm (network physical scale via allocation-free Haversine).',
    render: formatShapesVolumeSectionBody,
  },
} satisfies Record<V2ShapesSummarySectionName, V2ShapesSummarySectionDefinition>;

export const V2_SHAPES_SUMMARY_SECTION_NAMES: readonly V2ShapesSummarySectionName[] = [
  'shapes-counts',
  'shapes-volume',
];
