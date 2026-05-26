#!/usr/bin/env -S npx tsx

/**
 * Build v2 DataSourceCatalogBundle from targeted prefixes.
 *
 * Input:  target list file (`--targets <file>`) containing prefixes
 * Output: pipeline/workspace/_build/data-v2/global/data-source-catalog.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';
import { buildDataSourceCatalogBundle } from '../../../src/lib/pipeline/app-data-v2/build-data-source-catalog';
import { writeDataSourceCatalogBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import {
  EXIT_ERROR,
  determineAggregateExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printAggregateSummary,
  runMain,
} from '../../../src/lib/pipeline/pipeline-utils';

const OUTPUT_DIR = V2_OUTPUT_DIR;
const GLOBAL_DIR = join(OUTPUT_DIR, 'global');

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help',
  );
  console.log('');
  console.log('Options:');
  console.log('  --targets <file>  Target list file (.ts) specifying prefixes to include');
  console.log('  --help            Show this help message');
}

export async function main(): Promise<void> {
  const arg = parseCliArg({ allowList: false, allowSourceName: false });

  if (arg.kind === 'help') {
    printUsage();
    return;
  }

  if (arg.kind !== 'targets') {
    printUsage();
    process.exitCode = EXIT_ERROR;
    return;
  }

  const targetPrefixes = await loadTargetFile(arg.path);

  console.log('=== data-source-catalog [START] ===\n');
  console.log(`  Targets: ${targetPrefixes.length} prefixes (${targetPrefixes.join(', ')})`);
  console.log(`  Output:  ${GLOBAL_DIR}/data-source-catalog.json`);
  console.log('');

  const t0 = performance.now();
  let fatalPrecondition = false;

  try {
    const { bundle, results } = await buildDataSourceCatalogBundle(targetPrefixes);
    const exitCode = determineAggregateExitCode(results);

    // Conditional write: on EXIT_ERROR (all-skipped / all-failed) preserve
    // the previous workspace artifact instead of overwriting it with an
    // empty catalog. The workflow's "Fail on total" branch already stops
    // sync, so deployed data is never touched by a fatal run.
    if (exitCode !== EXIT_ERROR) {
      writeDataSourceCatalogBundle(GLOBAL_DIR, bundle);
      console.log(`  Built catalog entries: ${Object.keys(bundle.sources.data).length}`);
      console.log(`  Written: ${GLOBAL_DIR}/data-source-catalog.json`);
    } else {
      console.log('  Skipped write: no targets produced an ok result.');
    }

    printAggregateSummary(results);
    process.exitCode = exitCode;
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${err.cause.message}`);
    }
    process.exitCode = EXIT_ERROR;
    fatalPrecondition = true;
  } finally {
    const durationMs = performance.now() - t0;
    const code = Number(process.exitCode ?? 0);
    // fatal precondition (e.g. unknown prefix, missing global insights,
    // write failure) reaches EXIT_ERROR via the catch block above. The
    // generic "all failed" label fits the all-skipped/failed case from
    // determineAggregateExitCode but is misleading for fatal preconditions,
    // so emit a more accurate label when the catch path was taken.
    const exitLabel = fatalPrecondition
      ? `Exit code: ${code} (fatal precondition)`
      : formatExitCode(code);
    console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`${exitLabel}\n=== data-source-catalog [END] ===`);
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
