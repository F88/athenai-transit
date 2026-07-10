/**
 * Validate a v2 ShapesBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the validate-v2-bundles script.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind, shapes.v)
 * - shapes.data is a valid object
 * - Coordinate validity (lat: -90..90, lon: -180..180)
 * - Each polyline has at least 2 points
 * - shape_dist_traveled non-negative
 * - shape_dist_traveled monotonically non-decreasing within a polyline
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ShapePointV2, ShapesBundle } from '@contracts/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  prefix: string;
  /**
   * Severity. `error` fails validation (exit 2); `warn` passes with a
   * non-zero warning code (exit 1); `info` is a non-actionable notice that is
   * displayed but does not affect the exit code (e.g. an intentionally empty
   * shapes bundle, see Issue #329).
   */
  level: 'error' | 'warn' | 'info';
  /** Machine-readable category for grouping issues in output. */
  category: 'structure' | 'quality' | 'integrity' | 'calendar';
  message: string;
}

export interface ShapesValidationResult {
  issues: ValidationIssue[];
  routeCount: number;
  polylineCount: number;
  pointCount: number;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a single ShapesBundle file at `{baseDir}/{prefix}/shapes.json`.
 *
 * @param prefix - Source prefix (e.g. `"minkuru"`).
 * @param baseDir - Base output directory (e.g. `pipeline/workspace/_build/data-v2`).
 * @returns Validation result with issues and stats.
 */
export function validateShapesBundle(prefix: string, baseDir: string): ShapesValidationResult {
  const issues: ValidationIssue[] = [];
  let routeCount = 0;
  let polylineCount = 0;
  let pointCount = 0;

  const filePath = join(baseDir, prefix, 'shapes.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: 'shapes.json not found',
    });
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
      category: 'structure',
      message: `Failed to parse shapes.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { issues, routeCount, polylineCount, pointCount };
  }

  // Bundle structure
  if (bundle.bundle_version !== 3) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid bundle_version: expected 3, got ${String(bundle.bundle_version)}`,
    });
  }
  if (bundle.kind !== 'shapes') {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid kind: expected "shapes", got "${String(bundle.kind)}"`,
    });
  }
  if (bundle.shapes?.v !== 2) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid shapes.v: expected 2, got ${String(bundle.shapes?.v)}`,
    });
  }

  // Bail on structure errors — data checks below depend on valid structure
  if (issues.some((i) => i.level === 'error')) {
    return { issues, routeCount, polylineCount, pointCount };
  }

  const data = bundle.shapes?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: 'Invalid shapes.data: expected a non-null object mapping route IDs to polylines',
    });
    return { issues, routeCount, polylineCount, pointCount };
  }
  routeCount = Object.keys(data).length;

  if (routeCount === 0) {
    // An empty shapes bundle is an expected, valid state: sources without
    // shapes.txt (or without trip.shape_id linkage) still emit shapes.json so
    // the app's per-source request is a cacheable 200 JSON (Issue #329).
    // Surface it as an informational notice, not a warning -- it must not
    // affect the exit code.
    issues.push({
      prefix,
      level: 'info',
      category: 'quality',
      message: 'shapes.data is empty (0 routes)',
    });
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
          category: 'quality',
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
            category: 'quality',
            message: `${routeId} polyline[${pi}][${i}]: lat ${lat} out of range [-90, 90]`,
          });
        }
        if (lon < -180 || lon > 180) {
          issues.push({
            prefix,
            level: 'error',
            category: 'quality',
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
              category: 'quality',
              message: `${routeId} polyline[${pi}][${i}]: shape_dist_traveled ${dist} is negative`,
            });
          }
          if (prevDist !== undefined && dist < prevDist) {
            issues.push({
              prefix,
              level: 'error',
              category: 'quality',
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
