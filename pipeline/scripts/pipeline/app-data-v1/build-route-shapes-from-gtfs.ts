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

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, V1_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V1_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extract route shapes from GTFS shapes.txt data.
 *
 * Builds a mapping from prefixed route_id to arrays of polylines,
 * where each polyline is an array of [lat, lon] coordinate pairs.
 */
export function extractShapes(
  db: Database.Database,
  prefix: string,
): Record<string, [number, number][][]> {
  // Get unique route_id -> shape_id mappings from trips
  const routeShapes = db
    .prepare(
      `SELECT DISTINCT t.route_id, t.shape_id
       FROM trips t
       WHERE t.shape_id IS NOT NULL AND t.shape_id <> ''
       ORDER BY t.route_id, t.shape_id`,
    )
    .all() as Array<{ route_id: string; shape_id: string }>;

  // Group shape_ids by route_id
  const routeToShapeIds = new Map<string, string[]>();
  for (const rs of routeShapes) {
    let ids = routeToShapeIds.get(rs.route_id);
    if (!ids) {
      ids = [];
      routeToShapeIds.set(rs.route_id, ids);
    }
    ids.push(rs.shape_id);
  }

  // Load all shape points, ordered by shape_id and sequence
  const shapePoints = db
    .prepare(
      `SELECT shape_id, shape_pt_lat, shape_pt_lon
       FROM shapes
       ORDER BY shape_id, shape_pt_sequence`,
    )
    .all() as Array<{
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
  }>;

  // Group points by shape_id
  const shapeMap = new Map<string, [number, number][]>();
  for (const pt of shapePoints) {
    let points = shapeMap.get(pt.shape_id);
    if (!points) {
      points = [];
      shapeMap.set(pt.shape_id, points);
    }
    // Round to 5 decimal places (~1m precision) to reduce file size
    points.push([Math.round(pt.shape_pt_lat * 1e5) / 1e5, Math.round(pt.shape_pt_lon * 1e5) / 1e5]);
  }

  // Build final structure: prefixed route_id -> array of polylines
  const json: Record<string, [number, number][][]> = {};
  let totalShapes = 0;

  for (const [routeId, shapeIds] of routeToShapeIds) {
    const polylines: [number, number][][] = [];
    for (const shapeId of shapeIds) {
      const points = shapeMap.get(shapeId);
      if (points && points.length > 0) {
        polylines.push(points);
        totalShapes++;
      }
    }
    if (polylines.length > 0) {
      json[`${prefix}:${routeId}`] = polylines;
    }
  }

  console.log(
    `  [${prefix}] ${routeToShapeIds.size} routes, ${totalShapes} shapes, ${shapePoints.length} points`,
  );
  return json;
}

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
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceShapes(outDir: string, prefix: string, nameEn: string): void {
  const dbPath = join(DB_DIR, `${outDir}.db`);
  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${dbPath}\n  Run build-gtfs-db.ts first to build the database.`);
  }

  console.log(`Reading ${outDir}.db (${nameEn})...`);
  const db = new Database(dbPath, { readonly: true });
  const shapes = extractShapes(db, prefix);
  db.close();

  if (Object.keys(shapes).length === 0) {
    console.log(`  No shapes found, skipping.`);
    return;
  }

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
