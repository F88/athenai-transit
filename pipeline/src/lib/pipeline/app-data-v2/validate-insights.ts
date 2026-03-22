/**
 * Validate a v2 InsightsBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the validate-v2-bundles script.
 *
 * Currently only checks bundle structure. Detailed data quality
 * and referential integrity checks will be added when the
 * insights pipeline is complete.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind)
 * - Required section: serviceGroups (v=1)
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { InsightsBundle } from '../../../../../src/types/data/transit-v2-json';
import type { ValidationIssue } from './validate-shapes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsightsValidationResult {
  issues: ValidationIssue[];
  serviceGroupCount: number;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a single InsightsBundle file at `{baseDir}/{prefix}/insights.json`.
 *
 * @param prefix - Source prefix (e.g. `"minkuru"`).
 * @param baseDir - Base output directory (e.g. `pipeline/workspace/_build/data-v2`).
 * @returns Validation result with issues and stats.
 */
export function validateInsightsBundle(prefix: string, baseDir: string): InsightsValidationResult {
  const issues: ValidationIssue[] = [];
  let serviceGroupCount = 0;

  const filePath = join(baseDir, prefix, 'insights.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: 'insights.json not found',
    });
    return { issues, serviceGroupCount };
  }

  // JSON parse
  let bundle: InsightsBundle;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    bundle = JSON.parse(raw) as InsightsBundle;
  } catch (e) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Failed to parse insights.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { issues, serviceGroupCount };
  }

  // Bundle structure
  if (bundle.bundle_version !== 2) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid bundle_version: expected 2, got ${String(bundle.bundle_version)}`,
    });
  }
  if (bundle.kind !== 'insights') {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid kind: expected "insights", got "${String(bundle.kind)}"`,
    });
  }

  // Required section: serviceGroups
  if (!bundle.serviceGroups || typeof bundle.serviceGroups !== 'object') {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: 'Missing required section: serviceGroups',
    });
  } else {
    if (bundle.serviceGroups.v !== 1) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid serviceGroups.v: expected 1, got ${String(bundle.serviceGroups.v)}`,
      });
    }
    if (Array.isArray(bundle.serviceGroups.data)) {
      serviceGroupCount = bundle.serviceGroups.data.length;
    } else {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: 'Invalid serviceGroups.data: expected an array',
      });
    }
  }

  // TODO: Data quality and referential integrity checks
  // will be added when the insights pipeline is complete.

  return { issues, serviceGroupCount };
}
