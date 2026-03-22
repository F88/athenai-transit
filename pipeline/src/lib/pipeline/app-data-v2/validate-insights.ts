/**
 * Validate a v2 InsightsBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the validate-v2-bundles script.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind)
 * - Required section: serviceGroups (v=1)
 * - Optional sections: tripPatternGeo, tripPatternStats, stopStats (v=1)
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
  tripPatternGeoCount: number;
  tripPatternStatsGroupCount: number;
  stopStatsGroupCount: number;
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
  let tripPatternGeoCount = 0;
  let tripPatternStatsGroupCount = 0;
  let stopStatsGroupCount = 0;

  const filePath = join(baseDir, prefix, 'insights.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: 'insights.json not found',
    });
    return {
      issues,
      serviceGroupCount,
      tripPatternGeoCount,
      tripPatternStatsGroupCount,
      stopStatsGroupCount,
    };
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
    return {
      issues,
      serviceGroupCount,
      tripPatternGeoCount,
      tripPatternStatsGroupCount,
      stopStatsGroupCount,
    };
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

  // Optional section: tripPatternGeo
  if (bundle.tripPatternGeo) {
    if (bundle.tripPatternGeo.v !== 1) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid tripPatternGeo.v: expected 1, got ${String(bundle.tripPatternGeo.v)}`,
      });
    }
    if (
      bundle.tripPatternGeo.data &&
      typeof bundle.tripPatternGeo.data === 'object' &&
      !Array.isArray(bundle.tripPatternGeo.data)
    ) {
      tripPatternGeoCount = Object.keys(bundle.tripPatternGeo.data).length;
    } else {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: 'Invalid tripPatternGeo.data: expected a record',
      });
    }
  }

  // Optional section: tripPatternStats
  if (bundle.tripPatternStats) {
    if (bundle.tripPatternStats.v !== 1) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid tripPatternStats.v: expected 1, got ${String(bundle.tripPatternStats.v)}`,
      });
    }
    if (
      bundle.tripPatternStats.data &&
      typeof bundle.tripPatternStats.data === 'object' &&
      !Array.isArray(bundle.tripPatternStats.data)
    ) {
      tripPatternStatsGroupCount = Object.keys(bundle.tripPatternStats.data).length;
    } else {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: 'Invalid tripPatternStats.data: expected a record',
      });
    }
  }

  // Optional section: stopStats
  if (bundle.stopStats) {
    if (bundle.stopStats.v !== 1) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid stopStats.v: expected 1, got ${String(bundle.stopStats.v)}`,
      });
    }
    if (
      bundle.stopStats.data &&
      typeof bundle.stopStats.data === 'object' &&
      !Array.isArray(bundle.stopStats.data)
    ) {
      stopStatsGroupCount = Object.keys(bundle.stopStats.data).length;
    } else {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: 'Invalid stopStats.data: expected a record',
      });
    }
  }

  return {
    issues,
    serviceGroupCount,
    tripPatternGeoCount,
    tripPatternStatsGroupCount,
    stopStatsGroupCount,
  };
}
