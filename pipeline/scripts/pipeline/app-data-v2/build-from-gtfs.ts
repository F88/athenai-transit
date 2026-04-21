#!/usr/bin/env -S npx tsx

/**
 * Build v2 DataBundle JSON from a GTFS SQLite database.
 *
 * Each invocation processes a single GTFS source. For batch processing,
 * use `--targets <file>`.
 *
 * Input:  pipeline/workspace/_build/db/{outDir}.db (built by build-gtfs-db.ts)
 * Output: pipeline/workspace/_build/data-v2/{prefix}/data.json (DataBundle)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --list
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline/pipeline-utils';
import type { Provider } from '../../../src/types/resource-common';
import { writeDataBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import { extractAgenciesV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-agencies';
import { extractCalendarV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-calendar';
import { extractFeedInfoV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-feed-info';
import { extractLookupV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-lookup';
import { extractRoutesV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-routes';
import { extractStopsV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-stops';
import { extractTripPatternsAndTimetable } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-timetable';
import { extractTranslationsV2 } from '../../../src/lib/pipeline/app-data-v2/gtfs/extract-translations';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, V2_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildSource {
  outDir: string;
  prefix: string;
  nameEn: string;
  routeColorFallbacks: Record<string, string>;
  provider: Provider;
}

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceDataBundle(source: BuildSource): void {
  const dbPath = join(DB_DIR, `${source.outDir}.db`);
  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${dbPath}\n  Run build-gtfs-db.ts first to build the database.`);
  }

  console.log(`Reading ${source.outDir}.db (${source.nameEn})...`);
  const db = new Database(dbPath, { readonly: true });

  try {
    // Extract all sections
    const stops = extractStopsV2(db, source.prefix);
    const routes = extractRoutesV2(db, source.prefix, source.routeColorFallbacks ?? {});
    const calendar = extractCalendarV2(db, source.prefix);
    const agencies = extractAgenciesV2(db, source.prefix);
    const feedInfo = extractFeedInfoV2(db, source.prefix);
    const translations = extractTranslationsV2(db, source.prefix);
    const lookup = extractLookupV2(db, source.prefix);
    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, source.prefix);

    // Assemble DataBundle
    const bundle: DataBundle = {
      bundle_version: 3,
      kind: 'data',
      stops: { v: 2, data: stops },
      routes: { v: 2, data: routes },
      agency: { v: 2, data: agencies },
      calendar: { v: 1, data: calendar },
      feedInfo: { v: 1, data: feedInfo },
      timetable: { v: 2, data: timetable },
      tripPatterns: { v: 2, data: tripPatterns },
      translations: { v: 1, data: translations },
      lookup: { v: 2, data: lookup },
    };

    // Write atomically
    const outputDir = join(OUTPUT_DIR, source.prefix);
    writeDataBundle(outputDir, bundle);
    console.log(`  Written: ${outputDir}/data.json`);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --targets <file>',
  );
  console.log('       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-gtfs.ts --list\n');
  console.log('Options:');
  console.log('  --targets <file>  Batch build from a target list file (.ts)');
  console.log('  --list            List available source names');
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
    const names = listGtfsSourceNames();
    console.log('Available GTFS sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-v2-data-from-gtfs (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-from-gtfs.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  let sourceDef;
  try {
    sourceDef = await loadGtfsSource(arg.name);
  } catch (err) {
    console.error(`Error: Failed to load source definition for "${arg.name}".`);
    if (err instanceof Error) {
      console.error(`  Cause: ${err.message}`);
    }
    console.log('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const source: BuildSource = {
    outDir: sourceDef.pipeline.outDir,
    prefix: sourceDef.pipeline.prefix,
    nameEn: sourceDef.resource.nameEn,
    routeColorFallbacks: sourceDef.resource.routeColorFallbacks ?? {},
    provider: sourceDef.resource.provider,
  };

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${source.nameEn}`);
  console.log(`  Input:  ${join(DB_DIR, `${source.outDir}.db`)}`);
  console.log(`  Output: ${join(OUTPUT_DIR, source.prefix)}/data.json`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceDataBundle(source);
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${err.cause.message}`);
    }
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
