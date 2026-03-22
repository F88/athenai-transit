#!/usr/bin/env -S npx tsx

/**
 * Validate v2 ShapesBundle JSON files.
 *
 * Target: pipeline/workspace/_build/data-v2/{prefix}/shapes.json
 *
 * Validation steps:
 *   1. File existence — shapes.json must exist for each target
 *   2. Bundle structure — bundle_version, kind, shapes.v
 *   3. Data quality — coordinate ranges, polyline point counts,
 *      shape_dist_traveled non-negative & monotonically non-decreasing
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — warnings (e.g. empty shapes)
 *   2 — errors (missing files, invalid structure, invalid coordinates)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts --list
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';
import { collectAllKsjTargets } from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import type { ShapePointV2, ShapesBundle } from '../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

/** All checks passed. */
export const EXIT_OK = 0;
/** Warnings (empty shapes, etc.). */
export const EXIT_WARN = 1;
/** Errors (missing files, invalid structure, invalid data). */
export const EXIT_ERROR = 2;

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  prefix: string;
  level: 'error' | 'warn';
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  routeCount: number;
  polylineCount: number;
  pointCount: number;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Validate a single ShapesBundle file.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind, shapes.v)
 * - Coordinate validity (lat: -90..90, lon: -180..180)
 * - Each polyline has at least 2 points
 * - shape_dist_traveled non-negative
 * - shape_dist_traveled monotonically non-decreasing within a polyline
 */
export function validateShapesBundle(
  prefix: string,
  baseDir: string = OUTPUT_DIR,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let routeCount = 0;
  let polylineCount = 0;
  let pointCount = 0;

  const filePath = join(baseDir, prefix, 'shapes.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({ prefix, level: 'error', message: 'shapes.json not found' });
    return { issues, routeCount, polylineCount, pointCount };
  }

  // JSON parse
  let bundle: ShapesBundle;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    bundle = JSON.parse(raw) as ShapesBundle;
  } catch (e) {
    issues.push({
      prefix,
      level: 'error',
      message: `Failed to parse shapes.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { issues, routeCount, polylineCount, pointCount };
  }

  // Bundle structure
  if (bundle.bundle_version !== 2) {
    issues.push({
      prefix,
      level: 'error',
      message: `Invalid bundle_version: expected 2, got ${String(bundle.bundle_version)}`,
    });
  }
  if (bundle.kind !== 'shapes') {
    issues.push({
      prefix,
      level: 'error',
      message: `Invalid kind: expected "shapes", got "${String(bundle.kind)}"`,
    });
  }
  if (bundle.shapes?.v !== 2) {
    issues.push({
      prefix,
      level: 'error',
      message: `Invalid shapes.v: expected 2, got ${String(bundle.shapes?.v)}`,
    });
  }

  // Bail on structure errors — data checks below depend on valid structure
  if (issues.some((i) => i.level === 'error')) {
    return { issues, routeCount, polylineCount, pointCount };
  }

  const data = bundle.shapes.data;
  routeCount = Object.keys(data).length;

  if (routeCount === 0) {
    issues.push({ prefix, level: 'warn', message: 'shapes.data is empty (0 routes)' });
    return { issues, routeCount, polylineCount, pointCount };
  }

  // Data quality checks
  for (const [routeId, polylines] of Object.entries(data)) {
    for (let pi = 0; pi < polylines.length; pi++) {
      const polyline = polylines[pi];
      polylineCount++;
      pointCount += polyline.length;

      // Minimum point count
      if (polyline.length < 2) {
        issues.push({
          prefix,
          level: 'warn',
          message: `${routeId} polyline[${pi}]: only ${polyline.length} point(s) (expected >= 2)`,
        });
      }

      // Coordinate and distance validation
      let prevDist: number | undefined;
      for (let i = 0; i < polyline.length; i++) {
        const point: ShapePointV2 = polyline[i];
        const [lat, lon] = point;

        // Coordinate range
        if (lat < -90 || lat > 90) {
          issues.push({
            prefix,
            level: 'error',
            message: `${routeId} polyline[${pi}][${i}]: lat ${lat} out of range [-90, 90]`,
          });
        }
        if (lon < -180 || lon > 180) {
          issues.push({
            prefix,
            level: 'error',
            message: `${routeId} polyline[${pi}][${i}]: lon ${lon} out of range [-180, 180]`,
          });
        }

        // shape_dist_traveled checks
        if (point.length === 3) {
          const dist = point[2]!;
          if (dist < 0) {
            issues.push({
              prefix,
              level: 'error',
              message: `${routeId} polyline[${pi}][${i}]: shape_dist_traveled ${dist} is negative`,
            });
          }
          if (prevDist !== undefined && dist < prevDist) {
            issues.push({
              prefix,
              level: 'error',
              message: `${routeId} polyline[${pi}][${i}]: shape_dist_traveled ${dist} < previous ${prevDist} (not monotonically non-decreasing)`,
            });
          }
          prevDist = dist;
        }
      }
    }
  }

  return { issues, routeCount, polylineCount, pointCount };
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/**
 * Collect all prefixes that have shapes (GTFS shapes sources + KSJ sources).
 */
async function collectAllShapesPrefixes(): Promise<string[]> {
  const prefixes = new Set<string>();

  // GTFS sources listed in build-shapes-gtfs target
  for (const name of listGtfsSourceNames()) {
    try {
      const source = await loadGtfsSource(name);
      prefixes.add(source.pipeline.prefix);
    } catch {
      // skip sources that fail to load
    }
  }

  // KSJ sources
  const ksjTargets = await collectAllKsjTargets();
  for (const t of ksjTargets) {
    prefixes.add(t.prefix);
  }

  return [...prefixes].sort();
}

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-shapes-bundle.ts --list\n',
  );
  console.log('Options:');
  console.log('  --targets <file>  Validate from a target list file (.ts)');
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
    const prefixes = await collectAllShapesPrefixes();
    console.log('Available shapes sources:\n');
    for (const p of prefixes) {
      console.log(`  ${p}`);
    }
    return;
  }

  // Resolve target prefixes
  let sourceNames: string[];
  if (arg.kind === 'targets') {
    sourceNames = await loadTargetFile(arg.path);
  } else {
    sourceNames = [arg.name];
  }

  // Resolve source names to prefixes
  const prefixes: string[] = [];
  for (const name of sourceNames) {
    try {
      const source = await loadGtfsSource(name);
      prefixes.push(source.pipeline.prefix);
    } catch {
      // Try KSJ targets
      const ksjTargets = await collectAllKsjTargets();
      const target = ksjTargets.find((t) => t.name === name);
      if (target) {
        prefixes.push(target.prefix);
      } else {
        console.error(`Error: Unknown source "${name}".`);
        process.exitCode = EXIT_ERROR;
        return;
      }
    }
  }

  console.log(`=== Validate v2 ShapesBundle (${prefixes.length} sources) ===\n`);

  let hasError = false;
  let hasWarn = false;

  for (const prefix of prefixes) {
    console.log(`--- ${prefix} ---\n`);
    const result = validateShapesBundle(prefix);

    // Print stats
    console.log(`  Routes:    ${result.routeCount}`);
    console.log(`  Polylines: ${result.polylineCount}`);
    console.log(`  Points:    ${result.pointCount}`);

    // Print issues
    if (result.issues.length === 0) {
      console.log('  Result:    OK\n');
    } else {
      for (const issue of result.issues) {
        if (issue.level === 'error') {
          console.log(`  ERROR: ${issue.message}`);
          hasError = true;
        } else {
          console.log(`  WARN:  ${issue.message}`);
          hasWarn = true;
        }
      }
      console.log('');
    }
  }

  // Summary
  if (hasError) {
    console.log('Result: FAILED (errors found)');
    process.exitCode = EXIT_ERROR;
  } else if (hasWarn) {
    console.log('Result: PASSED with warnings');
    process.exitCode = EXIT_WARN;
  } else {
    console.log('Result: PASSED');
    process.exitCode = EXIT_OK;
  }
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main, { fatalExitCode: EXIT_ERROR });
}
