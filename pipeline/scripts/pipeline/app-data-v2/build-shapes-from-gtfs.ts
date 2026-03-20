#!/usr/bin/env -S npx tsx

/**
 * Build v2 ShapesBundle from GTFS shapes.txt data.
 *
 * Each invocation processes a single GTFS source. For batch processing,
 * use `--targets <file>`.
 *
 * Input:  pipeline/workspace/_build/db/{outDir}.db (built by build-gtfs-db.ts)
 * Output: pipeline/workspace/_build/data-v2/{prefix}/shapes.json (ShapesBundle)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --list
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { extractShapes } from '../../../src/lib/pipeline/extract-shapes-from-gtfs';
import { writeShapesBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, V2_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceShapes(outDir: string, prefix: string, nameEn: string): void {
  const dbPath = join(DB_DIR, `${outDir}.db`);
  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${dbPath}\n  Run build-gtfs-db.ts first to build the database.`);
  }

  console.log(`Reading ${outDir}.db (${nameEn})...`);
  const db = new Database(dbPath, { readonly: true });

  try {
    const shapes = extractShapes(db, prefix);

    if (Object.keys(shapes).length === 0) {
      console.log(`  No shapes found, skipping.`);
      return;
    }

    const outputDir = join(OUTPUT_DIR, prefix);
    writeShapesBundle(outputDir, shapes);
    console.log(`  Written: ${outputDir}/shapes.json`);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-gtfs.ts --list\n',
  );
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
    console.log(`=== Batch build-v2-shapes-from-gtfs (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-shapes-from-gtfs.ts');
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

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${sourceDef.resource.nameEn}`);
  console.log(`  Input:  ${join(DB_DIR, `${sourceDef.pipeline.outDir}.db`)}`);
  console.log(`  Output: ${join(OUTPUT_DIR, sourceDef.pipeline.prefix)}/shapes.json`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceShapes(
      sourceDef.pipeline.outDir,
      sourceDef.pipeline.prefix,
      sourceDef.resource.nameEn,
    );
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
