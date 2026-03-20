#!/usr/bin/env -S npx tsx

/**
 * Build v2 ShapesBundle from MLIT National Land Numerical Information.
 *
 * Reads GeoJSON railway section data and extracts transit line geometries
 * for resources that have `mlitShapeMapping` defined (both GTFS and
 * ODPT JSON sources), converting them into ShapesBundle format.
 *
 * Input:  pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson
 * Output: pipeline/workspace/_build/data-v2/{prefix}/shapes.json (ShapesBundle, per target)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts --list
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline/pipeline-utils';
import {
  buildShapesForTarget,
  collectAllKsjTargets,
  loadKsjGeoJson,
} from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import type { ShapeTarget } from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import { writeShapesBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceShapes(target: ShapeTarget): void {
  const geojson = loadKsjGeoJson();
  const shapes = buildShapesForTarget(target, geojson);

  // Summary
  console.log('\n  Route summary:');
  let totalSegments = 0;
  let totalPoints = 0;
  for (const [routeId, polylines] of Object.entries(shapes)) {
    const points = polylines.reduce((sum, p) => sum + p.length, 0);
    totalSegments += polylines.length;
    totalPoints += points;
    console.log(
      `    ${routeId.padEnd(12)} ${String(polylines.length).padStart(4)} segments  ${String(points).padStart(6)} points`,
    );
  }
  console.log(
    `    ${'TOTAL'.padEnd(12)} ${String(totalSegments).padStart(4)} segments  ${String(totalPoints).padStart(6)} points`,
  );

  if (Object.keys(shapes).length === 0) {
    console.log(`  No shapes generated, skipping.`);
    return;
  }

  const outputDir = join(OUTPUT_DIR, target.prefix);
  writeShapesBundle(outputDir, shapes);
  console.log(`\n  Written: ${outputDir}/shapes.json`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-shapes-from-ksj.ts --list\n',
  );
  console.log('Options:');
  console.log('  --targets <file>  Batch build from a target list file (.ts)');
  console.log('  --list            List available source names (sources with mlitShapeMapping)');
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
    const targets = await collectAllKsjTargets();
    console.log('Available KSJ railway shape sources:\n');
    for (const t of targets) {
      console.log(`  ${t.name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-v2-shapes-from-ksj (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-shapes-from-ksj.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  const allTargets = await collectAllKsjTargets();
  const target = allTargets.find((t) => t.name === arg.name);
  if (!target) {
    const available = allTargets.map((t) => t.name).join(', ');
    console.error(
      `Error: Unknown source "${arg.name}" (or it has no mlitShapeMapping). Available: ${available || '(none)'}`,
    );
    console.log('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${target.nameEn}`);
  console.log(`  Prefix: ${target.prefix}`);
  console.log(`  Output: ${join(OUTPUT_DIR, target.prefix)}/`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceShapes(target);
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
