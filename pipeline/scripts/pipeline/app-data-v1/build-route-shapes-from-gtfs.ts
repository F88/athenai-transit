#!/usr/bin/env -S npx tsx

/**
 * Extract GTFS shapes into shapes.json for sources that have shapes.txt.
 *
 * This is a dedicated shapes script, separate from build-app-data-from-gtfs.ts,
 * so that shapes generation does not conflict with other scripts that also
 * produce shapes.json (e.g. build-route-shapes-from-ksj-railway.ts).
 *
 * Input:  pipeline/workspace/_build/db/{outDir}.db (built by build-gtfs-db.ts)
 * Output: pipeline/workspace/_build/data/{prefix}/shapes.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts --list
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

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
import { formatBytes } from '../../../src/lib/format-utils';
import { extractShapes } from '../../../src/lib/pipeline/extract-shapes-from-gtfs';
import type { ShapePointV2 } from '../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, V1_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V1_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data));
  const size = statSync(filePath).size;
  const name = basename(filePath);
  console.log(`  ${name.padEnd(20)} ${formatBytes(size).padStart(10)}`);
}

// ---------------------------------------------------------------------------
// V1 format conversion
// ---------------------------------------------------------------------------

/**
 * Strip optional shape_dist_traveled from ShapePointV2 tuples.
 *
 * v1 format uses `[lat, lon]` only. extractShapes() may return
 * `[lat, lon, dist]` when the source provides shape_dist_traveled,
 * so this function drops the third element to keep v1 output stable.
 */
export function stripShapeDistance(
  shapes: Record<string, ShapePointV2[][]>,
): Record<string, [number, number][][]> {
  const result: Record<string, [number, number][][]> = {};
  for (const [routeId, polylines] of Object.entries(shapes)) {
    result[routeId] = polylines.map((polyline) =>
      polyline.map(([lat, lon]): [number, number] => [lat, lon]),
    );
  }
  return result;
}

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
  const v2Shapes = extractShapes(db, prefix);
  db.close();

  if (Object.keys(v2Shapes).length === 0) {
    console.log(`  No shapes found, skipping.`);
    return;
  }

  const shapes = stripShapeDistance(v2Shapes);

  const outputDir = join(OUTPUT_DIR, prefix);
  mkdirSync(outputDir, { recursive: true });

  console.log(`\n  Writing:`);
  writeJson(join(outputDir, 'shapes.json'), shapes);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-gtfs.ts --list\n',
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
    console.log(`=== Batch build-gtfs-shapes (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-route-shapes-from-gtfs.ts');
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

runMain(main);
