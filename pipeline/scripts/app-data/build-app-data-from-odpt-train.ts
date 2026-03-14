#!/usr/bin/env -S npx tsx

/**
 * Convert ODPT Train API data into optimized JSON files for the web app.
 *
 * This script handles the ODPT Train API (Chapter 3 of the ODPT API
 * Specification). It uses the following data types defined in the spec:
 *
 * - {@link https://developer.odpt.org/documents | odpt:Station} — station location and multilingual names
 * - {@link https://developer.odpt.org/documents | odpt:Railway} — route info, station order, line color
 * - {@link https://developer.odpt.org/documents | odpt:StationTimetable} — departure times by direction and calendar
 *
 * @see ODPT API Specification v4.15 (2025-11-28)
 *      https://developer.odpt.org/documents
 * @see Local copy: pipeline/references/ODPT-API-v4.15/ODPT-API-SPEC-v4.15.pdf
 *
 * Each invocation processes a single ODPT Train source. For batch processing,
 * use `--targets <file>` which runs this script once per source in a
 * child process (same pattern as build-app-data-from-gtfs.ts).
 *
 * A "source" is identified by the shared outDir of ODPT JSON resource
 * definitions. A valid ODPT Train source must have all three required
 * resource types: odpt:Station, odpt:Railway, odpt:StationTimetable.
 *
 * Input:  pipeline/data/odpt-json/{outDir}/ (3 JSON files)
 * Output: pipeline/build/data/{prefix}/ (7 JSON files; shapes.json by KSJ script)
 *
 * Usage:
 *   npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts <source-name>
 *   npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts --targets <file>
 *   npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts --list
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

import type {
  AgencyJson,
  FeedInfoJson,
  RouteJson,
  TranslationsJson,
} from '../../../src/types/data/transit-json';
import type {
  OdptRailway,
  OdptStation,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../types/odpt-train';
import { loadAllOdptJsonSources } from '../../lib/load-odpt-json-sources';
import {
  determineBatchExitCode,
  formatBytes,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../lib/pipeline-utils';
import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';
import type { Provider } from '../../types/resource-common';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '../..');
const DATA_BASE_DIR = join(ROOT, 'data/odpt-json');
const OUTPUT_DIR = join(ROOT, 'build/data');

// ---------------------------------------------------------------------------
// ODPT Train source discovery
// ---------------------------------------------------------------------------

/** Required ODPT data types for a valid Train source. */
const REQUIRED_ODPT_TYPES = ['odpt:Station', 'odpt:Railway', 'odpt:StationTimetable'] as const;

/** Resolved ODPT Train source with all required resources. */
interface OdptTrainSource {
  /** Source identifier (outDir name, e.g. "yurikamome"). */
  name: string;
  /** Output prefix (e.g. "yrkm"). */
  prefix: string;
  /** Data provider info. */
  provider: Provider;
  /** Path to the data directory. */
  dataDir: string;
  /** Resource definitions grouped by odptType. */
  resources: {
    station: OdptJsonSourceDefinition;
    railway: OdptJsonSourceDefinition;
    stationTimetable: OdptJsonSourceDefinition;
  };
}

/**
 * Discover available ODPT Train sources by grouping resources by outDir.
 * A valid source must have all 3 required types.
 */
async function discoverOdptTrainSources(): Promise<OdptTrainSource[]> {
  const allDefs = await loadAllOdptJsonSources();

  // Group by outDir
  const groups = new Map<string, OdptJsonSourceDefinition[]>();
  for (const def of allDefs) {
    const key = def.pipeline.outDir;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(def);
  }

  // Filter to groups that have all 3 required types
  const sources: OdptTrainSource[] = [];
  for (const [outDir, defs] of groups) {
    const byType = new Map(defs.map((d) => [d.resource.odptType, d]));
    const hasAll = REQUIRED_ODPT_TYPES.every((t) => byType.has(t));
    if (!hasAll) {
      continue;
    }

    const station = byType.get('odpt:Station')!;
    const railway = byType.get('odpt:Railway')!;
    const stationTimetable = byType.get('odpt:StationTimetable')!;

    sources.push({
      name: outDir,
      prefix: station.pipeline.prefix,
      provider: station.resource.provider,
      dataDir: join(DATA_BASE_DIR, outDir),
      resources: { station, railway, stationTimetable },
    });
  }

  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List available ODPT Train source names.
 */
async function listSourceNames(): Promise<string[]> {
  const sources = await discoverOdptTrainSources();
  return sources.map((s) => s.name);
}

/**
 * Load a single ODPT Train source by name.
 */
async function loadSource(name: string): Promise<OdptTrainSource> {
  const sources = await discoverOdptTrainSources();
  const source = sources.find((s) => s.name === name);
  if (!source) {
    const available = sources.map((s) => s.name).join(', ');
    throw new Error(`Unknown ODPT Train source: "${name}". Available: ${available || '(none)'}`);
  }
  return source;
}

// ODPT JSON types — see pipeline/types/odpt-train.ts

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data));
  const size = statSync(filePath).size;
  const name = basename(filePath);
  console.log(`  ${name.padEnd(20)} ${formatBytes(size).padStart(10)}`);
}

/**
 * Extract short station name from ODPT station ID.
 * e.g. "odpt.Station:Yurikamome.Yurikamome.Shimbashi" -> "Shimbashi"
 */
export function extractStationShortId(odptId: string): string {
  const parts = odptId.split('.');
  return parts[parts.length - 1];
}

/**
 * Map ODPT calendar to service ID.
 * "odpt.Calendar:Weekday" -> "weekday"
 * "odpt.Calendar:SaturdayHoliday" -> "saturday-holiday"
 */
export function calendarToServiceId(calendar: string): string {
  const calendarName = calendar.split(':')[1];
  if (calendarName === 'SaturdayHoliday') {
    return 'saturday-holiday';
  }
  return calendarName.toLowerCase();
}

/**
 * Convert "HH:MM" departure time to minutes from midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Determine the headsign (destination station name) from rail direction.
 *
 * ODPT defines ascending/descending directions via odpt:ascendingRailDirection
 * and odpt:descendingRailDirection. Ascending travels in index order (toward
 * the last station), descending travels in reverse (toward the first station).
 *
 * The convention maps Outbound = ascending, Inbound = descending.
 */
export function getHeadsignFromDirection(
  direction: string,
  stationOrder: OdptStationOrder[],
): string {
  if (direction === 'odpt.RailDirection:Outbound') {
    return stationOrder[stationOrder.length - 1]['odpt:stationTitle'].ja;
  }
  // Inbound
  return stationOrder[0]['odpt:stationTitle'].ja;
}

/**
 * Compute start/end dates from an issued date string.
 * end = issued + 1 year.
 */
export function computeDateRange(issuedDate: string): { startDate: string; endDate: string } {
  const startDate = issuedDate.replace(/-/g, '');
  const [y, m, d] = issuedDate.split('-').map(Number);
  // Add 1 year. If the resulting date doesn't exist (e.g. Feb 29 in
  // a non-leap year), Date rolls forward to Mar 1. Detect this by
  // checking if the month changed, and clamp to the last day of the
  // intended month.
  const end = new Date(y + 1, m - 1, d);
  if (end.getMonth() !== m - 1) {
    // Rolled over — set to last day of the intended month
    end.setDate(0); // day 0 = last day of previous month
  }
  const endY = end.getFullYear();
  const endM = String(end.getMonth() + 1).padStart(2, '0');
  const endD = String(end.getDate()).padStart(2, '0');
  return { startDate, endDate: `${endY}${endM}${endD}` };
}

// ---------------------------------------------------------------------------
// Extraction functions
// ---------------------------------------------------------------------------

export function buildStops(
  prefix: string,
  stations: OdptStation[],
  stationOrder: OdptStationOrder[],
): { i: string; n: string; m: Record<string, string>; a: number; o: number; l: number }[] {
  // Build order map for consistent sorting
  const orderMap = new Map<string, number>();
  for (const entry of stationOrder) {
    orderMap.set(entry['odpt:station'], entry['odpt:index']);
  }

  // Sort by station order
  const sorted = [...stations].sort((a, b) => {
    const aIdx = orderMap.get(a['owl:sameAs']) ?? 999;
    const bIdx = orderMap.get(b['owl:sameAs']) ?? 999;
    return aIdx - bIdx;
  });

  return sorted.map((s) => {
    const shortId = extractStationShortId(s['owl:sameAs']);
    const title = s['odpt:stationTitle'];
    const names: Record<string, string> = { ja: title.ja, en: title.en };
    if (title.ko) {
      names.ko = title.ko;
    }
    if (title['zh-Hans']) {
      names['zh-Hans'] = title['zh-Hans'];
    }
    return {
      i: `${prefix}:${shortId}`,
      n: title.ja,
      m: names,
      a: s['geo:lat'],
      o: s['geo:long'],
      l: 0,
    };
  });
}

export function buildRoutes(prefix: string, railway: OdptRailway, provider: Provider): RouteJson[] {
  const title = railway['odpt:railwayTitle'];
  const color = railway['odpt:color'].replace('#', '');
  const routeId = `${prefix}:${railway['odpt:lineCode']}`;

  return [
    {
      i: routeId,
      s: '',
      l: title.ja,
      t: 2, // Rail
      c: color,
      tc: '',
      m: { ja: title.ja, en: title.en },
      ai: `${prefix}:${provider.nameEn}`,
    },
  ];
}

export function buildCalendar(
  prefix: string,
  timetables: OdptStationTimetable[],
  issuedDate: string,
): {
  services: { i: string; d: number[]; s: string; e: string }[];
  exceptions: { i: string; d: string; t: number }[];
} {
  const { startDate, endDate } = computeDateRange(issuedDate);

  // Discover unique calendar types from the actual data
  const calendarTypes = new Set<string>();
  for (const tt of timetables) {
    calendarTypes.add(calendarToServiceId(tt['odpt:calendar']));
  }

  // Build day-of-week flags for known calendar types
  const DAY_FLAGS: Record<string, number[]> = {
    weekday: [1, 1, 1, 1, 1, 0, 0],
    'saturday-holiday': [0, 0, 0, 0, 0, 1, 1],
    saturday: [0, 0, 0, 0, 0, 1, 0],
    holiday: [0, 0, 0, 0, 0, 0, 1],
  };

  const services = [...calendarTypes].sort().map((serviceId) => ({
    i: `${prefix}:${serviceId}`,
    d: DAY_FLAGS[serviceId] ?? [1, 1, 1, 1, 1, 1, 1],
    s: startDate,
    e: endDate,
  }));

  return { services, exceptions: [] };
}

export function buildTimetable(
  prefix: string,
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
): Record<string, { r: string; h: string; d: Record<string, number[]> }[]> {
  // Build railway lookup: for each timetable, find which railway it belongs to
  // by matching the station against each railway's stationOrder.
  const railwayStationSets = railways.map((rw) => ({
    routeId: `${prefix}:${rw['odpt:lineCode']}`,
    stationOrder: rw['odpt:stationOrder'],
    stationSet: new Set(rw['odpt:stationOrder'].map((so) => so['odpt:station'])),
  }));

  // Group: stopId -> "routeId\0headsign" -> { routeId, headsign, services }
  const stopMap = new Map<
    string,
    Map<string, { routeId: string; headsign: string; services: Map<string, number[]> }>
  >();

  for (const tt of timetables) {
    const shortId = extractStationShortId(tt['odpt:station']);
    const stopId = `${prefix}:${shortId}`;
    const serviceId = `${prefix}:${calendarToServiceId(tt['odpt:calendar'])}`;

    // Find the matching railway for this timetable's station
    const rw = railwayStationSets.find((r) => r.stationSet.has(tt['odpt:station']));
    if (!rw) {
      continue;
    }
    const routeId = rw.routeId;
    const headsign = getHeadsignFromDirection(tt['odpt:railDirection'], rw.stationOrder);

    let groupMap = stopMap.get(stopId);
    if (!groupMap) {
      groupMap = new Map();
      stopMap.set(stopId, groupMap);
    }

    // Key by routeId + headsign to avoid merging departures from
    // different railways that share the same terminal station name.
    const groupKey = `${routeId}\0${headsign}`;
    let entry = groupMap.get(groupKey);
    if (!entry) {
      entry = { routeId, headsign, services: new Map() };
      groupMap.set(groupKey, entry);
    }

    const minutes: number[] = tt['odpt:stationTimetableObject'].map((obj) =>
      timeToMinutes(obj['odpt:departureTime']),
    );

    let existing = entry.services.get(serviceId);
    if (!existing) {
      existing = [];
      entry.services.set(serviceId, existing);
    }
    existing.push(...minutes);
  }

  // Convert to output format
  const result: Record<string, { r: string; h: string; d: Record<string, number[]> }[]> = {};

  for (const [stopId, groupMap] of stopMap) {
    const groups: { r: string; h: string; d: Record<string, number[]> }[] = [];

    for (const [, { routeId, headsign, services }] of groupMap) {
      const serviceEntries: Record<string, number[]> = {};
      for (const [serviceId, times] of services) {
        times.sort((a, b) => a - b);
        serviceEntries[serviceId] = times;
      }
      groups.push({ r: routeId, h: headsign, d: serviceEntries });
    }

    result[stopId] = groups;
  }

  return result;
}

export function buildAgency(prefix: string, provider: Provider): AgencyJson[] {
  return [
    {
      i: `${prefix}:${provider.nameEn}`,
      n: provider.nameJa,
      m: { ja: provider.nameJa, en: provider.nameEn },
      u: provider.url ?? '',
      l: 'ja',
    },
  ];
}

export function buildFeedInfo(issuedDate: string, provider: Provider): FeedInfoJson {
  const { startDate, endDate } = computeDateRange(issuedDate);
  return {
    pn: provider.nameJa,
    pu: provider.url ?? '',
    l: 'ja',
    s: startDate,
    e: endDate,
    v: issuedDate,
  };
}

export function buildTranslations(
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
): TranslationsJson {
  const headsigns: Record<string, Record<string, string>> = {};

  // Build station set per railway for matching
  const railwayStationSets = railways.map((rw) => ({
    lineCode: rw['odpt:lineCode'],
    stationOrder: rw['odpt:stationOrder'],
    stationSet: new Set(rw['odpt:stationOrder'].map((so) => so['odpt:station'])),
  }));

  // Collect headsigns from timetable direction -> terminal station
  const seenKeys = new Set<string>();
  for (const tt of timetables) {
    const rw = railwayStationSets.find((r) => r.stationSet.has(tt['odpt:station']));
    if (!rw) {
      continue;
    }

    const dirKey = `${rw.lineCode}:${tt['odpt:railDirection']}`;
    if (seenKeys.has(dirKey)) {
      continue;
    }
    seenKeys.add(dirKey);

    const headsignJa = getHeadsignFromDirection(tt['odpt:railDirection'], rw.stationOrder);
    if (!headsigns[headsignJa]) {
      const terminalIdx =
        tt['odpt:railDirection'] === 'odpt.RailDirection:Outbound' ? rw.stationOrder.length - 1 : 0;
      const title = rw.stationOrder[terminalIdx]['odpt:stationTitle'];
      const names: Record<string, string> = { ja: title.ja, en: title.en };
      if (title.ko) {
        names.ko = title.ko;
      }
      if (title['zh-Hans']) {
        names['zh-Hans'] = title['zh-Hans'];
      }
      headsigns[headsignJa] = names;
    }
  }

  return { headsigns, stop_headsigns: {} };
}

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

function buildSourceJson(source: OdptTrainSource): void {
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

  // 3. Build all data
  console.log('Building app data...');

  // Merge stationOrder from all railways for stop sorting
  const allStationOrders = railways.flatMap((rw) => rw['odpt:stationOrder']);
  const stops = buildStops(prefix, stations, allStationOrders);
  console.log(`  ${stops.length} stops`);

  const routes = railways.flatMap((rw) => buildRoutes(prefix, rw, provider));
  console.log(`  ${routes.length} routes`);

  const calendar = buildCalendar(prefix, timetables, issuedDate);
  console.log(`  ${calendar.services.length} services, ${calendar.exceptions.length} exceptions`);

  const timetableJson = buildTimetable(prefix, timetables, railways);
  const stopCount = Object.keys(timetableJson).length;
  const groupCount = Object.values(timetableJson).reduce((sum, groups) => sum + groups.length, 0);
  console.log(`  ${stopCount} stops, ${groupCount} route/headsign groups in timetable`);

  const agency = buildAgency(prefix, provider);
  console.log(`  ${agency.length} agencies`);

  const feedInfo = buildFeedInfo(issuedDate, provider);
  console.log(`  feed-info: ${feedInfo.pn} (v${feedInfo.v})`);

  const translations = buildTranslations(timetables, railways);
  const headsignCount = Object.keys(translations.headsigns).length;
  console.log(`  ${headsignCount} headsign translations`);

  // 4. Write to staging directory, then atomically swap
  const finalDir = join(OUTPUT_DIR, prefix);
  const stagingDir = join(OUTPUT_DIR, `${prefix}.tmp`);

  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true });
  }
  mkdirSync(stagingDir, { recursive: true });

  try {
    console.log(`\n  Writing JSON files to ${prefix}/ (staging):`);
    writeJson(join(stagingDir, 'stops.json'), stops);
    writeJson(join(stagingDir, 'routes.json'), routes);
    writeJson(join(stagingDir, 'calendar.json'), calendar);
    writeJson(join(stagingDir, 'timetable.json'), timetableJson);
    writeJson(join(stagingDir, 'agency.json'), agency);
    writeJson(join(stagingDir, 'feed-info.json'), feedInfo);
    writeJson(join(stagingDir, 'translations.json'), translations);
  } catch (err) {
    console.error(`\n  Error writing JSON files. Cleaning up staging directory.`);
    rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }

  // Atomic swap: preserve shapes.json generated by build-app-data-from-ksj-railway.ts
  const existingShapesPath = join(finalDir, 'shapes.json');
  if (existsSync(existingShapesPath)) {
    const shapesContent = readFileSync(existingShapesPath);
    writeFileSync(join(stagingDir, 'shapes.json'), shapesContent);
    console.log('  (preserved existing shapes.json)');
  }

  if (existsSync(finalDir)) {
    rmSync(finalDir, { recursive: true });
  }
  renameSync(stagingDir, finalDir);
  console.log(`  Committed ${prefix}/`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/app-data/build-app-data-from-odpt-train.ts --list\n',
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
    const names = await listSourceNames();
    console.log('Available ODPT Train sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-odpt-train (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-app-data-from-odpt-train.ts');
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
    source = await loadSource(arg.name);
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
  console.log(`  Output: ${join(OUTPUT_DIR, source.prefix)}/`);
  console.log('');

  const t0 = performance.now();

  try {
    buildSourceJson(source);
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

runMain(main);
