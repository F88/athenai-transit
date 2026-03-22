#!/usr/bin/env -S npx tsx

/**
 * Validate v2 bundle files (DataBundle, ShapesBundle, InsightsBundle).
 *
 * Runs all available validators for each target source. Currently
 * only ShapesBundle validation is implemented; DataBundle and
 * InsightsBundle validators will be added as those pipelines mature.
 *
 * Target: pipeline/workspace/_build/data-v2/{prefix}/
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — warnings (e.g. empty shapes)
 *   2 — errors (missing files, invalid structure, invalid data)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/validate-v2-bundles.ts --list
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';
import { collectAllKsjTargets } from '../../../src/lib/pipeline/extract-shapes-from-ksj';
import {
  validateDataBundle,
  type DataValidationResult,
} from '../../../src/lib/pipeline/app-data-v2/validate-data';
import {
  validateShapesBundle,
  type ShapesValidationResult,
} from '../../../src/lib/pipeline/app-data-v2/validate-shapes';

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
// Result printing
// ---------------------------------------------------------------------------

function printDataResult(result: DataValidationResult): void {
  console.log(`    Stops:     ${result.stopCount}`);
  console.log(`    Routes:    ${result.routeCount}`);
  console.log(`    Services:  ${result.serviceCount}`);
  console.log(`    Patterns:  ${result.patternCount}`);
  console.log(`    TT Stops:  ${result.timetableStopCount}`);

  if (result.issues.length === 0) {
    console.log('    Result:    OK');
  } else {
    for (const issue of result.issues) {
      if (issue.level === 'error') {
        console.log(`    ERROR: ${issue.message}`);
      } else {
        console.log(`    WARN:  ${issue.message}`);
      }
    }
  }
}

function printShapesResult(result: ShapesValidationResult): void {
  console.log(`    Routes:    ${result.routeCount}`);
  console.log(`    Polylines: ${result.polylineCount}`);
  console.log(`    Points:    ${result.pointCount}`);

  if (result.issues.length === 0) {
    console.log('    Result:    OK');
  } else {
    for (const issue of result.issues) {
      if (issue.level === 'error') {
        console.log(`    ERROR: ${issue.message}`);
      } else {
        console.log(`    WARN:  ${issue.message}`);
      }
    }
  }
}

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

  console.log(`=== Validate v2 bundles (${sources.length} sources) ===\n`);

  let hasError = false;
  let hasWarn = false;

  for (const { name, prefix } of sources) {
    console.log(`--- ${name} (${prefix}) ---\n`);

    // DataBundle validation
    console.log('  [DataBundle]');
    const dataResult = validateDataBundle(prefix, V2_OUTPUT_DIR);
    printDataResult(dataResult);

    for (const issue of dataResult.issues) {
      if (issue.level === 'error') {
        hasError = true;
      } else {
        hasWarn = true;
      }
    }

    // ShapesBundle validation (optional — skip if shapes.json not expected)
    console.log('  [ShapesBundle]');
    const shapesResult = validateShapesBundle(prefix, V2_OUTPUT_DIR);
    printShapesResult(shapesResult);

    for (const issue of shapesResult.issues) {
      if (issue.level === 'error') {
        hasError = true;
      } else {
        hasWarn = true;
      }
    }

    // TODO: validateInsightsBundle (future)

    console.log('');
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
