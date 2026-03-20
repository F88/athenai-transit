#!/usr/bin/env -S npx tsx

/**
 * Convert per-source GTFS SQLite databases into optimized JSON files.
 *
 * Each invocation processes a single GTFS source. For batch processing,
 * use `--targets <file>` which runs this script once per source in a
 * child process (same pattern as build-gtfs-db.ts).
 *
 * Input:  pipeline/workspace/_build/db/{outDir}.db (built by build-gtfs-db.ts)
 * Output: pipeline/workspace/_build/data/{prefix}/*.json (8 files per source)
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --list
 */

import Database from 'better-sqlite3';
import {
  existsSync,
  mkdirSync,
  readdirSync,
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
} from '../../../../src/types/data/transit-json';
import { listGtfsSourceNames, loadGtfsSource } from '../../../src/lib/resources/load-gtfs-sources';
import type { Provider } from '../../../src/types/resource-common';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../../src/lib/pipeline-utils';
import { formatBytes } from '../../../src/lib/utils';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, V1_OUTPUT_DIR } from '../../../src/lib/paths';

const OUTPUT_DIR = V1_OUTPUT_DIR;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved source info for JSON generation. */
interface BuildSource {
  outDir: string;
  prefix: string;
  nameEn: string;
  routeColorFallbacks: Record<string, string>;
  provider: Provider;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a GTFS time string (HH:MM:SS) to minutes from midnight.
 * Supports hours >= 24 for overnight trips (e.g. "25:01:00" -> 1501).
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data));
  const size = statSync(filePath).size;
  const name = basename(filePath);
  console.log(`  ${name.padEnd(20)} ${formatBytes(size).padStart(10)}`);
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Build a map of record_key -> { language -> translation } from translations table.
 *
 * Supports both GTFS-JP (record_id-based) and standard GTFS (field_value-based) linking.
 */
function buildNamesMap(
  rows: Array<{ key: string; language: string; translation: string }>,
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    let names = map.get(row.key);
    if (!names) {
      names = {};
      map.set(row.key, names);
    }
    names[row.language] = row.translation;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Per-source data extraction
// ---------------------------------------------------------------------------

export function extractStops(
  db: Database.Database,
  prefix: string,
): { i: string; n: string; a: number; o: number; l: number; ai: string }[] {
  const stops = db
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon, location_type
       FROM stops
       WHERE location_type = 0
       ORDER BY stop_id`,
    )
    .all() as Array<{
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    location_type: number;
  }>;

  // Build stop_id -> agency_id mapping via routes table.
  // A stop's agency is determined by the routes that serve it.
  // Uses MIN() for deterministic results when multiple agencies serve a stop.
  // (Current sources are all single-agency, but this handles future multi-agency sources.)
  const stopAgencyRows = db
    .prepare(
      `SELECT stm.stop_id, MIN(r.agency_id) as agency_id
       FROM stop_times stm
       JOIN trips t ON t.trip_id = stm.trip_id
       JOIN routes r ON r.route_id = t.route_id
       WHERE r.agency_id IS NOT NULL AND r.agency_id <> ''
       GROUP BY stm.stop_id`,
    )
    .all() as Array<{ stop_id: string; agency_id: string }>;

  const stopAgencyMap = new Map(stopAgencyRows.map((r) => [r.stop_id, r.agency_id]));

  const json = stops.map((s) => ({
    i: `${prefix}:${s.stop_id}`,
    n: s.stop_name,
    a: s.stop_lat,
    o: s.stop_lon,
    l: s.location_type ?? 0,
    ai: stopAgencyMap.has(s.stop_id) ? `${prefix}:${stopAgencyMap.get(s.stop_id)!}` : '',
  }));
  console.log(`  [${prefix}] ${stops.length} stops`);
  return json;
}

export function extractRoutes(
  db: Database.Database,
  prefix: string,
  routeColorFallbacks: Record<string, string>,
): RouteJson[] {
  const routes = db
    .prepare(
      `SELECT route_id, route_short_name, route_long_name, route_type,
              route_color, route_text_color, agency_id
       FROM routes
       ORDER BY route_id`,
    )
    .all() as Array<{
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: number;
    route_color: string | null;
    route_text_color: string | null;
    agency_id: string | null;
  }>;

  const defaultColor = routeColorFallbacks['*'] ?? '';

  const json: RouteJson[] = routes.map((r) => {
    const prefixedId = `${prefix}:${r.route_id}`;
    const rawColor = r.route_color || '';
    const rawTextColor = r.route_text_color || '';
    // Treat identical color/textColor (e.g. 000000/000000) as unset
    const colorUnset = !rawColor || (rawColor === rawTextColor && rawColor !== 'FFFFFF');
    const color = colorUnset ? routeColorFallbacks[r.route_id] || defaultColor : rawColor;
    const textColor = colorUnset && color !== rawColor ? 'FFFFFF' : rawTextColor;
    return {
      i: prefixedId,
      s: r.route_short_name ?? '',
      l: r.route_long_name ?? '',
      t: r.route_type,
      c: color,
      tc: textColor,
      ai: r.agency_id ? `${prefix}:${r.agency_id}` : '',
    };
  });
  console.log(`  [${prefix}] ${routes.length} routes`);
  return json;
}

export function extractCalendar(
  db: Database.Database,
  prefix: string,
): {
  services: { i: string; d: number[]; s: string; e: string }[];
  exceptions: { i: string; d: string; t: number }[];
} {
  const calendar = db
    .prepare(
      `SELECT service_id, monday, tuesday, wednesday, thursday,
              friday, saturday, sunday, start_date, end_date
       FROM calendar
       ORDER BY service_id`,
    )
    .all() as Array<{
    service_id: string;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    start_date: string;
    end_date: string;
  }>;

  const calendarDates = db
    .prepare(
      `SELECT service_id, date, exception_type
       FROM calendar_dates
       ORDER BY service_id, date`,
    )
    .all() as Array<{
    service_id: string;
    date: string;
    exception_type: number;
  }>;

  console.log(`  [${prefix}] ${calendar.length} services, ${calendarDates.length} exceptions`);

  return {
    services: calendar.map((c) => ({
      i: `${prefix}:${c.service_id}`,
      d: [c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday],
      s: c.start_date,
      e: c.end_date,
    })),
    exceptions: calendarDates.map((e) => ({
      i: `${prefix}:${e.service_id}`,
      d: e.date,
      t: e.exception_type,
    })),
  };
}

export function extractTimetable(
  db: Database.Database,
  prefix: string,
): {
  timetable: Map<string, Map<string, Map<string, Map<string, number[]>>>>;
  /** route_id -> agency_id mapping for timetable group ai field */
  routeAgencyMap: Map<string, string>;
  tripCount: number;
  stopTimeCount: number;
  skipped: number;
} {
  // Build trip lookup: trip_id -> { route_id, headsign, service_id }
  const trips = db
    .prepare(
      `SELECT trip_id, route_id, service_id, trip_headsign
       FROM trips`,
    )
    .all() as Array<{
    trip_id: string;
    route_id: string;
    service_id: string;
    trip_headsign: string;
  }>;

  const tripMap = new Map<string, { route_id: string; headsign: string; service_id: string }>();
  for (const t of trips) {
    tripMap.set(t.trip_id, {
      route_id: t.route_id,
      headsign: t.trip_headsign ?? '',
      service_id: t.service_id,
    });
  }

  // Build route_id -> agency_id mapping
  const routeAgencyRows = db
    .prepare(`SELECT route_id, agency_id FROM routes WHERE agency_id IS NOT NULL`)
    .all() as Array<{ route_id: string; agency_id: string }>;
  const routeAgencyMap = new Map<string, string>();
  for (const r of routeAgencyRows) {
    routeAgencyMap.set(`${prefix}:${r.route_id}`, r.agency_id ? `${prefix}:${r.agency_id}` : '');
  }

  // Scan stop_times and aggregate into timetable structure
  const stopTimes = db
    .prepare(
      `SELECT trip_id, stop_id, departure_time
       FROM stop_times
       WHERE departure_time IS NOT NULL
       ORDER BY stop_id, departure_time`,
    )
    .all() as Array<{
    trip_id: string;
    stop_id: string;
    departure_time: string;
  }>;

  console.log(`  [${prefix}] ${trips.length} trips, ${stopTimes.length} stop_times`);

  // timetable: stopId -> routeId -> headsign -> serviceId -> minutes[]
  type ServiceMap = Map<string, number[]>;
  type HeadsignMap = Map<string, ServiceMap>;
  type RouteMap = Map<string, HeadsignMap>;
  const timetable = new Map<string, RouteMap>();

  let skipped = 0;
  for (const st of stopTimes) {
    const trip = tripMap.get(st.trip_id);
    if (!trip) {
      skipped++;
      continue;
    }

    const prefixedStopId = `${prefix}:${st.stop_id}`;
    const prefixedRouteId = `${prefix}:${trip.route_id}`;
    const prefixedServiceId = `${prefix}:${trip.service_id}`;
    const minutes = timeToMinutes(st.departure_time);

    let routeMap = timetable.get(prefixedStopId);
    if (!routeMap) {
      routeMap = new Map();
      timetable.set(prefixedStopId, routeMap);
    }

    let headsignMap = routeMap.get(prefixedRouteId);
    if (!headsignMap) {
      headsignMap = new Map();
      routeMap.set(prefixedRouteId, headsignMap);
    }

    let serviceMap = headsignMap.get(trip.headsign);
    if (!serviceMap) {
      serviceMap = new Map();
      headsignMap.set(trip.headsign, serviceMap);
    }

    let times = serviceMap.get(prefixedServiceId);
    if (!times) {
      times = [];
      serviceMap.set(prefixedServiceId, times);
    }

    times.push(minutes);
  }

  if (skipped > 0) {
    console.warn(`  [${prefix}] WARN: ${skipped} stop_times skipped (trip not found)`);
  }

  return {
    timetable,
    routeAgencyMap,
    tripCount: trips.length,
    stopTimeCount: stopTimes.length,
    skipped,
  };
}

export function extractAgencies(
  db: Database.Database,
  prefix: string,
  provider: Provider,
): AgencyJson[] {
  const agencies = db
    .prepare(
      `SELECT agency_id, agency_name, agency_url, agency_lang,
              agency_timezone, agency_fare_url
       FROM agency
       ORDER BY agency_id`,
    )
    .all() as Array<{
    agency_id: string;
    agency_name: string;
    agency_url: string | null;
    agency_lang: string | null;
    agency_timezone: string | null;
    agency_fare_url: string | null;
  }>;

  const colors = (provider.colors ?? []).map((c) => ({ b: c.bg, t: c.text }));

  const json: AgencyJson[] = agencies.map((a) => ({
    i: `${prefix}:${a.agency_id}`,
    n: a.agency_name,
    sn: provider.name.ja.short,
    u: a.agency_url ?? '',
    l: a.agency_lang ?? '',
    tz: a.agency_timezone ?? '',
    fu: a.agency_fare_url ?? '',
    cs: colors,
  }));
  console.log(`  [${prefix}] ${agencies.length} agencies`);
  return json;
}

export function extractFeedInfo(db: Database.Database, prefix: string): FeedInfoJson | null {
  const row = db
    .prepare(
      `SELECT feed_publisher_name, feed_publisher_url, feed_lang,
              feed_start_date, feed_end_date, feed_version
       FROM feed_info
       LIMIT 1`,
    )
    .get() as
    | {
        feed_publisher_name: string;
        feed_publisher_url: string;
        feed_lang: string;
        feed_start_date: string | null;
        feed_end_date: string | null;
        feed_version: string | null;
      }
    | undefined;

  if (!row) {
    console.log(`  [${prefix}] no feed_info`);
    return null;
  }

  console.log(
    `  [${prefix}] feed_info: ${row.feed_publisher_name} (${row.feed_version ?? 'no version'})`,
  );
  return {
    pn: row.feed_publisher_name,
    pu: row.feed_publisher_url,
    l: row.feed_lang,
    s: row.feed_start_date ?? '',
    e: row.feed_end_date ?? '',
    v: row.feed_version ?? '',
  };
}

/**
 * Build a lookup map from translation rows: { headsignText: { lang: translation } }
 */
function buildTranslationMap(
  rows: Array<{ headsign_text: string; language: string; translation: string }>,
): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!map[row.headsign_text]) {
      map[row.headsign_text] = {};
    }
    map[row.headsign_text][row.language] = row.translation;
  }
  return map;
}

export function extractTranslations(
  db: Database.Database,
  prefix: string,
  provider: Provider,
): TranslationsJson {
  // trip_headsign translations
  // GTFS-JP uses record_id (trip_id), standard GTFS uses field_value
  const headsignRows = db
    .prepare(
      `SELECT DISTINCT COALESCE(tr.trip_headsign, t.field_value) as headsign_text,
        t.language, t.translation
       FROM translations t
       LEFT JOIN trips tr ON t.record_id IS NOT NULL AND tr.trip_id = t.record_id
       WHERE t.table_name = 'trips' AND t.field_name = 'trip_headsign'
         AND COALESCE(tr.trip_headsign, t.field_value) IS NOT NULL`,
    )
    .all() as Array<{ headsign_text: string; language: string; translation: string }>;

  const headsigns = buildTranslationMap(headsignRows);

  // stop_headsign translations
  // stop_times has composite PK (trip_id, stop_sequence), so record_sub_id is used
  const stopHeadsignRows = db
    .prepare(
      `SELECT DISTINCT COALESCE(st.stop_headsign, t.field_value) as headsign_text,
        t.language, t.translation
       FROM translations t
       LEFT JOIN stop_times st ON t.record_id IS NOT NULL
         AND st.trip_id = t.record_id
         AND CAST(st.stop_sequence AS TEXT) = t.record_sub_id
       WHERE t.table_name = 'stop_times' AND t.field_name = 'stop_headsign'
         AND COALESCE(st.stop_headsign, t.field_value) IS NOT NULL`,
    )
    .all() as Array<{ headsign_text: string; language: string; translation: string }>;

  const stopHeadsigns = buildTranslationMap(stopHeadsignRows);

  // stop_name translations (keyed by prefixed stop_id)
  const stopNameRows = db
    .prepare(
      `SELECT s.stop_id, t.language, t.translation
       FROM translations t
       JOIN stops s ON (
         s.stop_id = t.record_id
         OR (t.record_id IS NULL AND s.stop_name = t.field_value)
       )
       WHERE t.table_name = 'stops'
         AND t.field_name = 'stop_name'
         AND s.location_type = 0`,
    )
    .all() as Array<{ stop_id: string; language: string; translation: string }>;

  const stopNamesMap = buildNamesMap(
    stopNameRows.map((r) => ({ key: r.stop_id, language: r.language, translation: r.translation })),
  );
  const stopNames: Record<string, Record<string, string>> = {};
  for (const [stopId, names] of stopNamesMap) {
    stopNames[`${prefix}:${stopId}`] = names;
  }

  // route_long_name translations (keyed by prefixed route_id)
  const routeNameRows = db
    .prepare(
      `SELECT r.route_id, t.language, t.translation
       FROM translations t
       JOIN routes r ON (r.route_id = t.record_id
         OR (t.record_id IS NULL AND r.route_long_name = t.field_value))
       WHERE t.table_name = 'routes' AND t.field_name = 'route_long_name'`,
    )
    .all() as Array<{ route_id: string; language: string; translation: string }>;

  const routeNamesMap = buildNamesMap(
    routeNameRows.map((r) => ({
      key: r.route_id,
      language: r.language,
      translation: r.translation,
    })),
  );
  const routeNames: Record<string, Record<string, string>> = {};
  for (const [routeId, names] of routeNamesMap) {
    routeNames[`${prefix}:${routeId}`] = names;
  }

  // agency_name translations (keyed by prefixed agency_id)
  const agencyNameRows = db
    .prepare(
      `SELECT a.agency_id, t.language, t.translation
       FROM translations t
       JOIN agency a ON (a.agency_id = t.record_id
         OR (t.record_id IS NULL AND a.agency_name = t.field_value))
       WHERE t.table_name = 'agency' AND t.field_name = 'agency_name'`,
    )
    .all() as Array<{ agency_id: string; language: string; translation: string }>;

  const agencyNamesMap = buildNamesMap(
    agencyNameRows.map((r) => ({
      key: r.agency_id,
      language: r.language,
      translation: r.translation,
    })),
  );
  const agencyNames: Record<string, Record<string, string>> = {};
  for (const [agencyId, names] of agencyNamesMap) {
    agencyNames[`${prefix}:${agencyId}`] = {
      ja: provider.name.ja.long,
      en: provider.name.en.long,
      ...names,
    };
  }

  // agency_short_names from Provider (GTFS has no short name)
  const agencyShortNames: Record<string, Record<string, string>> = {};
  // Ensure all agencies have names and short names (even without translations)
  const allAgencyIds = db.prepare(`SELECT agency_id FROM agency`).all() as Array<{
    agency_id: string;
  }>;
  for (const { agency_id } of allAgencyIds) {
    const prefixedId = `${prefix}:${agency_id}`;
    if (!agencyNames[prefixedId]) {
      agencyNames[prefixedId] = {
        ja: provider.name.ja.long,
        en: provider.name.en.long,
      };
    }
    agencyShortNames[prefixedId] = {
      ja: provider.name.ja.short,
      en: provider.name.en.short,
    };
  }

  const headsignCount = Object.keys(headsigns).length;
  const stopHeadsignCount = Object.keys(stopHeadsigns).length;
  const stopNameCount = Object.keys(stopNames).length;
  const routeNameCount = Object.keys(routeNames).length;
  const agencyNameCount = Object.keys(agencyNames).length;
  console.log(
    `  [${prefix}] translations: ${headsignCount} headsigns, ${stopHeadsignCount} stop_headsigns, ${stopNameCount} stop_names, ${routeNameCount} route_names, ${agencyNameCount} agency_names`,
  );

  return {
    headsigns,
    stop_headsigns: stopHeadsigns,
    stop_names: stopNames,
    route_names: routeNames,
    agency_names: agencyNames,
    agency_short_names: agencyShortNames,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Convert a per-source timetable Map to a JSON-serializable Record.
 */
function timetableToJson(
  timetable: Map<string, Map<string, Map<string, Map<string, number[]>>>>,
  routeAgencyMap: Map<string, string>,
): Record<string, { r: string; h: string; d: Record<string, number[]>; ai: string }[]> {
  const json: Record<string, { r: string; h: string; d: Record<string, number[]>; ai: string }[]> =
    {};

  let groupCount = 0;
  for (const [stopId, routeMap] of timetable) {
    const stopGroups: { r: string; h: string; d: Record<string, number[]>; ai: string }[] = [];

    for (const [routeId, headsignMap] of routeMap) {
      for (const [headsign, serviceMap] of headsignMap) {
        const services: Record<string, number[]> = {};

        for (const [serviceId, times] of serviceMap) {
          times.sort((a, b) => a - b);
          services[serviceId] = times;
        }

        stopGroups.push({
          r: routeId,
          h: headsign,
          d: services,
          ai: routeAgencyMap.get(routeId) ?? '',
        });
        groupCount++;
      }
    }

    json[stopId] = stopGroups;
  }

  console.log(`  ${timetable.size} stops, ${groupCount} route/headsign groups`);
  return json;
}

// ---------------------------------------------------------------------------
// Per-source processing
// ---------------------------------------------------------------------------

/**
 * Files managed by this script. Used to clean up stale outputs when
 * merging staging into the final directory. Files not in this list
 * (e.g. shapes.json managed by dedicated shapes scripts) are left untouched.
 */
const MANAGED_FILES = [
  'stops.json',
  'routes.json',
  'calendar.json',
  'timetable.json',
  'agency.json',
  'feed-info.json',
  'translations.json',
];

function buildSourceJson(source: BuildSource): void {
  const dbPath = join(DB_DIR, `${source.outDir}.db`);
  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${dbPath}\n  Run build-gtfs-db.ts first to build the database.`);
  }

  console.log(`Reading ${source.outDir}.db (${source.nameEn})...`);
  const db = new Database(dbPath, { readonly: true });

  // Extract data
  const stops = extractStops(db, source.prefix);
  const routes = extractRoutes(db, source.prefix, source.routeColorFallbacks);
  const calendar = extractCalendar(db, source.prefix);
  const { timetable, routeAgencyMap } = extractTimetable(db, source.prefix);
  const agencies = extractAgencies(db, source.prefix, source.provider);
  const feedInfo = extractFeedInfo(db, source.prefix);
  const translations = extractTranslations(db, source.prefix, source.provider);

  db.close();

  // Convert timetable
  console.log(`  Building timetable for ${source.prefix}...`);
  const timetableJson = timetableToJson(timetable, routeAgencyMap);

  // Write to staging directory, then merge into the final directory.
  // Staging ensures all files are written successfully before committing.
  // Merging (instead of directory swap) preserves files written by other
  // pipeline scripts (e.g. shapes.json from build-gtfs-shapes / KSJ).
  const finalDir = join(OUTPUT_DIR, source.prefix);
  const stagingDir = join(OUTPUT_DIR, `${source.prefix}.tmp`);

  // Clean up any leftover staging directory from a previous failed run
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true });
  }
  mkdirSync(stagingDir, { recursive: true });

  try {
    console.log(`\n  Writing JSON files to ${source.prefix}/ (staging):`);
    writeJson(join(stagingDir, 'stops.json'), stops);
    writeJson(join(stagingDir, 'routes.json'), routes);
    writeJson(join(stagingDir, 'calendar.json'), calendar);
    writeJson(join(stagingDir, 'timetable.json'), timetableJson);
    writeJson(join(stagingDir, 'agency.json'), agencies);
    writeJson(join(stagingDir, 'feed-info.json'), feedInfo);
    writeJson(join(stagingDir, 'translations.json'), translations);
  } catch (err) {
    // Write failed — clean up staging, preserve existing data
    console.error(`\n  Error writing JSON files. Cleaning up staging directory.`);
    rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }

  // Merge staging into final: copy each staged file individually,
  // preserving files written by other pipeline scripts.
  // Remove stale managed files that were not produced in this run.
  // Note: renameSync overwrites existing files on POSIX (macOS/Linux).
  // Windows is not supported as a pipeline execution environment.
  const stagedFiles = new Set(readdirSync(stagingDir));
  mkdirSync(finalDir, { recursive: true });
  for (const file of stagedFiles) {
    renameSync(join(stagingDir, file), join(finalDir, file));
  }
  for (const file of readdirSync(finalDir)) {
    if (MANAGED_FILES.includes(file) && !stagedFiles.has(file)) {
      rmSync(join(finalDir, file));
      console.log(`  (removed stale ${file})`);
    }
  }
  rmSync(stagingDir, { recursive: true });
  console.log(`  Committed ${source.prefix}/`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts <source-name>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v1/build-app-data-from-gtfs.ts --list\n',
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
    const names = listGtfsSourceNames();
    console.log('Available GTFS sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch build-json (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-app-data-from-gtfs.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  let sourceDef;
  try {
    sourceDef = await loadGtfsSource(arg.name);
  } catch (err) {
    console.error(`Error: Failed to load source definition for "${arg.name}".`);
    if (err instanceof Error) {
      console.error(`  Cause: ${err.message}`);
    }
    console.log('');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const source: BuildSource = {
    outDir: sourceDef.pipeline.outDir,
    prefix: sourceDef.pipeline.prefix,
    nameEn: sourceDef.resource.nameEn,
    routeColorFallbacks: sourceDef.resource.routeColorFallbacks ?? {},
    provider: sourceDef.resource.provider,
  };

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${source.nameEn}`);
  console.log(`  Input:  ${join(DB_DIR, `${source.outDir}.db`)}`);
  console.log(`  Output: ${join(OUTPUT_DIR, source.prefix)}/`);
  console.log('');

  const t0 = performance.now();

  // Intentionally NOT delegating error handling to runMain here.
  // This try/catch/finally ensures that Duration, Exit code, and the
  // "=== [END] ===" marker are always printed — even on failure.
  // These markers are important for readable log output when this script
  // runs as a batch child process (--targets).
  // The catch sets process.exitCode and returns (does not re-throw),
  // so runMain's catch is not triggered — no duplicate FATAL output.
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
