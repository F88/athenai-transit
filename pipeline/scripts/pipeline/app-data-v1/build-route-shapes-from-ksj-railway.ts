#!/usr/bin/env -S npx tsx

/**
 * Generate train route shapes from MLIT National Land Numerical Information.
 *
 * Reads GeoJSON railway section data and extracts transit line geometries
 * for resources that have `mlitShapeMapping` defined (both GTFS and
 * ODPT JSON sources), converting them into the shapes.json format used
 * by the app.
 *
 * Input:  pipeline/workspace/data/mlit/N02-24_RailroadSection.geojson
 * Output: pipeline/workspace/_build/data/{prefix}/shapes.json (per target)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts --list
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { loadAllGtfsSources } from '../../../src/lib/load-gtfs-sources';
import { loadAllOdptJsonSources } from '../../../src/lib/load-odpt-json-sources';
import {
  determineBatchExitCode,
  formatBytes,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline-utils';
import type { MlitShapeMapping } from '../../../src/types/resource-common';

import { MLIT_GEOJSON_PATH, V1_OUTPUT_DIR } from '../../../src/lib/paths';

const GEOJSON_PATH = MLIT_GEOJSON_PATH;
const BUILD_DATA_DIR = V1_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    N02_001: string; // rail type code
    N02_002: string; // operation type code
    N02_003: string; // line name
    N02_004: string; // operator name
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
}

export interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** A target to generate shapes for. */
export interface ShapeTarget {
  /** Source name (outDir), used as CLI argument. */
  name: string;
  prefix: string;
  nameEn: string;
  mapping: MlitShapeMapping;
}

// ---------------------------------------------------------------------------
// Managed files
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

/**
 * Collect all mlitShapeMapping targets from GTFS and ODPT JSON resources.
 * Deduplicates by prefix (multiple ODPT resources may share the same prefix).
 */
async function collectAllTargets(): Promise<ShapeTarget[]> {
  const targetMap = new Map<string, ShapeTarget>();

  const gtfsSources = await loadAllGtfsSources();
  for (const source of gtfsSources) {
    if (source.resource.mlitShapeMapping) {
      targetMap.set(source.pipeline.outDir, {
        name: source.pipeline.outDir,
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  const odptSources = await loadAllOdptJsonSources();
  for (const source of odptSources) {
    if (source.resource.mlitShapeMapping && !targetMap.has(source.pipeline.outDir)) {
      targetMap.set(source.pipeline.outDir, {
        name: source.pipeline.outDir,
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  return [...targetMap.values()];
}

// ---------------------------------------------------------------------------
// Shape generation
// ---------------------------------------------------------------------------

/**
 * Generate shapes.json for a single target from GeoJSON features.
 */
export function buildShapesForTarget(
  target: ShapeTarget,
  geojson: GeoJsonCollection,
): Record<string, [number, number][][]> {
  const { operator, lineToRouteId } = target.mapping;

  // Filter by operator
  const features = geojson.features.filter((f) => f.properties.N02_004 === operator);
  console.log(`  ${features.length} features for operator "${operator}"`);

  // Group by route and convert coordinates
  const shapes: Record<string, [number, number][][]> = {};
  const unmapped = new Set<string>();

  for (const feature of features) {
    const lineName = feature.properties.N02_003;
    const routeId = lineToRouteId[lineName];

    if (!routeId) {
      unmapped.add(lineName);
      continue;
    }

    // Convert [lon, lat] -> [lat, lon] with 5 decimal precision
    const polyline: [number, number][] = feature.geometry.coordinates.map(([lon, lat]) => [
      Math.round(lat * 1e5) / 1e5,
      Math.round(lon * 1e5) / 1e5,
    ]);

    if (!shapes[routeId]) {
      shapes[routeId] = [];
    }
    shapes[routeId].push(polyline);
  }

  if (unmapped.size > 0) {
    console.warn(`  WARN: Unmapped lines: ${[...unmapped].join(', ')}`);
  }

  return shapes;
}

/**
 * Load GeoJSON data (cached across multiple targets in batch mode).
 */
let cachedGeoJson: GeoJsonCollection | null = null;

function loadGeoJson(): GeoJsonCollection {
  if (cachedGeoJson) {
    return cachedGeoJson;
  }

  if (!existsSync(GEOJSON_PATH)) {
    throw new Error(`GeoJSON file not found: ${GEOJSON_PATH}`);
  }

  console.log(`Reading ${GEOJSON_PATH}...`);
  const raw = readFileSync(GEOJSON_PATH, 'utf-8');
  cachedGeoJson = JSON.parse(raw) as GeoJsonCollection;
  console.log(`  ${cachedGeoJson.features.length} total features\n`);
  return cachedGeoJson;
}

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceShapes(target: ShapeTarget): void {
  const geojson = loadGeoJson();
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

  // Write output
  const outputDir = join(BUILD_DATA_DIR, target.prefix);
  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'shapes.json');
  writeFileSync(outputPath, JSON.stringify(shapes));
  const size = statSync(outputPath).size;
  console.log(`\n  Wrote shapes.json (${formatBytes(size)})`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-route-shapes-from-ksj-railway.ts --list\n',
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
    const targets = await collectAllTargets();
    console.log('Available KSJ railway shape sources:\n');
    for (const t of targets) {
      console.log(`  ${t.name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(
      `=== Batch build-route-shapes-from-ksj-railway (${sourceNames.length} targets) ===\n`,
    );
    const scriptPath = resolve(import.meta.dirname, 'build-route-shapes-from-ksj-railway.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  const allTargets = await collectAllTargets();
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
  console.log(`  Output: ${join(BUILD_DATA_DIR, target.prefix)}/`);
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

runMain(main);
