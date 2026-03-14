#!/usr/bin/env -S npx tsx

/**
 * Generate train route shapes from MLIT National Land Numerical Information.
 *
 * Reads GeoJSON railway section data and extracts transit line geometries
 * for all resources that have `mlitShapeMapping` defined (both GTFS and
 * ODPT JSON sources), converting them into the shapes.json format used
 * by the app.
 *
 * Input:  pipeline/data/mlit/N02-24_RailroadSection.geojson
 * Output: pipeline/build/data/{prefix}/shapes.json (per target)
 *
 * Usage:
 *   npx tsx pipeline/scripts/app-data/build-app-data-from-ksj-railway.ts
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { loadAllGtfsSources } from '../../lib/load-gtfs-sources';
import { loadAllOdptJsonSources } from '../../lib/load-odpt-json-sources';
import { formatBytes, runMain } from '../../lib/pipeline-utils';
import type { MlitShapeMapping } from '../../types/resource-common';

const ROOT = resolve(import.meta.dirname, '../..');
const GEOJSON_PATH = join(ROOT, 'data/mlit/N02-24_RailroadSection.geojson');
const BUILD_DATA_DIR = join(ROOT, 'build/data');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeoJsonFeature {
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

interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** A target to generate shapes for. */
interface ShapeTarget {
  prefix: string;
  nameEn: string;
  mapping: MlitShapeMapping;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Usage: npx tsx pipeline/scripts/app-data/build-app-data-from-ksj-railway.ts');
  console.log('');
  console.log('Generate train route shapes from MLIT GeoJSON data.');
  console.log('Processes all GTFS and ODPT JSON sources with mlitShapeMapping.');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h   Show this help message');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Collect all mlitShapeMapping targets from GTFS and ODPT JSON resources.
 * Deduplicates by prefix (multiple ODPT resources may share the same prefix).
 */
async function collectTargets(): Promise<ShapeTarget[]> {
  const targetMap = new Map<string, ShapeTarget>();

  const gtfsSources = await loadAllGtfsSources();
  for (const source of gtfsSources) {
    if (source.resource.mlitShapeMapping) {
      targetMap.set(source.pipeline.prefix, {
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  const odptSources = await loadAllOdptJsonSources();
  for (const source of odptSources) {
    if (source.resource.mlitShapeMapping && !targetMap.has(source.pipeline.prefix)) {
      targetMap.set(source.pipeline.prefix, {
        prefix: source.pipeline.prefix,
        nameEn: source.resource.nameEn,
        mapping: source.resource.mlitShapeMapping,
      });
    }
  }

  return [...targetMap.values()];
}

/**
 * Generate shapes.json for a single target from GeoJSON features.
 */
function buildShapesForTarget(
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

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      return;
    }
    console.error(`Error: Unknown argument: ${arg}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const startTime = performance.now();
  console.log('=== Build Train Shapes from MLIT GeoJSON ===\n');

  if (!existsSync(GEOJSON_PATH)) {
    console.error(`Error: GeoJSON file not found: ${GEOJSON_PATH}`);
    process.exitCode = 1;
    return;
  }

  // 1. Collect targets
  console.log('Collecting mlitShapeMapping targets...');
  const targets = await collectTargets();
  if (targets.length === 0) {
    console.log('No targets found with mlitShapeMapping. Nothing to do.');
    return;
  }
  console.log(`  Found ${targets.length} targets: ${targets.map((t) => t.prefix).join(', ')}\n`);

  // 2. Load GeoJSON (once for all targets)
  console.log(`Reading ${GEOJSON_PATH}...`);
  const raw = readFileSync(GEOJSON_PATH, 'utf-8');
  const geojson: GeoJsonCollection = JSON.parse(raw) as GeoJsonCollection;
  console.log(`  ${geojson.features.length} total features\n`);

  // 3. Process each target
  for (const target of targets) {
    console.log(`--- ${target.prefix} (${target.nameEn}) ---`);

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

    // Write output — only touch files in MANAGED_FILES.
    // Other pipeline scripts (GTFS, ODPT) manage their own files
    // in the same output directory.
    const MANAGED_FILES = ['shapes.json'];

    const outputDir = join(BUILD_DATA_DIR, target.prefix);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, 'shapes.json');
    writeFileSync(outputPath, JSON.stringify(shapes));
    const size = statSync(outputPath).size;
    console.log(`\n  Wrote ${outputPath} (${formatBytes(size)})`);

    // Remove stale managed files not produced in this run
    for (const file of readdirSync(outputDir)) {
      if (MANAGED_FILES.includes(file) && file !== 'shapes.json') {
        rmSync(join(outputDir, file));
        console.log(`  (removed stale ${file})`);
      }
    }
    console.log('');
  }

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`Done in ${elapsed}ms. (exit code: 0)`);
}

runMain(main);
