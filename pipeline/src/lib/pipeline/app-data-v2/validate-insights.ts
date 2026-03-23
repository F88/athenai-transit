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

  // Validate an optional BundleSection<1, Record<...>> section.
  // Returns the number of keys in data, or 0 if absent/invalid.
  const validateOptionalRecordSection = (
    sectionName: 'tripPatternGeo' | 'tripPatternStats' | 'stopStats',
  ): number => {
    const section = bundle[sectionName];
    if (section === undefined) {
      return 0;
    }
    if (section === null || typeof section !== 'object' || Array.isArray(section)) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid ${sectionName}: expected an object with { v, data }`,
      });
      return 0;
    }
    if (section.v !== 1) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid ${sectionName}.v: expected 1, got ${String(section.v)}`,
      });
      return 0;
    }
    if (section.data && typeof section.data === 'object' && !Array.isArray(section.data)) {
      return Object.keys(section.data).length;
    }
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid ${sectionName}.data: expected a record`,
    });
    return 0;
  };

  tripPatternGeoCount = validateOptionalRecordSection('tripPatternGeo');
  tripPatternStatsGroupCount = validateOptionalRecordSection('tripPatternStats');
  stopStatsGroupCount = validateOptionalRecordSection('stopStats');

  return {
    issues,
    serviceGroupCount,
    tripPatternGeoCount,
    tripPatternStatsGroupCount,
    stopStatsGroupCount,
  };
}
