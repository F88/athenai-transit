#!/usr/bin/env -S npx tsx

/**
 * Validate v2 bundle files (DataBundle, ShapesBundle, InsightsBundle).
 *
 * Runs validation in up to three steps:
 *   Step 1 — Unvalidated directory check (--targets mode only)
 *   Step 2 — File existence check (required bundles must exist)
 *   Step 3 — Validate each bundle (structure, data quality, referential integrity)
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

import { existsSync, readdirSync, statSync } from 'node:fs';
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
 * Build a map from source name (outDir) to prefix.
 * Loads all GTFS and KSJ source definitions once.
 */
async function buildSourcePrefixMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const name of listGtfsSourceNames()) {
    const source = await loadGtfsSource(name);
    map.set(name, source.pipeline.prefix);
  }

  const ksjTargets = await collectAllKsjTargets();
  for (const t of ksjTargets) {
    if (!map.has(t.name)) {
      map.set(t.name, t.prefix);
    }
  }

  return map;
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
// Step 1: Unvalidated directory check (--targets mode only)
// ---------------------------------------------------------------------------

/**
 * Check for directories in data-v2/ that are not in the validated set.
 * Prevents unvalidated data from being synced to public/.
 *
 * @returns Array of unvalidated directory names (empty = all covered).
 */
function checkUnvalidatedDirs(validatedPrefixes: Set<string>): string[] {
  if (!existsSync(V2_OUTPUT_DIR)) {
    return [];
  }

  const dirs = readdirSync(V2_OUTPUT_DIR).filter((entry) => {
    const entryPath = join(V2_OUTPUT_DIR, entry);
    return statSync(entryPath).isDirectory();
  });

  return dirs.filter((dir) => !validatedPrefixes.has(dir)).sort();
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
 * Format a section summary line: "label: stats, result".
 * If no errors/warns, result is "OK". Otherwise shows count.
 */
function formatSectionLine(label: string, stats: string, issues: ValidationIssue[]): string {
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

  return `        ${label.padEnd(16)} ${stats}, ${result}`;
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

function printSectionIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    if (issue.level === 'error') {
      console.log(`          ERROR: ${issue.message}`);
    } else {
      console.log(`          WARN:  ${issue.message}`);
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
      (i) => i.level === 'error' && i.category === 'structure',
    );
    if (structureErrors.length > 0) {
      console.log(`      Structure:     FAILED`);
      printIssueDetails(structureErrors);
    } else {
      console.log(`      Structure:     OK (bundle_version=2, kind=data, 9 sections)`);

      // Per-section summary lines
      console.log('      Sections:');

      const stopIssues = r.issues.filter(
        (i) => i.message.startsWith('Stop ') || i.message.includes('stops.data is empty'),
      );
      console.log(formatSectionLine('stops:', `${r.stopCount} stops`, stopIssues));
      if (stopIssues.length > 0) {
        printSectionIssues(stopIssues);
      }

      const routeIssues = r.issues.filter((i) => i.message.includes('routes.data is empty'));
      console.log(formatSectionLine('routes:', `${r.routeCount} routes`, routeIssues));
      if (routeIssues.length > 0) {
        printSectionIssues(routeIssues);
      }

      const calendarIssues = r.issues.filter(
        (i) =>
          i.message.includes('calendar') ||
          i.message.includes('Calendar') ||
          i.message.includes('services'),
      );
      console.log(formatSectionLine('calendar:', `${r.serviceCount} services`, calendarIssues));
      if (calendarIssues.length > 0) {
        printSectionIssues(calendarIssues);
      }

      const patternIssues = r.issues.filter((i) => i.message.includes('tripPattern '));
      console.log(formatSectionLine('tripPatterns:', `${r.patternCount} patterns`, patternIssues));
      if (patternIssues.length > 0) {
        printSectionIssues(patternIssues);
      }

      const ttIssues = r.issues.filter((i) => i.message.includes('timetable['));
      console.log(formatSectionLine('timetable:', `${r.timetableStopCount} stops`, ttIssues));
      if (ttIssues.length > 0) {
        printSectionIssues(ttIssues);
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
      (i) => i.level === 'error' && i.category === 'structure',
    );
    if (structureErrors.length > 0) {
      console.log(`      Structure:     FAILED`);
      printIssueDetails(structureErrors);
    } else {
      const stats = `${r.routeCount} routes, ${r.polylineCount} polylines, ${r.pointCount} points`;
      const dataIssues = r.issues.filter((i) => i.category !== 'structure');
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

  // Build source name → prefix map once (used by --list and validation)
  const prefixMap = await buildSourcePrefixMap();

  if (arg.kind === 'list') {
    const names = [...prefixMap.keys()].sort();
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
    const prefix = prefixMap.get(name);
    if (!prefix) {
      console.error(`Error: Unknown source "${name}".`);
      process.exitCode = EXIT_ERROR;
      return;
    }
    sources.push({ name, prefix });
  }

  const state = { hasError: false, hasWarn: false };
  const isTargetsMode = arg.kind === 'targets';
  const totalSteps = isTargetsMode ? 3 : 2;
  let stepNum = 0;

  console.log(`=== Validate v2 bundles (${sources.length} sources) ===\n`);

  // -------------------------------------------------------------------------
  // Step 1: Unvalidated directory check (--targets mode only)
  // -------------------------------------------------------------------------

  if (isTargetsMode) {
    stepNum++;
    console.log(`--- [${stepNum}/${totalSteps}] Unvalidated directory check ---\n`);

    const validatedPrefixes = new Set(sources.map((s) => s.prefix));
    const unvalidated = checkUnvalidatedDirs(validatedPrefixes);

    if (unvalidated.length === 0) {
      console.log('  Result: All directories are covered by targets.');
    } else {
      for (const dir of unvalidated) {
        console.log(`  ERROR: Unvalidated directory: ${dir}/`);
      }
      console.log(
        `  Result: ${unvalidated.length} unvalidated director${unvalidated.length === 1 ? 'y' : 'ies'} found.`,
      );
      state.hasError = true;
    }

    console.log('');
  }

  // -------------------------------------------------------------------------
  // Step 2: File existence check
  // -------------------------------------------------------------------------

  stepNum++;
  console.log(`--- [${stepNum}/${totalSteps}] File existence check ---\n`);

  const existenceResults = new Map<string, ExistenceResult>();
  let allExistencePassed = true;

  let totalFiles = 0;
  let presentFiles = 0;
  let optionalSkipped = 0;

  for (const { name, prefix } of sources) {
    console.log(`  ${name} (${prefix}):`);
    const result = checkFileExistence(prefix);
    existenceResults.set(prefix, result);
    printExistenceResult(prefix, result, state);

    if (!result.allRequiredPresent) {
      allExistencePassed = false;
    }

    for (const bf of BUNDLE_FILES) {
      totalFiles++;
      const exists = result.files.get(bf.filename)!;
      if (exists) {
        presentFiles++;
      } else if (!bf.required) {
        optionalSkipped++;
      }
    }
  }

  const skippedNote = optionalSkipped > 0 ? ` (${optionalSkipped} optional skipped)` : '';
  console.log(`  Result: ${presentFiles}/${totalFiles} files present${skippedNote}.`);
  console.log('');

  if (!allExistencePassed) {
    console.log('Result: FAILED (required files missing)');
    process.exitCode = EXIT_ERROR;
    return;
  }

  // -------------------------------------------------------------------------
  // Step 3: Validate each bundle
  // -------------------------------------------------------------------------

  stepNum++;
  console.log(`--- [${stepNum}/${totalSteps}] Validate each bundle ---\n`);

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
