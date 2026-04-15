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
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts --list       # list sources
 *   npx tsx pipeline/scripts/dev/analyze-v2-insights.ts --help       # show usage
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { InsightsBundle } from '../../../src/types/data/transit-v2-json';
import {
  analyzeInsightsBundle,
  formatInsightsAnalysis,
  type InsightsSourceStats,
} from './dev-lib/v2-insights-analysis';
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

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');

type CliMode =
  | { kind: 'help' }
  | { kind: 'list' }
  | { kind: 'all' }
  | { kind: 'source'; name: string };

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
 */
async function buildNameMapAll(): Promise<Map<string, SourceName>> {
  const map = new Map<string, SourceName>();
  const [gtfs, odpt] = await Promise.all([loadAllGtfsSources(), loadAllOdptJsonSources()]);
  for (const def of gtfs) {
    map.set(def.pipeline.prefix, { nameEn: def.resource.nameEn });
  }
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

function parseArgs(args: string[]): CliMode {
  if (args.length === 0) {
    return { kind: 'all' };
  }
  if (args.length === 1) {
    const [a] = args;
    if (a === '--help' || a === '-h') {
      return { kind: 'help' };
    }
    if (a === '--list') {
      return { kind: 'list' };
    }
    if (!a.startsWith('-')) {
      return { kind: 'source', name: a };
    }
  }
  return { kind: 'help' };
}

function printHelp(): void {
  console.log('Usage: analyze-v2-insights.ts [source-name]');
  console.log('  No args    Analyze all public/data-v2 sources (excluding global/)');
  console.log('  <source>   Analyze a single source (by prefix)');
  console.log('  --list     List available sources');
  console.log('  --help     Show this help');
}

async function main(): Promise<void> {
  const mode = parseArgs(process.argv.slice(2));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  const prefixes = listSourcePrefixes();

  if (mode.kind === 'list') {
    for (const p of prefixes) {
      console.log(p);
    }
    return;
  }

  if (mode.kind === 'source') {
    if (!prefixes.includes(mode.name)) {
      console.error(`Source not found: ${mode.name}`);
      console.error('Run with --list to see available sources.');
      process.exitCode = 1;
      return;
    }
    const name = await resolveNameForPrefix(mode.name);
    if (name === null) {
      console.warn(`Could not resolve resource name for source: ${mode.name}`);
    }
    const nameEn = name?.nameEn ?? mode.name;
    const bundle = readInsights(mode.name);
    const row = analyzeInsightsBundle(mode.name, nameEn, bundle);
    if (row === null) {
      console.error(`No tripPatternStats data for source: ${mode.name}`);
      process.exitCode = 1;
      return;
    }
    console.log(formatInsightsAnalysis([row]));
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
  console.log(formatInsightsAnalysis(rows));
}

runMain(main);
