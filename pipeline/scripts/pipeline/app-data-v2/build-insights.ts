#!/usr/bin/env -S npx tsx

/**
 * Build v2 InsightsBundle from an existing DataBundle.
 *
 * Each invocation processes a single source. For batch processing,
 * use `--targets <file>`.
 *
 * Input:  pipeline/workspace/_build/data-v2/{prefix}/data.json (DataBundle)
 * Output: pipeline/workspace/_build/data-v2/{prefix}/insights.json (InsightsBundle)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --list
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import { V2_OUTPUT_DIR } from '../../../src/lib/paths';
import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import {
  listOdptTrainSourceNames,
  loadOdptTrainSource,
} from '../../../src/lib/resources/load-odpt-train-sources';
import { collectAllKsjTargets } from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import { buildServiceGroups } from '../../../src/lib/pipeline/app-data-v2/build-service-groups';
import { writeInsightsBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline/pipeline-utils';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Source name → prefix resolution
// ---------------------------------------------------------------------------

/**
 * Build a map from source name (outDir) to prefix.
 * Loads GTFS, ODPT Train, and KSJ source definitions.
 */
async function buildSourcePrefixMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const name of listGtfsSourceNames()) {
    const source = await loadGtfsSource(name);
    map.set(name, source.pipeline.prefix);
  }

  const odptNames = await listOdptTrainSourceNames();
  for (const name of odptNames) {
    const source = await loadOdptTrainSource(name);
    if (!map.has(name)) {
      map.set(name, source.prefix);
    }
  }

  const ksjTargets = await collectAllKsjTargets();
  for (const t of ksjTargets) {
    if (!map.has(t.name)) {
      map.set(t.name, t.prefix);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

/**
 * Build InsightsBundle for a single source prefix.
 *
 * Reads the calendar section from the existing data.json and derives
 * service groups. Returns false if data.json does not exist (skip).
 */
function buildSourceInsights(prefix: string): boolean {
  const sourceDir = join(OUTPUT_DIR, prefix);
  const dataPath = join(sourceDir, 'data.json');

  if (!existsSync(dataPath)) {
    console.log(`  Skipped: ${dataPath} not found`);
    return false;
  }

  console.log(`  Reading: ${dataPath}`);
  const raw = readFileSync(dataPath, 'utf-8');
  const bundle = JSON.parse(raw) as DataBundle;

  const serviceGroups = buildServiceGroups(bundle.calendar.data);
  console.log(
    `  Service groups: ${serviceGroups.length} (${serviceGroups.map((g) => g.key).join(', ')})`,
  );

  writeInsightsBundle(sourceDir, serviceGroups);
  console.log(`  Written: ${sourceDir}/insights.json`);
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --targets <file>',
  );
  console.log('       npx tsx pipeline/scripts/pipeline/app-data-v2/build-insights.ts --list\n');
  console.log('Options:');
  console.log('  --targets <file>  Batch build from a target list file (.ts)');
  console.log('  --list            List available source names (with data.json)');
  console.log('  --help            Show this help message');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const arg = parseCliArg();

  if (arg.kind === 'help') {
    printUsage();
    return;
  }

  if (arg.kind === 'list') {
    const prefixMap = await buildSourcePrefixMap();
    const names = [...prefixMap.entries()]
      .filter(([, prefix]) => existsSync(join(OUTPUT_DIR, prefix, 'data.json')))
      .map(([name]) => name)
      .sort();
    console.log('Available sources (with data.json):\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    if (names.length === 0) {
      console.log('  (none — run build-from-gtfs.ts first)');
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-v2-insights (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-insights.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode — resolve source name to prefix
  const prefixMap = await buildSourcePrefixMap();
  const prefix = prefixMap.get(arg.name);

  if (!prefix) {
    console.error(`Error: Unknown source name "${arg.name}".`);
    console.error('  Use --list to see available sources.');
    console.log('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Prefix: ${prefix}`);
  console.log(`  Input:  ${join(OUTPUT_DIR, prefix)}/data.json`);
  console.log(`  Output: ${join(OUTPUT_DIR, prefix)}/insights.json`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceInsights(prefix);
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    const durationMs = performance.now() - t0;
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Exit code: ${code} (${label})\n=== ${arg.name} [END] ===`);
  }
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
