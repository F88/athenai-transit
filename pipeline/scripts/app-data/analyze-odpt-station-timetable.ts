#!/usr/bin/env -S npx tsx

/**
 * Analyze ODPT StationTimetable data patterns.
 *
 * Detects time field availability, station/direction/calendar coverage,
 * destination and train type distributions, flag usage, and unknown keys.
 * Useful for understanding ODPT data quality and planning timetable extraction.
 *
 * Usage:
 *   npx tsx pipeline/scripts/app-data/analyze-odpt-station-timetable.ts              # all sources
 *   npx tsx pipeline/scripts/app-data/analyze-odpt-station-timetable.ts <source>     # single source
 *   npx tsx pipeline/scripts/app-data/analyze-odpt-station-timetable.ts --list       # list sources
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OdptRailway, OdptStationTimetable } from '../../src/types/odpt-train';
import { runMain } from '../../src/lib/pipeline-utils';
import { listSourceNames, loadSource } from './build-app-data-from-odpt-train';
import {
  analyzeOdptStationTimetable,
  formatOdptAnalysis,
} from './lib/odpt-station-timetable-analysis';

async function analyzeSource(name: string): Promise<void> {
  const source = await loadSource(name);

  const railwayFile = join(source.dataDir, 'odpt_Railway.json');
  const timetableFile = join(source.dataDir, 'odpt_StationTimetable.json');

  if (!existsSync(railwayFile) || !existsSync(timetableFile)) {
    console.warn(`  [${name}] Data not found — skipped`);
    return;
  }

  const railways: OdptRailway[] = JSON.parse(readFileSync(railwayFile, 'utf-8')) as OdptRailway[];
  const timetables: OdptStationTimetable[] = JSON.parse(
    readFileSync(timetableFile, 'utf-8'),
  ) as OdptStationTimetable[];

  // Analyze per railway (most sources have a single railway)
  for (const railway of railways) {
    // Filter timetables to stations belonging to this railway
    const railwayStations = new Set(railway['odpt:stationOrder'].map((so) => so['odpt:station']));
    const filtered = timetables.filter((tt) => railwayStations.has(tt['odpt:station']));

    const label = railways.length > 1 ? `${name} / ${railway['odpt:railwayTitle'].ja}` : name;
    const result = analyzeOdptStationTimetable(filtered, railway);
    console.log(formatOdptAnalysis(label, result));
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (arg === '--help' || arg === '-h') {
    console.log('Usage: analyze-odpt-station-timetable.ts [source-name | --list]');
    console.log('  No args    Analyze all ODPT Train sources');
    console.log('  <source>   Analyze a single source');
    console.log('  --list     List available sources');
    return;
  }

  if (arg === '--list') {
    const names = await listSourceNames();
    for (const n of names) {
      console.log(n);
    }
    return;
  }

  if (arg) {
    await analyzeSource(arg);
    return;
  }

  // No args: analyze all sources
  const names = await listSourceNames();
  for (const name of names) {
    await analyzeSource(name);
  }
}

runMain(main);
