#!/usr/bin/env -S npx tsx

/**
 * Build v2 DataBundle JSON from ODPT Train API data.
 *
 * Each invocation processes a single ODPT Train source. For batch processing,
 * use `--targets <file>`.
 *
 * Input:  pipeline/workspace/data/odpt-json/{outDir}/ (3 JSON files)
 * Output: pipeline/workspace/_build/data-v2/{prefix}/data.json (DataBundle)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --list
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import {
  listOdptTrainSourceNames,
  loadOdptTrainSource,
} from '../../../src/lib/resources/load-odpt-train-sources';
import type { OdptTrainSource } from '../../../src/lib/resources/load-odpt-train-sources';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline/pipeline-utils';
import type { OdptRailway, OdptStation, OdptStationTimetable } from '../../../src/types/odpt-train';
import { writeDataBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import { buildAgencyV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-common/build-agency';
import { buildFeedInfoV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-common/build-feed-info';
import { buildCalendarV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-train/build-calendar';
import { buildRoutesV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-train/build-routes';
import { buildStopsV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-train/build-stops';
import { buildTripPatternsAndTimetableFromOdpt } from '../../../src/lib/pipeline/app-data-v2/odpt-train/build-timetable';
import { buildTranslationsV2 } from '../../../src/lib/pipeline/app-data-v2/odpt-train/build-translations';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V2_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceDataBundle(source: OdptTrainSource): void {
  const { prefix, provider, dataDir } = source;

  // Check input files exist
  const stationFile = join(dataDir, 'odpt_Station.json');
  const railwayFile = join(dataDir, 'odpt_Railway.json');
  const timetableFile = join(dataDir, 'odpt_StationTimetable.json');

  for (const file of [stationFile, railwayFile, timetableFile]) {
    if (!existsSync(file)) {
      throw new Error(`Input file not found: ${file}`);
    }
  }

  // 1. Load input data
  console.log('Loading ODPT JSON data...');
  const stations: OdptStation[] = JSON.parse(readFileSync(stationFile, 'utf-8')) as OdptStation[];
  const railways: OdptRailway[] = JSON.parse(readFileSync(railwayFile, 'utf-8')) as OdptRailway[];
  const timetables: OdptStationTimetable[] = JSON.parse(
    readFileSync(timetableFile, 'utf-8'),
  ) as OdptStationTimetable[];

  console.log(`  ${stations.length} stations`);
  console.log(`  ${railways.length} railways`);
  console.log(`  ${timetables.length} station timetables`);

  if (railways.length === 0) {
    throw new Error('No railway data found.');
  }
  if (timetables.length === 0) {
    throw new Error('No station timetable data found.');
  }

  // 2. Extract issued date from timetable for calendar validity
  const issuedDate = timetables[0]['dct:issued'];
  console.log(`  Issued date: ${issuedDate}\n`);

  // 3. Build all sections
  console.log('Building v2 DataBundle...');

  const allStationOrders = railways.flatMap((rw) => rw['odpt:stationOrder']);
  const stops = buildStopsV2(prefix, stations, allStationOrders);
  console.log(`  ${stops.length} stops`);

  const routes = railways.flatMap((rw) => buildRoutesV2(prefix, rw, provider));
  console.log(`  ${routes.length} routes`);

  const calendar = buildCalendarV2(prefix, timetables, issuedDate);
  console.log(`  ${calendar.services.length} services`);

  const agencies = buildAgencyV2(prefix, provider);
  console.log(`  ${agencies.length} agencies`);

  const feedInfo = buildFeedInfoV2(issuedDate, provider);
  console.log(`  feed-info: ${feedInfo.pn} (v${feedInfo.v})`);

  const translations = buildTranslationsV2(prefix, timetables, railways, stations);
  console.log(`  ${Object.keys(translations.trip_headsigns).length} trip headsign translations`);

  const { tripPatterns, timetable } = buildTripPatternsAndTimetableFromOdpt(
    prefix,
    timetables,
    railways,
  );
  console.log(`  ${Object.keys(tripPatterns).length} trip patterns`);
  console.log(`  ${Object.keys(timetable).length} stops in timetable`);

  // 4. Assemble DataBundle
  const bundle: DataBundle = {
    bundle_version: 3,
    kind: 'data',
    stops: { v: 2, data: stops },
    routes: { v: 2, data: routes },
    agency: { v: 2, data: agencies },
    calendar: { v: 1, data: calendar },
    feedInfo: { v: 1, data: feedInfo },
    timetable: { v: 2, data: timetable },
    tripPatterns: { v: 2, data: tripPatterns },
    translations: { v: 1, data: translations },
    lookup: { v: 2, data: {} }, // ODPT has no lookup data
  };

  // 5. Write atomically
  const outputDir = join(OUTPUT_DIR, prefix);
  writeDataBundle(outputDir, bundle);
  console.log(`  Written: ${outputDir}/data.json`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-from-odpt-train.ts --list\n',
  );
  console.log('Options:');
  console.log('  --targets <file>  Batch build from a target list file (.ts)');
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
    const names = await listOdptTrainSourceNames();
    console.log('Available ODPT Train sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-v2-data-from-odpt-train (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-from-odpt-train.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  let source: OdptTrainSource;
  try {
    source = await loadOdptTrainSource(arg.name);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.log('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${source.resources.station.resource.nameEn}`);
  console.log(`  Prefix: ${source.prefix}`);
  console.log(`  Input:  ${source.dataDir}/`);
  console.log(`  Output: ${join(OUTPUT_DIR, source.prefix)}/data.json`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceDataBundle(source);
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${err.cause.message}`);
    }
    process.exitCode = 1;
  } finally {
    const durationMs = performance.now() - t0;
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Exit code: ${code} (${label})\n=== ${arg.name} [END] ===`);
  }
}

// Only run main() when executed directly (not when imported by other scripts).
const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
