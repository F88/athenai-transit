#!/usr/bin/env -S npx tsx

/**
 * Build v2 GlobalInsightsBundle from all targeted DataBundles.
 *
 * Loads DataBundles for all prefixes in the targets list, computes
 * cross-source spatial metrics (stopGeo), and writes a single
 * `global/insights.json` file.
 *
 * Input:  pipeline/workspace/_build/data-v2/{prefix}/data.json (per target)
 * Output: pipeline/workspace/_build/data-v2/global/insights.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --help
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataBundle } from '@contracts/data/transit-v2-json';

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';
import {
  extractStopEntries,
  findSundayServiceIds,
} from '../../../src/lib/pipeline/app-data-v2/build-global-stop-entries';
import type { StopEntry } from '../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import {
  buildParentStopGeo,
  buildStopGeo,
} from '../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import { writeGlobalInsightsBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import {
  type AggregateTargetResult,
  EXIT_ERROR,
  determineAggregateExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printAggregateSummary,
  runMain,
  uniqueInOrder,
} from '../../../src/lib/pipeline/pipeline-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_DIR = V2_OUTPUT_DIR;
const GLOBAL_DIR = join(OUTPUT_DIR, 'global');

/**
 * Service group key for Sunday-active services.
 *
 * Uses 'ho' (holiday/Sunday) as the cn key. The selection logic picks
 * service IDs active on at least one Sunday in the source calendar range,
 * including calendar_dates exceptions.
 */
const GROUP_KEY = 'ho';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-global-insights.ts --help',
  );
  console.log('');
  console.log('Options:');
  console.log('  --targets <file>  Target list file (.ts) specifying prefixes to include');
  console.log('  --help            Show this help message');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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

  const targetPrefixes = uniqueInOrder(await loadTargetFile(arg.path));

  console.log(`=== global-insights [START] ===\n`);
  console.log(`  Targets: ${targetPrefixes.length} sources (${targetPrefixes.join(', ')})`);
  console.log(`  Output:  ${GLOBAL_DIR}/insights.json`);
  console.log(`  Group:   ${GROUP_KEY} (Sunday-active services)`);
  console.log('');

  const t0 = performance.now();
  let fatalPrecondition = false;

  try {
    // Step 1: Load all DataBundles
    console.log('--- Loading DataBundles ---\n');
    const allStopEntries: StopEntry[] = [];
    const results: AggregateTargetResult[] = [];

    for (const prefix of targetPrefixes) {
      const tPrefix = performance.now();
      const dataPath = join(OUTPUT_DIR, prefix, 'data.json');
      if (!existsSync(dataPath)) {
        console.log(`  Skipped: ${prefix} (data.json not found)`);
        results.push({
          prefix,
          status: 'skipped',
          reason: 'data.json not found',
          durationMs: Math.round(performance.now() - tPrefix),
        });
        continue;
      }

      try {
        const raw = readFileSync(dataPath, 'utf-8');
        const bundle = JSON.parse(raw) as DataBundle;
        const sundayIds = findSundayServiceIds(bundle);
        const entries = extractStopEntries(bundle, sundayIds);

        const l0Count = entries.filter((e) => e.locationType === 0).length;
        const l1Count = entries.filter((e) => e.locationType === 1).length;
        console.log(`  ${prefix}: ${entries.length} stops (l0=${l0Count}, l1=${l1Count})`);

        allStopEntries.push(...entries);
        results.push({
          prefix,
          status: 'ok',
          reason: '',
          durationMs: Math.round(performance.now() - tPrefix),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED: ${prefix} (${message})`);
        results.push({
          prefix,
          status: 'failed',
          reason: message,
          durationMs: Math.round(performance.now() - tPrefix),
        });
      }
    }

    const exitCode = determineAggregateExitCode(results);

    // Conditional write: on EXIT_ERROR (all-skipped / all-failed) preserve
    // the previous workspace artifact instead of overwriting it with an
    // empty bundle. The workflow's "Fail on total" branch already stops
    // sync, so deployed data is never touched by a fatal run.
    if (exitCode !== EXIT_ERROR) {
      // Separate l=0 / l=1 and build childrenMap in a single pass
      const l0Stops: StopEntry[] = [];
      const l1Stops: StopEntry[] = [];
      const childrenMap = new Map<string, string[]>();
      for (const entry of allStopEntries) {
        if (entry.locationType === 0) {
          l0Stops.push(entry);
        } else if (entry.locationType === 1) {
          l1Stops.push(entry);
        }
        if (entry.parentStation) {
          const list = childrenMap.get(entry.parentStation) ?? [];
          list.push(entry.id);
          childrenMap.set(entry.parentStation, list);
        }
      }

      console.log(`\n  Total: ${l0Stops.length} l=0 stops, ${l1Stops.length} l=1 stops\n`);

      // Step 2: Compute stopGeo for l=0
      console.log('--- Computing stopGeo (l=0) ---\n');
      const l0Geo = buildStopGeo(l0Stops, GROUP_KEY, (current, total) => {
        const pct = ((current / total) * 100).toFixed(1);
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        console.log(`  [${current}/${total}] ${pct}% (${elapsed}s)`);
      });
      console.log(`  l=0 stopGeo: ${Object.keys(l0Geo).length} entries\n`);

      // Step 3: Compute stopGeo for l=1
      console.log('--- Computing stopGeo (l=1) ---\n');

      const l1Geo = buildParentStopGeo(l1Stops, childrenMap, l0Geo, l0Stops, GROUP_KEY);
      console.log(`  l=1 stopGeo: ${Object.keys(l1Geo).length} entries\n`);

      // Step 4: Merge and write
      const allGeo = { ...l0Geo, ...l1Geo };
      console.log('--- Writing GlobalInsightsBundle ---\n');
      writeGlobalInsightsBundle(GLOBAL_DIR, allGeo);
      console.log(`  Written: ${GLOBAL_DIR}/insights.json`);
      console.log(`  Total entries: ${Object.keys(allGeo).length}`);
    } else {
      console.log('\n  Skipped write: no targets produced an ok result.');
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
    // fatal precondition (e.g. write failure) reaches EXIT_ERROR via the
    // catch block above. The generic "all failed" label fits the
    // all-skipped/failed case from determineAggregateExitCode but is
    // misleading for fatal preconditions, so emit a more accurate label
    // when the catch path was taken.
    const exitLabel = fatalPrecondition
      ? `Exit code: ${code} (fatal precondition)`
      : formatExitCode(code);
    console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`${exitLabel}\n=== global-insights [END] ===`);
  }
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
