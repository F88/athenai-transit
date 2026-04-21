#!/usr/bin/env -S npx tsx

/**
 * Analyze per-source v2 InsightsBundle files.
 *
 * Reads `public/data-v2/<source>/insights.json` and prints duration
 * statistics (mean, median, p90, std, min, max, pct trips > 60 min) for
 * each source, in both per-pattern and per-trip (freq-weighted) views.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts              # all sources
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts <source>     # single source
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts <a> <b>      # selected sources
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts --list-sources
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts --help       # show usage
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { InsightsBundle } from '../../../src/types/data/transit-v2-json';
import {
  analyzeInsightsBundle,
  formatInsightsAnalysis,
  V2_INSIGHTS_SECTIONS,
  V2_INSIGHTS_SECTION_NAMES,
  type V2InsightsSectionName,
  type InsightsSourceStats,
} from './dev-lib/v2-insights-analysis';
import { formatAnalysisSectionList } from './dev-lib/analysis-sections';
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
import { PIPELINE_ROOT } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';
import { parseArgsForMultiSources } from './dev-lib/parse-args';

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');

function isV2InsightsSectionName(value: string): value is V2InsightsSectionName {
  return (V2_INSIGHTS_SECTION_NAMES as readonly string[]).includes(value);
}

interface SourceName {
  nameEn: string;
}

/** List source prefixes under public/data-v2 that have an insights.json. */
function listSourcePrefixes(): string[] {
  return readdirSync(PUBLIC_V2_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'global')
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(PUBLIC_V2_DIR, name, 'insights.json')))
    .sort();
}

function readInsights(source: string): InsightsBundle {
  const bundlePath = join(PUBLIC_V2_DIR, source, 'insights.json');
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf-8')) as InsightsBundle;
  // Defensive: catch corrupted or mis-named bundles early so the
  // analyser never tries to interpret e.g. a global-insights bundle
  // through the per-source code path.
  if (bundle.kind !== 'insights') {
    throw new Error(
      `Expected insights bundle at ${bundlePath} but got kind=${String(bundle.kind)}`,
    );
  }
  return bundle;
}

/**
 * Build a prefix → nameEn map by loading every resource definition. Used
 * for full-run mode.
 *
 * The two `loadAll*` calls are awaited sequentially (not via
 * `Promise.all`) to follow the established convention for loading
 * local TypeScript resource definitions in this repo. Dynamic
 * `import()` of local files is effectively instantaneous, so
 * parallelisation provides no measurable benefit and the sequential
 * form keeps the call sites uniform with `describe-resources.ts` /
 * `extract-shapes-from-ksj.ts`.
 */
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

/**
 * Load resource definitions lazily until one with matching prefix is found.
 * Used for --source mode to avoid loading every definition when the caller
 * only cares about one entry.
 */
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
  console.log('Usage: analyze-v2-insights.ts [source-name ...] [--section <name> ...]');
  console.log('  No args    Analyze all public/data-v2 sources (excluding global/)');
  console.log('  <source>   Analyze one or more sources (by prefix)');
  console.log('  --list-sources  List available sources');
  console.log('  --list-sections List available section names with short descriptions');
  console.log('  --section <name> Limit output to the selected section (repeatable)');
  console.log('  --help     Show this help');
}

async function main(): Promise<void> {
  const mode = parseArgsForMultiSources(process.argv.slice(2));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  const invalidSections = mode.sections.filter((section) => !isV2InsightsSectionName(section));
  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }
  const sections = mode.sections as V2InsightsSectionName[];

  const prefixes = listSourcePrefixes();

  if (mode.kind === 'list') {
    if (mode.target === 'sections') {
      for (const line of formatAnalysisSectionList(
        V2_INSIGHTS_SECTION_NAMES,
        V2_INSIGHTS_SECTIONS,
      )) {
        console.log(line);
      }
      return;
    }
    for (const p of prefixes) {
      console.log(p);
    }
    return;
  }

  if (mode.kind === 'sources') {
    const missingSources = mode.names.filter((name) => !prefixes.includes(name));
    if (missingSources.length > 0) {
      console.error(`Source not found: ${missingSources.join(', ')}`);
      console.error('Run with --list-sources to see available sources.');
      process.exitCode = 1;
      return;
    }

    const rows: InsightsSourceStats[] = [];
    for (const sourceName of mode.names) {
      const name = await resolveNameForPrefix(sourceName);
      if (name === null) {
        console.warn(`Could not resolve resource name for source: ${sourceName}`);
      }
      const nameEn = name?.nameEn ?? sourceName;
      const bundle = readInsights(sourceName);
      const row = analyzeInsightsBundle(sourceName, nameEn, bundle);
      if (row === null) {
        console.error(`No tripPatternStats data for source: ${sourceName}`);
        process.exitCode = 1;
        return;
      }
      rows.push(row);
    }

    console.log(formatInsightsAnalysis(rows, { sections }));
    return;
  }

  // All-sources mode
  const nameMap = await buildNameMapAll();
  const rows: InsightsSourceStats[] = [];
  for (const prefix of prefixes) {
    const bundle = readInsights(prefix);
    const nameEn = nameMap.get(prefix)?.nameEn ?? prefix;
    const row = analyzeInsightsBundle(prefix, nameEn, bundle);
    if (row === null) {
      console.warn(`Skipping ${prefix}: no tripPatternStats data`);
      continue;
    }
    rows.push(row);
  }
  console.log(formatInsightsAnalysis(rows, { sections }));
}

runMain(main);
