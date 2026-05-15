#!/usr/bin/env -S npx tsx

/**
 * Summarise v2 pipeline outputs across all bundle files.
 *
 * Reads `public/data-v2/<source>/data.json`, `insights.json`, and
 * optionally `shapes.json` for each source under `public/data-v2/`,
 * measures raw and gzip-compressed sizes, and emits a per-source
 * text report combining DataBundle entity counts with InsightsBundle
 * trip-volume figures.
 *
 * Structure: this entry only does I/O orchestration. All analysis
 * and rendering logic lives under `dev-lib/v2-outputs-summary.ts`,
 * which delegates to per-bundle sub libs (v2-data-summary.ts,
 * v2-insights-summary.ts, ...).
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts                # all sources
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts <source>       # single source
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts <a> <b>        # selected sources
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts --list-sources
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts --list-sections
 *   npx tsx pipeline/scripts/dev/summarize-v2-outputs.ts --section file-sizes
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
} from '@contracts/data/transit-v2-json';
import { PIPELINE_ROOT } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';
import {
  listGtfsSourceNames,
  loadAllGtfsSources,
  loadGtfsSource,
} from '../../src/lib/resources/load-gtfs-sources';
import {
  listOdptJsonSourceNames,
  loadAllOdptJsonSources,
  loadOdptJsonSource,
} from '../../src/lib/resources/load-odpt-json-sources';
import { truncateSectionDescription } from './dev-lib/analysis-sections';
import { parseArgsForMultiSources } from './dev-lib/parse-args';
import type { FileSizeStats } from './dev-lib/v2-data-summary';
import type { GlobalInsightsBundleSummary } from './dev-lib/v2-global-insights-summary';
import {
  analyzeV2GlobalSummary,
  analyzeV2Outputs,
  formatV2OutputsAnalysis,
  V2_OUTPUTS_SECTION_DESCRIPTIONS,
  V2_OUTPUTS_SECTION_NAMES,
  type V2OutputsRow,
  type V2OutputsSectionName,
} from './dev-lib/v2-outputs-summary';

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');

interface SourceName {
  nameEn: string;
}

function isV2OutputsSectionName(value: string): value is V2OutputsSectionName {
  return (V2_OUTPUTS_SECTION_NAMES as readonly string[]).includes(value);
}

/**
 * List source prefixes under public/data-v2 that have a data.json.
 *
 * `insights.json` is required per-source. `shapes.json` remains
 * optional and its absence surfaces in the report rather than
 * filtering the source out.
 */
function listSourcePrefixes(): string[] {
  return readdirSync(PUBLIC_V2_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'global')
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(PUBLIC_V2_DIR, name, 'data.json')))
    .sort();
}

function readFileIfExists(path: string): Buffer | null {
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path);
}

interface MeasuredSource {
  dataBundle: DataBundle;
  insights: InsightsBundle;
  shapesBundle: ShapesBundle | null;
  fileSizes: FileSizeStats;
  gzipSizes: FileSizeStats;
}

function measureSource(prefix: string): MeasuredSource {
  const dir = join(PUBLIC_V2_DIR, prefix);
  const dataPath = join(dir, 'data.json');
  const insightsPath = join(dir, 'insights.json');
  const shapesPath = join(dir, 'shapes.json');

  const dataBuffer = readFileIfExists(dataPath);
  if (dataBuffer === null) {
    throw new Error(`data.json not found for prefix: ${prefix} (${dataPath})`);
  }
  const insightsBuffer = readFileIfExists(insightsPath);
  if (insightsBuffer === null) {
    throw new Error(`insights.json not found for prefix: ${prefix} (${insightsPath})`);
  }
  const shapesBuffer = readFileIfExists(shapesPath);

  // Optional files (shapes.json) measure as `null` when absent —
  // `0` is reserved for a file that exists but is empty. The buffers
  // are already in memory, so `.length` is the size with no extra
  // filesystem stat.
  const dataSize = dataBuffer.length;
  const insightsSize = insightsBuffer.length;
  const shapesSize = shapesBuffer === null ? null : shapesBuffer.length;

  const gzipData = gzipSync(dataBuffer).length;
  const gzipInsights = gzipSync(insightsBuffer).length;
  const gzipShapes = shapesBuffer === null ? null : gzipSync(shapesBuffer).length;

  const fileSizes: FileSizeStats = {
    data: dataSize,
    insights: insightsSize,
    shapes: shapesSize,
    total: dataSize + (insightsSize ?? 0) + (shapesSize ?? 0),
  };
  const gzipSizes: FileSizeStats = {
    data: gzipData,
    insights: gzipInsights,
    shapes: gzipShapes,
    total: gzipData + (gzipInsights ?? 0) + (gzipShapes ?? 0),
  };

  const dataBundle = JSON.parse(dataBuffer.toString('utf-8')) as DataBundle;
  if (dataBundle.kind !== 'data') {
    throw new Error(`Expected data bundle at ${dataPath} but got kind=${String(dataBundle.kind)}`);
  }
  const insights = JSON.parse(insightsBuffer.toString('utf-8')) as InsightsBundle;
  if (insights.kind !== 'insights') {
    throw new Error(
      `Expected insights bundle at ${insightsPath} but got kind=${String(insights.kind)}`,
    );
  }
  let shapesBundle: ShapesBundle | null = null;
  if (shapesBuffer !== null) {
    const parsed = JSON.parse(shapesBuffer.toString('utf-8')) as ShapesBundle;
    if (parsed.kind !== 'shapes') {
      throw new Error(
        `Expected shapes bundle at ${shapesPath} but got kind=${String(parsed.kind)}`,
      );
    }
    shapesBundle = parsed;
  }

  return { dataBundle, insights, shapesBundle, fileSizes, gzipSizes };
}

/**
 * Load and summarise the cross-source GlobalInsightsBundle.
 *
 * Always invoked regardless of which per-source prefixes are
 * requested. When the file is absent the summary carries nulls,
 * surfacing the absence in the report rather than failing the run.
 */
function measureGlobalSummary(): GlobalInsightsBundleSummary {
  const path = join(PUBLIC_V2_DIR, 'global', 'insights.json');
  const buffer = readFileIfExists(path);
  if (buffer === null) {
    return analyzeV2GlobalSummary({ bundle: null, fileSize: null, gzipSize: null });
  }
  const parsed = JSON.parse(buffer.toString('utf-8')) as GlobalInsightsBundle;
  if (parsed.kind !== 'global-insights') {
    throw new Error(
      `Expected global-insights bundle at ${path} but got kind=${String(parsed.kind)}`,
    );
  }
  return analyzeV2GlobalSummary({
    bundle: parsed,
    fileSize: buffer.length,
    gzipSize: gzipSync(buffer).length,
  });
}

/** Build prefix -> nameEn map from every resource definition (all mode). */
async function buildNameMapAll(): Promise<Map<string, SourceName>> {
  const map = new Map<string, SourceName>();
  const gtfs = await loadAllGtfsSources();
  for (const def of gtfs) {
    map.set(def.pipeline.prefix, { nameEn: def.resource.nameEn });
  }
  const odpt = await loadAllOdptJsonSources();
  for (const def of odpt) {
    map.set(def.pipeline.prefix, { nameEn: def.resource.nameEn });
  }
  return map;
}

/** Lazy lookup for a single prefix (source mode). */
async function resolveNameForPrefix(prefix: string): Promise<SourceName | null> {
  for (const name of listGtfsSourceNames()) {
    const def = await loadGtfsSource(name);
    if (def.pipeline.prefix === prefix) {
      return { nameEn: def.resource.nameEn };
    }
  }
  for (const name of listOdptJsonSourceNames()) {
    const def = await loadOdptJsonSource(name);
    if (def.pipeline.prefix === prefix) {
      return { nameEn: def.resource.nameEn };
    }
  }
  return null;
}

function printHelp(): void {
  console.log('Usage: summarize-v2-outputs.ts [source-name ...] [--section <name> ...]');
  console.log('  No args    Summarise all public/data-v2 sources (excluding global/)');
  console.log('  <source>   Summarise one or more sources (by prefix)');
  console.log('  --list-sources  List available source prefixes');
  console.log('  --list-sections List available section names with short descriptions');
  console.log('  --section <name> Limit output to the selected section (repeatable)');
  console.log('  --help     Show this help');
}

function printSectionList(): void {
  const nameWidth = V2_OUTPUTS_SECTION_DESCRIPTIONS.reduce(
    (max, entry) => Math.max(max, entry.name.length),
    0,
  );
  for (const entry of V2_OUTPUTS_SECTION_DESCRIPTIONS) {
    const description = truncateSectionDescription(entry.description, 72);
    console.log(`${entry.name.padEnd(nameWidth)}  ${description}`);
  }
}

async function main(): Promise<void> {
  const mode = parseArgsForMultiSources(process.argv.slice(2));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  const invalidSections = mode.sections.filter((section) => !isV2OutputsSectionName(section));
  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }
  const sections = mode.sections as V2OutputsSectionName[];

  // `--list-sections` needs no output files — handle it before any
  // filesystem access so it works even when public/data-v2 has not
  // been generated yet.
  if (mode.kind === 'list' && mode.target === 'sections') {
    printSectionList();
    return;
  }

  const prefixes = listSourcePrefixes();

  if (mode.kind === 'list') {
    // mode.target === 'sources'
    for (const p of prefixes) {
      console.log(p);
    }
    return;
  }

  // Global insights is always loaded — it is not per-source so it
  // does not participate in the `mode.names` filter. When absent
  // from disk the summary carries nulls and the section reports
  // "not found".
  const global = measureGlobalSummary();

  if (mode.kind === 'sources') {
    const missingSources = mode.names.filter((name) => !prefixes.includes(name));
    if (missingSources.length > 0) {
      console.error(`Source not found: ${missingSources.join(', ')}`);
      console.error('Run with --list-sources to see available sources.');
      process.exitCode = 1;
      return;
    }
    const rows: V2OutputsRow[] = [];
    for (const prefix of mode.names) {
      const name = await resolveNameForPrefix(prefix);
      if (name === null) {
        console.warn(`Could not resolve resource name for source: ${prefix}`);
      }
      const nameEn = name?.nameEn ?? prefix;
      const measured = measureSource(prefix);
      rows.push(analyzeV2Outputs({ prefix, nameEn, ...measured }));
    }
    console.log(
      formatV2OutputsAnalysis(rows, global, {
        sections,
        sourceRootLabel: 'public/data-v2',
      }),
    );
    return;
  }

  // All-sources mode
  const nameMap = await buildNameMapAll();
  const rows: V2OutputsRow[] = [];
  for (const prefix of prefixes) {
    const nameEn = nameMap.get(prefix)?.nameEn ?? prefix;
    const measured = measureSource(prefix);
    rows.push(analyzeV2Outputs({ prefix, nameEn, ...measured }));
  }
  console.log(
    formatV2OutputsAnalysis(rows, global, {
      sections,
      sourceRootLabel: 'public/data-v2',
    }),
  );
}

runMain(main);
