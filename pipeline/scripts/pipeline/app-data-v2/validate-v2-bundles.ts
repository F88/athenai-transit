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
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <prefix>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';
import { parseGtfsDate } from '../../../src/lib/gtfs-date-utils';
import type { CalendarServiceMeta } from '../../../src/lib/pipeline/app-data-v2/validate-data';
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
      console.log(`    ${bf.filename} ${pad} ❌ MISSING (required)`);
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
      console.log(`        ❌ ERROR: ${issue.message}`);
    } else {
      console.log(`        ⚠️ WARN:  ${issue.message}`);
    }
  }
}

function printSectionIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    if (issue.level === 'error') {
      console.log(`          ❌ ERROR: ${issue.message}`);
    } else {
      console.log(`          ⚠️ WARN:  ${issue.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Validate each bundle
// ---------------------------------------------------------------------------

interface SourceValidationResult {
  calendarServices: CalendarServiceMeta[];
}

function validateSource(
  prefix: string,
  existingFiles: Map<string, boolean>,
  state: { hasError: boolean; hasWarn: boolean },
  allIssues: ValidationIssue[],
): SourceValidationResult {
  const result: SourceValidationResult = { calendarServices: [] };
  // DataBundle
  if (existingFiles.get('data.json')) {
    console.log('    [DataBundle]');
    const r = validateDataBundle(prefix, V2_OUTPUT_DIR);
    trackIssues(r.issues, state);
    allIssues.push(...r.issues);
    result.calendarServices = r.calendarServices;

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
    allIssues.push(...r.issues);

    if (r.issues.length === 0) {
      const parts = [`${r.serviceGroupCount} service groups`];
      if (r.tripPatternGeoCount > 0) {
        parts.push(`${r.tripPatternGeoCount} pattern geo`);
      }
      if (r.tripPatternStatsGroupCount > 0) {
        parts.push(`${r.tripPatternStatsGroupCount} stats groups`);
      }
      if (r.stopStatsGroupCount > 0) {
        parts.push(`${r.stopStatsGroupCount} stop stats groups`);
      }
      console.log(`      Structure:     OK (${parts.join(', ')})`);
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
    allIssues.push(...r.issues);

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

  return result;
}

// ---------------------------------------------------------------------------
// Markdown summary (for GitHub Actions Job Summary)
// ---------------------------------------------------------------------------

/** Format Date as "YYYY-MM-DD". */
function formatDateForSummary(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Threshold for "expiring soon" warning (days). */
const WARN_THRESHOLD_DAYS = 30;

interface CalendarServiceEntry {
  prefix: string;
  serviceId: string;
  endDate: string;
  daysLeft: number;
}

/**
 * Collect per-service calendar freshness from already-validated metadata.
 * Reuses CalendarServiceMeta from validateDataBundle results to avoid
 * re-reading data.json files.
 */
function collectCalendarFreshness(
  calendarByPrefix: Map<string, CalendarServiceMeta[]>,
  today: Date,
): {
  expired: CalendarServiceEntry[];
  expiringSoon: CalendarServiceEntry[];
} {
  const expired: CalendarServiceEntry[] = [];
  const expiringSoon: CalendarServiceEntry[] = [];

  const thresholdMs = WARN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  for (const [prefix, services] of calendarByPrefix) {
    for (const svc of services) {
      const endDate = parseGtfsDate(svc.endDate);
      if (!endDate) {
        continue;
      }
      const diffMs = endDate.getTime() - today.getTime();
      const daysLeft = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (diffMs < 0) {
        expired.push({
          prefix,
          serviceId: svc.serviceId,
          endDate: formatDateForSummary(endDate),
          daysLeft,
        });
      } else if (diffMs < thresholdMs) {
        expiringSoon.push({
          prefix,
          serviceId: svc.serviceId,
          endDate: formatDateForSummary(endDate),
          daysLeft,
        });
      }
    }
  }

  return { expired, expiringSoon };
}

/**
 * Print a Markdown summary of validation results.
 * Designed for GitHub Actions Job Summary output.
 */
function printMarkdownSummary(
  allIssues: ValidationIssue[],
  unvalidatedDirs: string[],
  missingFiles: Array<{ prefix: string; filename: string }>,
  calendarByPrefix: Map<string, CalendarServiceMeta[]>,
  today: Date,
): void {
  console.log('## V2 Bundle Validation\n');
  console.log(`Checked on: ${formatDateForSummary(today)}\n`);

  // Unvalidated directories
  if (unvalidatedDirs.length > 0) {
    console.log('### ❌ Unvalidated directories\n');
    for (const dir of unvalidatedDirs) {
      console.log(`- \`${dir}/\``);
    }
    console.log('');
  }

  // Missing required files
  if (missingFiles.length > 0) {
    console.log('### ❌ Missing files\n');
    console.log('| Prefix | File |');
    console.log('|--------|------|');
    for (const m of missingFiles) {
      console.log(`| ${m.prefix} | ${m.filename} |`);
    }
    console.log('');
  }

  // Non-calendar errors
  const errors = allIssues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    console.log('### ❌ Errors\n');
    console.log('| Prefix | Message |');
    console.log('|--------|---------|');
    for (const e of errors) {
      console.log(`| ${e.prefix} | ${e.message} |`);
    }
    console.log('');
  }

  // Non-calendar warnings (calendar warnings are shown as service-level tables below)
  const nonCalendarWarns = allIssues.filter((i) => i.level === 'warn' && i.category !== 'calendar');
  if (nonCalendarWarns.length > 0) {
    console.log('### ⚠️ Warnings\n');
    console.log('| Prefix | Message |');
    console.log('|--------|---------|');
    for (const w of nonCalendarWarns) {
      console.log(`| ${w.prefix} | ${w.message} |`);
    }
    console.log('');
  }

  // Calendar freshness (service_id level, matching v1 format)
  const { expired, expiringSoon } = collectCalendarFreshness(calendarByPrefix, today);

  if (expired.length > 0) {
    console.log('### ⚠️ Expired services\n');
    console.log('| Prefix | Service ID | End Date |');
    console.log('|--------|-----------|----------|');
    for (const e of expired) {
      console.log(`| ${e.prefix} | \`${e.serviceId}\` | ${e.endDate} |`);
    }
    console.log('');
  }

  if (expiringSoon.length > 0) {
    console.log(`### ⚠️ Expiring within ${WARN_THRESHOLD_DAYS} days\n`);
    console.log('| Prefix | Service ID | End Date | Days Left |');
    console.log('|--------|-----------|----------|-----------|');
    for (const e of expiringSoon) {
      console.log(`| ${e.prefix} | \`${e.serviceId}\` | ${e.endDate} | ${e.daysLeft} |`);
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <prefix>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list\n',
  );
  console.log('Options:');
  console.log('  --targets <file>  Validate from a target list file (.ts)');
  console.log('  --list            List available prefixes (from data-v2/ directories)');
  console.log('  --help            Show this help message');
}

/**
 * List prefix directories that exist in the output directory.
 */
function listAvailablePrefixes(): string[] {
  if (!existsSync(V2_OUTPUT_DIR)) {
    return [];
  }
  return readdirSync(V2_OUTPUT_DIR)
    .filter((name) => {
      const dir = join(V2_OUTPUT_DIR, name);
      return statSync(dir).isDirectory();
    })
    .sort();
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
    const prefixes = listAvailablePrefixes();
    console.log('Available v2 bundle prefixes:\n');
    for (const prefix of prefixes) {
      console.log(`  ${prefix}`);
    }
    return;
  }

  // Resolve target prefixes
  let prefixes: string[];
  if (arg.kind === 'targets') {
    prefixes = await loadTargetFile(arg.path);
  } else {
    prefixes = [arg.name];
  }

  const state = { hasError: false, hasWarn: false };
  const allIssues: ValidationIssue[] = [];
  let unvalidatedDirs: string[] = [];
  const missingFiles: Array<{ prefix: string; filename: string }> = [];
  const calendarByPrefix = new Map<string, CalendarServiceMeta[]>();
  const isTargetsMode = arg.kind === 'targets';
  const totalSteps = isTargetsMode ? 3 : 2;
  let stepNum = 0;
  const t0 = performance.now();
  const rawDate = new Date();
  const today = new Date(
    Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()),
  );

  console.log(`=== Validate v2 bundles (${V2_OUTPUT_DIR}) ===\n`);
  console.log(`  Validating ${prefixes.length} sources: ${prefixes.join(', ')}\n`);

  // -------------------------------------------------------------------------
  // Step 1: Unvalidated directory check (--targets mode only)
  // -------------------------------------------------------------------------

  if (isTargetsMode) {
    stepNum++;
    console.log(`--- [${stepNum}/${totalSteps}] Unvalidated directory check ---\n`);

    const validatedPrefixes = new Set(prefixes);
    unvalidatedDirs = checkUnvalidatedDirs(validatedPrefixes);

    if (unvalidatedDirs.length === 0) {
      console.log('  Result: All directories are covered by targets.');
    } else {
      for (const dir of unvalidatedDirs) {
        console.log(`  ❌ ERROR: Unvalidated directory: ${dir}/`);
      }
      console.log(
        `  Result: ${unvalidatedDirs.length} unvalidated director${unvalidatedDirs.length === 1 ? 'y' : 'ies'} found.`,
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

  for (const prefix of prefixes) {
    console.log(`  ${prefix}:`);
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
      } else if (bf.required) {
        missingFiles.push({ prefix, filename: bf.filename });
      } else {
        optionalSkipped++;
      }
    }
  }

  const skippedNote = optionalSkipped > 0 ? ` (${optionalSkipped} optional skipped)` : '';
  console.log(`  Result: ${presentFiles}/${totalFiles} files present${skippedNote}.`);
  console.log('');

  if (!allExistencePassed) {
    // Print summary before early return so CI gets missing-files report
    printMarkdownSummary(allIssues, unvalidatedDirs, missingFiles, calendarByPrefix, today);
    console.log('❌ Validation failed (required files missing).\n');
    const elapsed = Math.round(performance.now() - t0);
    console.log(`Done in ${elapsed}ms. (exit code: ${EXIT_ERROR})`);
    process.exitCode = EXIT_ERROR;
    return;
  }

  // -------------------------------------------------------------------------
  // Step 3: Validate each bundle
  // -------------------------------------------------------------------------

  stepNum++;
  console.log(`--- [${stepNum}/${totalSteps}] Validate each bundle ---\n`);

  for (const prefix of prefixes) {
    console.log(`  ${prefix}:`);
    const existence = existenceResults.get(prefix)!;
    const sourceResult = validateSource(prefix, existence.files, state, allIssues);
    if (sourceResult.calendarServices.length > 0) {
      calendarByPrefix.set(prefix, sourceResult.calendarServices);
    }
    console.log('');
  }

  // Markdown summary
  printMarkdownSummary(allIssues, unvalidatedDirs, missingFiles, calendarByPrefix, today);

  // Final result
  let exitCode: number;
  if (state.hasError) {
    console.log('❌ Validation failed.\n');
    exitCode = EXIT_ERROR;
  } else if (state.hasWarn) {
    console.log('⚠️ Validation passed with warnings.\n');
    exitCode = EXIT_WARN;
  } else {
    console.log('✅ All checks passed.\n');
    exitCode = EXIT_OK;
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log(`\nDone in ${elapsed}ms. (exit code: ${exitCode})`);
  process.exitCode = exitCode;
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main, { fatalExitCode: EXIT_ERROR });
}
