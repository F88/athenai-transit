#!/usr/bin/env -S npx tsx

/**
 * Validate v2 bundle files (DataBundle, ShapesBundle, InsightsBundle).
 *
 * Runs validation in two steps:
 *   Step 1 — File existence check (required bundles must exist)
 *   Step 2 — Validate each bundle (structure, data quality, referential integrity)
 *
 * Unvalidated directory check (Step 1 in V2_VALIDATE.md) is only
 * relevant for --targets mode and is not yet implemented.
 *
 * Target: pipeline/workspace/_build/data-v2/{prefix}/
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — warnings (e.g. empty shapes, calendar expiring)
 *   2 — errors (missing files, invalid structure, invalid data)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';
import { collectAllKsjTargets } from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import { validateDataBundle } from '../../../src/lib/pipeline/app-data-v2/validate-data';
import { validateInsightsBundle } from '../../../src/lib/pipeline/app-data-v2/validate-insights';
import { validateShapesBundle } from '../../../src/lib/pipeline/app-data-v2/validate-shapes';
import type { ValidationIssue } from '../../../src/lib/pipeline/app-data-v2/validate-shapes';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

/** All checks passed. */
const EXIT_OK = 0;
/** Warnings (empty shapes, etc.). */
const EXIT_WARN = 1;
/** Errors (missing files, invalid structure, invalid data). */
const EXIT_ERROR = 2;

// ---------------------------------------------------------------------------
// Bundle file definitions
// ---------------------------------------------------------------------------

interface BundleFile {
  filename: string;
  label: string;
  required: boolean;
}

/** Bundle files to check, in display order. */
const BUNDLE_FILES: BundleFile[] = [
  { filename: 'data.json', label: 'DataBundle', required: true },
  { filename: 'insights.json', label: 'InsightsBundle', required: true },
  { filename: 'shapes.json', label: 'ShapesBundle', required: false },
];

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/**
 * Collect all source names (outDir) that have v2 bundles.
 */
async function collectAllSourceNames(): Promise<string[]> {
  const names = new Set<string>();

  for (const name of listGtfsSourceNames()) {
    names.add(name);
  }

  const ksjTargets = await collectAllKsjTargets();
  for (const t of ksjTargets) {
    names.add(t.name);
  }

  return [...names].sort();
}

/**
 * Resolve a source name (outDir) to its prefix.
 */
async function resolvePrefix(sourceName: string): Promise<string | null> {
  try {
    const source = await loadGtfsSource(sourceName);
    return source.pipeline.prefix;
  } catch {
    const ksjTargets = await collectAllKsjTargets();
    const target = ksjTargets.find((t) => t.name === sourceName);
    return target?.prefix ?? null;
  }
}

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

function trackIssues(
  issues: ValidationIssue[],
  state: { hasError: boolean; hasWarn: boolean },
): void {
  for (const issue of issues) {
    if (issue.level === 'error') {
      state.hasError = true;
    } else {
      state.hasWarn = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: File existence check
// ---------------------------------------------------------------------------

interface ExistenceResult {
  /** Map of filename -> exists. */
  files: Map<string, boolean>;
  /** Whether all required files exist. */
  allRequiredPresent: boolean;
}

function checkFileExistence(prefix: string): ExistenceResult {
  const files = new Map<string, boolean>();
  let allRequiredPresent = true;

  for (const bf of BUNDLE_FILES) {
    const exists = existsSync(join(V2_OUTPUT_DIR, prefix, bf.filename));
    files.set(bf.filename, exists);
    if (bf.required && !exists) {
      allRequiredPresent = false;
    }
  }

  return { files, allRequiredPresent };
}

function printExistenceResult(
  _prefix: string,
  result: ExistenceResult,
  state: { hasError: boolean; hasWarn: boolean },
): void {
  for (const bf of BUNDLE_FILES) {
    const exists = result.files.get(bf.filename)!;
    const pad = '.'.repeat(Math.max(1, 18 - bf.filename.length));

    if (exists) {
      console.log(`    ${bf.filename} ${pad} OK`);
    } else if (bf.required) {
      console.log(`    ${bf.filename} ${pad} MISSING (required)`);
      state.hasError = true;
    } else {
      console.log(`    ${bf.filename} ${pad} not found (optional, skipped)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Validate each bundle — printing helpers
// ---------------------------------------------------------------------------

/**
 * Format a summary line: "label: stats, result".
 * If no errors/warns, result is "OK". Otherwise shows count.
 */
function formatSummaryLine(label: string, stats: string, issues: ValidationIssue[]): string {
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');

  const parts: string[] = [];
  if (errors.length > 0) {
    parts.push(`${errors.length} error(s)`);
  }
  if (warns.length > 0) {
    parts.push(`${warns.length} warning(s)`);
  }
  const result = parts.length > 0 ? parts.join(', ') : 'OK';

  return `      ${label.padEnd(16)} ${stats}, ${result}`;
}

function printIssueDetails(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    if (issue.level === 'error') {
      console.log(`        ERROR: ${issue.message}`);
    } else {
      console.log(`        WARN:  ${issue.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Validate each bundle
// ---------------------------------------------------------------------------

function validateSource(
  prefix: string,
  existingFiles: Map<string, boolean>,
  state: { hasError: boolean; hasWarn: boolean },
): void {
  // DataBundle
  if (existingFiles.get('data.json')) {
    console.log('    [DataBundle]');
    const r = validateDataBundle(prefix, V2_OUTPUT_DIR);
    trackIssues(r.issues, state);

    // Structure issues are fatal — skip per-section output
    const structureErrors = r.issues.filter(
      (i) =>
        i.level === 'error' &&
        (i.message.includes('bundle_version') ||
          i.message.includes('kind') ||
          i.message.includes('Missing required section') ||
          i.message.includes('.v:')),
    );
    if (structureErrors.length > 0) {
      console.log(`      Structure:     FAILED`);
      printIssueDetails(structureErrors);
    } else {
      console.log(`      Structure:     OK (bundle_version=2, kind=data, 9 sections)`);

      // Per-section summary lines
      const stopIssues = r.issues.filter((i) => i.message.startsWith('Stop '));
      console.log(formatSummaryLine('stops:', `${r.stopCount} stops`, stopIssues));
      if (stopIssues.length > 0) {
        printIssueDetails(stopIssues);
      }

      const routeIssues = r.issues.filter((i) => i.message.includes('routes.data is empty'));
      console.log(formatSummaryLine('routes:', `${r.routeCount} routes`, routeIssues));
      if (routeIssues.length > 0) {
        printIssueDetails(routeIssues);
      }

      const calendarIssues = r.issues.filter(
        (i) =>
          i.message.includes('calendar') ||
          i.message.includes('Calendar') ||
          i.message.includes('services'),
      );
      console.log(formatSummaryLine('calendar:', `${r.serviceCount} services`, calendarIssues));
      if (calendarIssues.length > 0) {
        printIssueDetails(calendarIssues);
      }

      const patternIssues = r.issues.filter((i) => i.message.includes('tripPattern '));
      console.log(formatSummaryLine('tripPatterns:', `${r.patternCount} patterns`, patternIssues));
      if (patternIssues.length > 0) {
        printIssueDetails(patternIssues);
      }

      const ttIssues = r.issues.filter((i) => i.message.includes('timetable['));
      console.log(formatSummaryLine('timetable:', `${r.timetableStopCount} stops`, ttIssues));
      if (ttIssues.length > 0) {
        printIssueDetails(ttIssues);
      }
    }
  }

  // InsightsBundle
  if (existingFiles.get('insights.json')) {
    console.log('    [InsightsBundle]');
    const r = validateInsightsBundle(prefix, V2_OUTPUT_DIR);
    trackIssues(r.issues, state);

    if (r.issues.length === 0) {
      console.log(`      Structure:     OK (${r.serviceGroupCount} service groups)`);
    } else {
      console.log(`      Structure:     FAILED`);
      printIssueDetails(r.issues);
    }
  }

  // ShapesBundle (optional — only if file exists)
  if (existingFiles.get('shapes.json')) {
    console.log('    [ShapesBundle]');
    const r = validateShapesBundle(prefix, V2_OUTPUT_DIR);
    trackIssues(r.issues, state);

    // Structure issues are fatal
    const structureErrors = r.issues.filter(
      (i) =>
        i.level === 'error' &&
        (i.message.includes('bundle_version') ||
          i.message.includes('kind') ||
          i.message.includes('shapes.v') ||
          i.message.includes('Invalid shapes.data')),
    );
    if (structureErrors.length > 0) {
      console.log(`      Structure:     FAILED`);
      printIssueDetails(structureErrors);
    } else {
      const stats = `${r.routeCount} routes, ${r.polylineCount} polylines, ${r.pointCount} points`;
      const dataIssues = r.issues.filter(
        (i) =>
          !i.message.includes('bundle_version') &&
          !i.message.includes('kind') &&
          !i.message.includes('shapes.v'),
      );
      if (dataIssues.length === 0) {
        console.log(`      shapes:        ${stats}, OK`);
      } else {
        const errors = dataIssues.filter((i) => i.level === 'error').length;
        const warns = dataIssues.filter((i) => i.level === 'warn').length;
        const parts: string[] = [];
        if (errors > 0) {
          parts.push(`${errors} error(s)`);
        }
        if (warns > 0) {
          parts.push(`${warns} warning(s)`);
        }
        console.log(`      shapes:        ${stats}, ${parts.join(', ')}`);
        printIssueDetails(dataIssues);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list\n',
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
    const names = await collectAllSourceNames();
    console.log('Available v2 bundle sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  // Resolve target source names
  let sourceNames: string[];
  if (arg.kind === 'targets') {
    sourceNames = await loadTargetFile(arg.path);
  } else {
    sourceNames = [arg.name];
  }

  // Resolve source names to prefixes
  const sources: Array<{ name: string; prefix: string }> = [];
  for (const name of sourceNames) {
    const prefix = await resolvePrefix(name);
    if (!prefix) {
      console.error(`Error: Unknown source "${name}".`);
      process.exitCode = EXIT_ERROR;
      return;
    }
    sources.push({ name, prefix });
  }

  const state = { hasError: false, hasWarn: false };

  console.log(`=== Validate v2 bundles (${sources.length} sources) ===\n`);

  // -------------------------------------------------------------------------
  // Step 1: File existence check
  // -------------------------------------------------------------------------

  console.log('--- [1/2] File existence check ---\n');

  const existenceResults = new Map<string, ExistenceResult>();
  let allExistencePassed = true;

  for (const { name, prefix } of sources) {
    console.log(`  ${name} (${prefix}):`);
    const result = checkFileExistence(prefix);
    existenceResults.set(prefix, result);
    printExistenceResult(prefix, result, state);

    if (!result.allRequiredPresent) {
      allExistencePassed = false;
    }
  }

  console.log('');

  if (!allExistencePassed) {
    console.log('Result: FAILED (required files missing)');
    process.exitCode = EXIT_ERROR;
    return;
  }

  // -------------------------------------------------------------------------
  // Step 2: Validate each bundle
  // -------------------------------------------------------------------------

  console.log('--- [2/2] Validate each bundle ---\n');

  for (const { name, prefix } of sources) {
    console.log(`  ${name} (${prefix}):`);
    const existence = existenceResults.get(prefix)!;
    validateSource(prefix, existence.files, state);
    console.log('');
  }

  // Summary
  if (state.hasError) {
    console.log('Result: FAILED (errors found)');
    process.exitCode = EXIT_ERROR;
  } else if (state.hasWarn) {
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
