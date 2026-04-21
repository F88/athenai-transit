#!/usr/bin/env -S npx tsx

/**
 * Analyze GTFS `routes.txt` files across multiple current-state sections.
 *
 * Reads `pipeline/workspace/data/gtfs/<source>/routes.txt` and summarizes
 * route names, route types, colors, cEMV support, continuous service fields,
 * and optional presentation / operational fields.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts           # all GTFS sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts <source>  # single source
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts <a> <b>   # selected sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts --list-sources
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts --list-sections
 *   npx tsx pipeline/scripts/dev/analyze-gtfs-routes.ts --section route-types
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listGtfsSourceNames, loadGtfsSource } from '../../src/lib/resources/load-gtfs-sources';
import { GTFS_DATA_DIR } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';
import {
  analyzeGtfsRoutesCsv,
  formatGtfsRoutesAnalysis,
  GTFS_ROUTES_SECTIONS,
  GTFS_ROUTES_SECTION_NAMES,
  type GtfsRoutesSectionName,
  type GtfsRoutesSourceStats,
} from './dev-lib/gtfs-routes-analysis';
import { formatAnalysisSectionList } from './dev-lib/analysis-sections';
import { parseArgsForMultiSources } from './dev-lib/parse-args';

function printHelp(): void {
  console.log('Usage: analyze-gtfs-routes.ts [source-name ...] [--section <name> ...]');
  console.log('  No args    Analyze all GTFS sources');
  console.log('  <source>   Analyze one or more GTFS sources');
  console.log('  --list-sources   List available GTFS sources');
  console.log('  --list-sections  List available section names with short descriptions');
  console.log('  --section <name> Limit output to the selected section (repeatable)');
}

function isGtfsRoutesSectionName(value: string): value is GtfsRoutesSectionName {
  return (GTFS_ROUTES_SECTION_NAMES as readonly string[]).includes(value);
}

async function analyzeSource(sourceName: string): Promise<GtfsRoutesSourceStats> {
  const definition = await loadGtfsSource(sourceName);
  const routesPath = join(GTFS_DATA_DIR, definition.pipeline.outDir, 'routes.txt');

  if (!existsSync(routesPath)) {
    throw new Error(`routes.txt not found: ${routesPath}`);
  }

  return analyzeGtfsRoutesCsv({
    sourceName,
    prefix: definition.pipeline.prefix,
    nameEn: definition.resource.nameEn,
    routesPath,
    csvText: readFileSync(routesPath, 'utf-8'),
  });
}

async function main(): Promise<void> {
  const mode = parseArgsForMultiSources(process.argv.slice(2));
  const sourceNames = listGtfsSourceNames();
  const invalidSections = mode.sections.filter((section) => !isGtfsRoutesSectionName(section));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }

  if (mode.kind === 'list') {
    const values =
      mode.target === 'sections'
        ? formatAnalysisSectionList(GTFS_ROUTES_SECTION_NAMES, GTFS_ROUTES_SECTIONS, {
            maxDescriptionLength: 72,
          })
        : sourceNames;
    for (const value of values) {
      console.log(value);
    }
    return;
  }

  const sections = mode.sections as GtfsRoutesSectionName[];

  if (mode.kind === 'sources') {
    const missingSources = mode.names.filter((name) => !sourceNames.includes(name));
    if (missingSources.length > 0) {
      console.error(`Source not found: ${missingSources.join(', ')}`);
      console.error('Run with --list-sources to see available sources.');
      process.exitCode = 1;
      return;
    }

    const results: GtfsRoutesSourceStats[] = [];
    for (const sourceName of mode.names) {
      results.push(await analyzeSource(sourceName));
    }

    console.log(formatGtfsRoutesAnalysis(results, { sections }));
    return;
  }

  const results: GtfsRoutesSourceStats[] = [];
  for (const sourceName of sourceNames) {
    results.push(await analyzeSource(sourceName));
  }

  console.log(formatGtfsRoutesAnalysis(results, { sections }));
}

runMain(main);
