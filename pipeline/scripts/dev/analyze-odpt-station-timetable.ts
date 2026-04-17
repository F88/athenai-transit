#!/usr/bin/env -S npx tsx

/**
 * Analyze ODPT StationTimetable data patterns.
 *
 * Detects time field availability, station/direction/calendar coverage,
 * destination and train type distributions, flag usage, and unknown keys.
 * Useful for understanding ODPT data quality and planning timetable extraction.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts              # all sources
 *   npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts <source>     # single source
 *   npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts <a> <b>      # selected sources
 *   npx tsx pipeline/scripts/dev/analyze-odpt-station-timetable.ts --list-sources
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OdptRailway, OdptStationTimetable } from '../../src/types/odpt-train';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';
import {
  listOdptTrainSourceNames as listSourceNames,
  loadOdptTrainSource as loadSource,
} from '../../src/lib/resources/load-odpt-train-sources';
import {
  analyzeOdptStationTimetable,
  formatOdptAnalysis,
  ODPT_STATION_TIMETABLE_SECTION_NAMES,
  type OdptStationTimetableSectionName,
} from './dev-lib/odpt-station-timetable-analysis';
import { parseArgsForMultiSources } from './dev-lib/parse-args';

function isOdptStationTimetableSectionName(
  value: string,
): value is OdptStationTimetableSectionName {
  return (ODPT_STATION_TIMETABLE_SECTION_NAMES as readonly string[]).includes(value);
}

async function analyzeSource(
  name: string,
  sections: OdptStationTimetableSectionName[],
): Promise<void> {
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
    console.log(formatOdptAnalysis(label, result, { sections }));
  }
}

async function main(): Promise<void> {
  const mode = parseArgsForMultiSources(process.argv.slice(2));
  const names = await listSourceNames();

  if (mode.kind === 'help') {
    console.log(
      'Usage: analyze-odpt-station-timetable.ts [source-name ...] [--section <name> ...]',
    );
    console.log('  No args    Analyze all ODPT Train sources');
    console.log('  <source>   Analyze one or more sources');
    console.log('  --list-sources  List available sources');
    console.log('  --list-sections List available section names');
    console.log('  --section <name> Limit output to the selected section (repeatable)');
    return;
  }

  const invalidSections = mode.sections.filter(
    (section) => !isOdptStationTimetableSectionName(section),
  );
  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }

  const sections = mode.sections as OdptStationTimetableSectionName[];

  if (mode.kind === 'list') {
    if (mode.target === 'sections') {
      for (const sectionName of ODPT_STATION_TIMETABLE_SECTION_NAMES) {
        console.log(sectionName);
      }
      return;
    }
    for (const n of names) {
      console.log(n);
    }
    return;
  }

  if (mode.kind === 'sources') {
    const missingSources = mode.names.filter((name) => !names.includes(name));
    if (missingSources.length > 0) {
      console.error(`Source not found: ${missingSources.join(', ')}`);
      console.error('Run with --list-sources to see available sources.');
      process.exitCode = 1;
      return;
    }

    for (const name of mode.names) {
      await analyzeSource(name, sections);
    }
    return;
  }

  for (const name of names) {
    await analyzeSource(name, sections);
  }
}

runMain(main);
