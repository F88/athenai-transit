#!/usr/bin/env -S npx tsx

/**
 * Generate train route shapes from MLIT National Land Numerical Information.
 *
 * Reads GeoJSON railway section data and extracts Toei transit line geometries,
 * converting them into the shapes.json format used by the app.
 *
 * Input:  pipeline/data/mlit/N02-24_RailroadSection.geojson
 * Output: pipeline/build/data/toaran/shapes.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/app-data/build-app-data-from-ksj-railway.ts
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { formatBytes, runMain } from '../../lib/pipeline-utils';
import toeiTrain from '../../resources/gtfs/toei-train';

const ROOT = resolve(import.meta.dirname, '..');
const GEOJSON_PATH = join(ROOT, 'data/mlit/N02-24_RailroadSection.geojson');
const OUTPUT_DIR = join(ROOT, 'build/data', toeiTrain.pipeline.prefix);
const OUTPUT_PATH = join(OUTPUT_DIR, 'shapes.json');

const { mlitShapeMapping } = toeiTrain.resource;
if (!mlitShapeMapping) {
  throw new Error('toei-train resource is missing mlitShapeMapping');
}
const OPERATOR = mlitShapeMapping.operator;
const LINE_TO_ROUTE_ID = mlitShapeMapping.lineToRouteId;

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

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Usage: npx tsx pipeline/scripts/app-data/build-app-data-from-ksj-railway.ts');
  console.log('');
  console.log('Generate train route shapes from MLIT GeoJSON data.');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h   Show this help message');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
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

  // 1. Load GeoJSON
  console.log(`Reading ${GEOJSON_PATH}...`);
  const raw = readFileSync(GEOJSON_PATH, 'utf-8');
  const geojson: GeoJsonCollection = JSON.parse(raw) as GeoJsonCollection;
  console.log(`  ${geojson.features.length} total features`);

  // 2. Filter by operator
  const toeiFeatures = geojson.features.filter((f) => f.properties.N02_004 === OPERATOR);
  console.log(`  ${toeiFeatures.length} features for operator "${OPERATOR}"`);

  // 3. Group by route and convert coordinates
  const shapes: Record<string, [number, number][][]> = {};
  const unmapped = new Set<string>();

  for (const feature of toeiFeatures) {
    const lineName = feature.properties.N02_003;
    const routeId = LINE_TO_ROUTE_ID[lineName];

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

  // 4. Summary
  console.log('\nRoute summary:');
  let totalSegments = 0;
  let totalPoints = 0;
  for (const [routeId, polylines] of Object.entries(shapes)) {
    const points = polylines.reduce((sum, p) => sum + p.length, 0);
    totalSegments += polylines.length;
    totalPoints += points;
    console.log(
      `  ${routeId.padEnd(12)} ${String(polylines.length).padStart(4)} segments  ${String(points).padStart(6)} points`,
    );
  }
  console.log(
    `  ${'TOTAL'.padEnd(12)} ${String(totalSegments).padStart(4)} segments  ${String(totalPoints).padStart(6)} points`,
  );

  // 5. Write output
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(shapes));
  const size = statSync(OUTPUT_PATH).size;
  console.log(`\nWrote ${OUTPUT_PATH} (${formatBytes(size)})`);

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`\nDone in ${elapsed}ms. (exit code: 0)`);
}

runMain(main);
