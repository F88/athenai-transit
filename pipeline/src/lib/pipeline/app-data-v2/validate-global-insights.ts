/**
 * Validate a v2 GlobalInsightsBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the validate-v2-bundles script.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind)
 * - Optional section: stopGeo (v=1, Record<string, StopGeoJson>)
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GlobalInsightsBundle } from '../../../../../src/types/data/transit-v2-json';
import type { ValidationIssue } from './validate-shapes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GlobalInsightsValidationResult {
  issues: ValidationIssue[];
  stopGeoCount: number;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a GlobalInsightsBundle file at `{baseDir}/global/insights.json`.
 *
 * @param baseDir - Base output directory (e.g. `pipeline/workspace/_build/data-v2`).
 * @returns Validation result with issues and stats.
 */
export function validateGlobalInsightsBundle(baseDir: string): GlobalInsightsValidationResult {
  const issues: ValidationIssue[] = [];
  let stopGeoCount = 0;

  const filePath = join(baseDir, 'global', 'insights.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({
      prefix: 'global',
      level: 'warn',
      category: 'structure',
      message: 'global/insights.json not found (GlobalInsightsBundle not built)',
    });
    return { issues, stopGeoCount };
  }

  // JSON parse
  let bundle: GlobalInsightsBundle;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    bundle = JSON.parse(raw) as GlobalInsightsBundle;
  } catch (e) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Failed to parse global/insights.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { issues, stopGeoCount };
  }

  // Bundle structure
  if (bundle.bundle_version !== 2) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Invalid bundle_version: expected 2, got ${String(bundle.bundle_version)}`,
    });
  }
  if (bundle.kind !== 'global-insights') {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Invalid kind: expected "global-insights", got "${String(bundle.kind)}"`,
    });
  }

  // Optional section: stopGeo
  if (bundle.stopGeo !== undefined) {
    if (
      bundle.stopGeo === null ||
      typeof bundle.stopGeo !== 'object' ||
      Array.isArray(bundle.stopGeo)
    ) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: 'Invalid stopGeo: expected an object with { v, data }',
      });
    } else {
      if (bundle.stopGeo.v !== 1) {
        issues.push({
          prefix: 'global',
          level: 'error',
          category: 'structure',
          message: `Invalid stopGeo.v: expected 1, got ${String(bundle.stopGeo.v)}`,
        });
      }
      if (
        bundle.stopGeo.data &&
        typeof bundle.stopGeo.data === 'object' &&
        !Array.isArray(bundle.stopGeo.data)
      ) {
        stopGeoCount = Object.keys(bundle.stopGeo.data).length;

        // Spot-check: nr must be a number for each entry
        for (const [stopId, geo] of Object.entries(bundle.stopGeo.data)) {
          if (typeof geo.nr !== 'number') {
            issues.push({
              prefix: 'global',
              level: 'error',
              category: 'quality',
              message: `stopGeo[${stopId}].nr: expected number, got ${typeof geo.nr}`,
            });
            break; // One example is enough
          }
        }
      } else {
        issues.push({
          prefix: 'global',
          level: 'error',
          category: 'structure',
          message: 'Invalid stopGeo.data: expected a record',
        });
      }
    }
  }

  return { issues, stopGeoCount };
}
