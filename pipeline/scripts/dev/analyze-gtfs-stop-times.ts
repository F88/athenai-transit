#!/usr/bin/env -S npx tsx

/**
 * Analyze stop_times patterns in GTFS databases.
 *
 * Detects terminal-only stops, circular routes, pickup/drop-off types,
 * dwell times, and interpolation needs. Useful for understanding data
 * quality and identifying stops that should be excluded from timetables.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts              # all sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts <source>     # single source
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts <a> <b>      # selected sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts --list-sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts --list-sections
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts --section interpolation
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { listGtfsSourceNames, loadGtfsSource } from '../../src/lib/resources/load-gtfs-sources';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';
import {
  analyzeStopTimes,
  formatAnalysis,
  GTFS_STOP_TIMES_SECTIONS,
  GTFS_STOP_TIMES_SECTION_NAMES,
  type GtfsStopTimesSectionName,
} from './dev-lib/gtfs-stop-times-analysis';
import { formatAnalysisSectionList } from './dev-lib/analysis-sections';
import { parseArgsForMultiSources } from './dev-lib/parse-args';

import { DB_DIR } from '../../src/lib/paths';

function isGtfsStopTimesSectionName(value: string): value is GtfsStopTimesSectionName {
  return (GTFS_STOP_TIMES_SECTION_NAMES as readonly string[]).includes(value);
}

async function analyzeSource(name: string, sections: GtfsStopTimesSectionName[]): Promise<void> {
  const source = await loadGtfsSource(name);
  const dbPath = join(DB_DIR, `${source.pipeline.outDir}.db`);

  if (!existsSync(dbPath)) {
    console.warn(`  [${name}] DB not found: ${dbPath} — skipped`);
    return;
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const result = analyzeStopTimes(db);
    console.log(formatAnalysis(name, result, { sections }));
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const mode = parseArgsForMultiSources(process.argv.slice(2));
  const names = listGtfsSourceNames();

  if (mode.kind === 'help') {
    console.log('Usage: analyze-gtfs-stop-times.ts [source-name ...] [--section <name> ...]');
    console.log('  No args    Analyze all GTFS sources');
    console.log('  <source>   Analyze one or more sources');
    console.log('  --list-sources  List available sources');
    console.log('  --list-sections List available section names with short descriptions');
    console.log('  --section <name> Limit output to the selected section (repeatable)');
    return;
  }

  const invalidSections = mode.sections.filter((section) => !isGtfsStopTimesSectionName(section));
  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }

  const sections = mode.sections as GtfsStopTimesSectionName[];

  if (mode.kind === 'list') {
    if (mode.target === 'sections') {
      for (const line of formatAnalysisSectionList(
        GTFS_STOP_TIMES_SECTION_NAMES,
        GTFS_STOP_TIMES_SECTIONS,
      )) {
        console.log(line);
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
