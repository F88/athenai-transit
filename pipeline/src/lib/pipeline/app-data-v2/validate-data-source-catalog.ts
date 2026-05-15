/**
 * Validate a DataSourceCatalogBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the main validate-v2-bundles script.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind)
 * - Required sections: metadata, sources, globalInsights
 * - Minimal section shape checks used by current CI / development flow
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';

import type { ValidationIssue } from './validate-shapes';

export interface DataSourceCatalogValidationResult {
  issues: ValidationIssue[];
  sourceCount: number;
}

/**
 * Validate a DataSourceCatalogBundle file at `{baseDir}/global/data-source-catalog.json`.
 *
 * @param baseDir - Base output directory (e.g. `pipeline/workspace/_build/data-v2`).
 * @returns Validation result with issues and stats.
 */
export function validateDataSourceCatalogBundle(
  baseDir: string,
): DataSourceCatalogValidationResult {
  const issues: ValidationIssue[] = [];
  let sourceCount = 0;

  const filePath = join(baseDir, 'global', 'data-source-catalog.json');

  if (!existsSync(filePath)) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: 'global/data-source-catalog.json not found',
    });
    return { issues, sourceCount };
  }

  let bundle: DataSourceCatalogBundle;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    bundle = JSON.parse(raw) as DataSourceCatalogBundle;
  } catch (e) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Failed to parse global/data-source-catalog.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { issues, sourceCount };
  }

  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: 'Invalid DataSourceCatalogBundle: expected an object',
    });
    return { issues, sourceCount };
  }

  if (bundle.bundle_version !== 3) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Invalid bundle_version: expected 3, got ${String(bundle.bundle_version)}`,
    });
  }

  if (bundle.kind !== 'data-source-catalog') {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: `Invalid kind: expected "data-source-catalog", got "${String(bundle.kind)}"`,
    });
  }

  if (
    bundle.metadata === null ||
    typeof bundle.metadata !== 'object' ||
    Array.isArray(bundle.metadata)
  ) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: 'Invalid metadata: expected an object with { v, data }',
    });
  } else {
    if (bundle.metadata.v !== 1) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: `Invalid metadata.v: expected 1, got ${String(bundle.metadata.v)}`,
      });
    }
    if (
      bundle.metadata.data === null ||
      typeof bundle.metadata.data !== 'object' ||
      Array.isArray(bundle.metadata.data) ||
      typeof bundle.metadata.data.createdAt !== 'string'
    ) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: 'Invalid metadata.data: expected an object with string createdAt',
      });
    }
  }

  if (
    bundle.sources === null ||
    typeof bundle.sources !== 'object' ||
    Array.isArray(bundle.sources)
  ) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: 'Invalid sources: expected an object with { v, data }',
    });
  } else {
    if (bundle.sources.v !== 1) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: `Invalid sources.v: expected 1, got ${String(bundle.sources.v)}`,
      });
    }
    if (
      bundle.sources.data === null ||
      typeof bundle.sources.data !== 'object' ||
      Array.isArray(bundle.sources.data)
    ) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: 'Invalid sources.data: expected a record keyed by prefix',
      });
    } else {
      sourceCount = Object.keys(bundle.sources.data).length;
    }
  }

  if (
    bundle.globalInsights === null ||
    typeof bundle.globalInsights !== 'object' ||
    Array.isArray(bundle.globalInsights)
  ) {
    issues.push({
      prefix: 'global',
      level: 'error',
      category: 'structure',
      message: 'Invalid globalInsights: expected an object with { v, data }',
    });
  } else {
    if (bundle.globalInsights.v !== 1) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: `Invalid globalInsights.v: expected 1, got ${String(bundle.globalInsights.v)}`,
      });
    }
    if (
      bundle.globalInsights.data === null ||
      typeof bundle.globalInsights.data !== 'object' ||
      Array.isArray(bundle.globalInsights.data) ||
      bundle.globalInsights.data.file === null ||
      typeof bundle.globalInsights.data.file !== 'object' ||
      Array.isArray(bundle.globalInsights.data.file) ||
      typeof bundle.globalInsights.data.file.sizeBytes !== 'number' ||
      bundle.globalInsights.data.counts === null ||
      typeof bundle.globalInsights.data.counts !== 'object' ||
      Array.isArray(bundle.globalInsights.data.counts) ||
      typeof bundle.globalInsights.data.counts.stopGeo !== 'number'
    ) {
      issues.push({
        prefix: 'global',
        level: 'error',
        category: 'structure',
        message: 'Invalid globalInsights.data: expected file.sizeBytes and counts.stopGeo numbers',
      });
    }
  }

  return { issues, sourceCount };
}
