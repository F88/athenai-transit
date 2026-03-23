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

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import { V2_OUTPUT_DIR } from '../../../src/lib/paths';
// buildServiceGroups is available but not used directly — Sunday services
// are identified by d[6]===1 check instead of group key matching.
import type { StopEntry } from '../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import {
  buildStopGeo,
  buildParentStopGeo,
} from '../../../src/lib/pipeline/app-data-v2/build-stop-geo';
import { writeGlobalInsightsBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_DIR = V2_OUTPUT_DIR;
const GLOBAL_DIR = join(OUTPUT_DIR, 'global');

/** Service group key for holiday/Sunday. */
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

/**
 * Find service IDs that cover Sunday (d[6] === 1) from a DataBundle's calendar.
 */
function findSundayServiceIds(bundle: DataBundle): Set<string> {
  const ids = new Set<string>();
  for (const svc of bundle.calendar.data.services) {
    if (svc.d[6] === 1) {
      ids.add(svc.i);
    }
  }
  return ids;
}

/**
 * Extract StopEntry[] from a DataBundle for a given set of service IDs.
 */
function extractStopEntries(bundle: DataBundle, serviceIds: Set<string>): StopEntry[] {
  const patterns = bundle.tripPatterns.data;
  const entries: StopEntry[] = [];

  // Build stop -> route -> freq mapping
  const stopRouteFreqs = new Map<string, Map<string, number>>();
  const stopRouteIds = new Map<string, Set<string>>();

  for (const [, pattern] of Object.entries(patterns)) {
    for (const sid of pattern.stops) {
      if (!stopRouteIds.has(sid)) {
        stopRouteIds.set(sid, new Set());
      }
      stopRouteIds.get(sid)!.add(pattern.r);
    }
  }

  // Count freq per stop per route from timetable
  for (const [stopId, groups] of Object.entries(bundle.timetable.data)) {
    for (const g of groups) {
      const pattern = patterns[g.tp];
      if (!pattern) {
        continue;
      }

      let freq = 0;
      for (const svcId of serviceIds) {
        const deps = g.d[svcId];
        if (deps) {
          freq += deps.length;
        }
      }

      if (freq > 0) {
        if (!stopRouteFreqs.has(stopId)) {
          stopRouteFreqs.set(stopId, new Map());
        }
        const routeMap = stopRouteFreqs.get(stopId)!;
        routeMap.set(pattern.r, (routeMap.get(pattern.r) ?? 0) + freq);
      }
    }
  }

  // Build StopEntry for each stop
  for (const stop of bundle.stops.data) {
    entries.push({
      id: stop.i,
      lat: stop.a,
      lon: stop.o,
      routeIds: stopRouteIds.get(stop.i) ?? new Set<string>(),
      routeFreqs: stopRouteFreqs.get(stop.i) ?? new Map<string, number>(),
      parentStation: stop.ps,
      locationType: stop.l,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const arg = parseCliArg({ allowList: false, allowSourceName: false });

  if (arg.kind === 'help') {
    printUsage();
    return;
  }

  if (arg.kind !== 'targets') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const targetPrefixes = await loadTargetFile(arg.path);
  console.log(`=== Global Insights Build ===\n`);
  console.log(`  Targets: ${targetPrefixes.length} sources (${targetPrefixes.join(', ')})`);
  console.log(`  Output:  ${GLOBAL_DIR}/insights.json`);
  console.log(`  Group:   ${GROUP_KEY} (Sunday/holiday)`);
  console.log('');

  const t0 = performance.now();

  // Step 1: Load all DataBundles
  console.log('--- Loading DataBundles ---\n');
  const allStopEntries: StopEntry[] = [];
  let skipped = 0;

  for (const prefix of targetPrefixes) {
    const dataPath = join(OUTPUT_DIR, prefix, 'data.json');
    if (!existsSync(dataPath)) {
      console.log(`  Skipped: ${dataPath} not found`);
      skipped++;
      continue;
    }

    const raw = readFileSync(dataPath, 'utf-8');
    const bundle = JSON.parse(raw) as DataBundle;
    const sundayIds = findSundayServiceIds(bundle);
    const entries = extractStopEntries(bundle, sundayIds);

    const l0Count = entries.filter((e) => e.locationType === 0).length;
    const l1Count = entries.filter((e) => e.locationType === 1).length;
    console.log(`  ${prefix}: ${entries.length} stops (l0=${l0Count}, l1=${l1Count})`);

    allStopEntries.push(...entries);
  }

  if (skipped > 0) {
    console.log(`\n  ${skipped} source(s) skipped.`);
  }

  // Separate l=0 and l=1
  const l0Stops = allStopEntries.filter((e) => e.locationType === 0);
  const l1Stops = allStopEntries.filter((e) => e.locationType === 1);

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
  const childrenMap = new Map<string, string[]>();
  for (const stop of allStopEntries) {
    if (stop.parentStation) {
      const list = childrenMap.get(stop.parentStation) ?? [];
      list.push(stop.id);
      childrenMap.set(stop.parentStation, list);
    }
  }

  const l1Geo = buildParentStopGeo(l1Stops, childrenMap, l0Geo, l0Stops, GROUP_KEY);
  console.log(`  l=1 stopGeo: ${Object.keys(l1Geo).length} entries\n`);

  // Step 4: Merge and write
  const allGeo = { ...l0Geo, ...l1Geo };
  console.log('--- Writing GlobalInsightsBundle ---\n');
  writeGlobalInsightsBundle(GLOBAL_DIR, allGeo);
  console.log(`  Written: ${GLOBAL_DIR}/insights.json`);
  console.log(`  Total entries: ${Object.keys(allGeo).length}`);

  const durationMs = performance.now() - t0;
  console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
