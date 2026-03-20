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
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-stop-times.ts --list       # list sources
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { listGtfsSourceNames, loadGtfsSource } from '../../src/lib/resources/load-gtfs-sources';
import { runMain } from '../../src/lib/pipeline-utils';
import { analyzeStopTimes, formatAnalysis } from './lib/gtfs-stop-times-analysis';

import { DB_DIR } from '../../src/lib/paths';

async function analyzeSource(name: string): Promise<void> {
  const source = await loadGtfsSource(name);
  const dbPath = join(DB_DIR, `${source.pipeline.outDir}.db`);

  if (!existsSync(dbPath)) {
    console.warn(`  [${name}] DB not found: ${dbPath} — skipped`);
    return;
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const result = analyzeStopTimes(db);
    console.log(formatAnalysis(name, result));
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (arg === '--help' || arg === '-h') {
    console.log('Usage: analyze-gtfs-stop-times.ts [source-name | --list]');
    console.log('  No args    Analyze all GTFS sources');
    console.log('  <source>   Analyze a single source');
    console.log('  --list     List available sources');
    return;
  }

  if (arg === '--list') {
    const names = listGtfsSourceNames();
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
  const names = listGtfsSourceNames();
  for (const name of names) {
    await analyzeSource(name);
  }
}

runMain(main);
