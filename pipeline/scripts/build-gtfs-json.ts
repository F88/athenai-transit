#!/usr/bin/env -S npx tsx

/**
 * Convert per-source GTFS SQLite databases into optimized JSON files.
 *
 * Reads pipeline/build/{prefix}.db for each source (built by build-gtfs-db.ts)
 * and outputs per-source JSON files to pipeline/build/data/{prefix}/. ID fields
 * are prefixed with the source prefix at JSON output time (e.g. "tobus:0001-01").
 *
 * Output files per source (e.g. pipeline/build/data/tobus/):
 *   - stops.json
 *   - routes.json
 *   - calendar.json
 *   - timetable.json
 *   - shapes.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/build-gtfs-json.ts
 *   npm run pipeline:build:json
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { loadAllGtfsSources } from './load-gtfs-sources';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '..');
const DB_DIR = join(ROOT, 'build');
const OUTPUT_DIR = join(ROOT, 'build/data');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved source info for JSON generation. */
interface BuildSource {
  prefix: string;
  nameEn: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Convert a GTFS time string (HH:MM:SS) to minutes from midnight.
 * Supports hours >= 24 for overnight trips (e.g. "25:01:00" -> 1501).
 */
function timeToMinutes(time: string): number {
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
// Per-source data extraction
// ---------------------------------------------------------------------------

function extractStops(
  db: Database.Database,
  prefix: string,
): { i: string; n: string; m: Record<string, string>; a: number; o: number; l: number }[] {
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

  // Build stop_id -> { language -> translation } map from translations table.
  // GTFS-JP (bus) uses record_id to link to stop_id.
  // Standard GTFS (train) uses field_value to match stop_name.
  const translations = db
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

  const namesMap = new Map<string, Record<string, string>>();
  for (const t of translations) {
    let names = namesMap.get(t.stop_id);
    if (!names) {
      names = {};
      namesMap.set(t.stop_id, names);
    }
    names[t.language] = t.translation;
  }
  console.log(`  [${prefix}] ${translations.length} translations for ${namesMap.size} stops`);

  const json = stops.map((s) => ({
    i: `${prefix}:${s.stop_id}`,
    n: s.stop_name,
    m: namesMap.get(s.stop_id) ?? {},
    a: s.stop_lat,
    o: s.stop_lon,
    l: s.location_type ?? 0,
  }));
  console.log(`  [${prefix}] ${stops.length} stops`);
  return json;
}

// Fallback route colors for GTFS sources missing route_color.
// Applied only when the GTFS route_color field is empty.
// Key: "prefix:route_id"
const ROUTE_COLOR_FALLBACK: Record<string, string> = {
  'toaran:5': 'C93896', // Nippori-Toneri Liner
  'toaran:6': '6CA782', // Tokyo Sakura Tram (Arakawa Line)
};

function extractRoutes(
  db: Database.Database,
  prefix: string,
): { i: string; s: string; l: string; t: number; c: string; tc: string }[] {
  const routes = db
    .prepare(
      `SELECT route_id, route_short_name, route_long_name, route_type,
              route_color, route_text_color
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
  }>;

  const json = routes.map((r) => {
    const prefixedId = `${prefix}:${r.route_id}`;
    return {
      i: prefixedId,
      s: r.route_short_name ?? '',
      l: r.route_long_name ?? '',
      t: r.route_type,
      c: r.route_color || ROUTE_COLOR_FALLBACK[prefixedId] || '',
      tc: r.route_text_color ?? '',
    };
  });
  console.log(`  [${prefix}] ${routes.length} routes`);
  return json;
}

function extractCalendar(
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

function extractShapes(
  db: Database.Database,
  prefix: string,
): Record<string, [number, number][][]> {
  // Get unique route_id -> shape_id mappings from trips
  const routeShapes = db
    .prepare(
      `SELECT DISTINCT t.route_id, t.shape_id
       FROM trips t
       WHERE t.shape_id IS NOT NULL AND t.shape_id <> ''
       ORDER BY t.route_id, t.shape_id`,
    )
    .all() as Array<{ route_id: string; shape_id: string }>;

  // Group shape_ids by route_id
  const routeToShapeIds = new Map<string, string[]>();
  for (const rs of routeShapes) {
    let ids = routeToShapeIds.get(rs.route_id);
    if (!ids) {
      ids = [];
      routeToShapeIds.set(rs.route_id, ids);
    }
    ids.push(rs.shape_id);
  }

  // Load all shape points, ordered by shape_id and sequence
  const shapePoints = db
    .prepare(
      `SELECT shape_id, shape_pt_lat, shape_pt_lon
       FROM shapes
       ORDER BY shape_id, shape_pt_sequence`,
    )
    .all() as Array<{
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
  }>;

  // Group points by shape_id
  const shapeMap = new Map<string, [number, number][]>();
  for (const pt of shapePoints) {
    let points = shapeMap.get(pt.shape_id);
    if (!points) {
      points = [];
      shapeMap.set(pt.shape_id, points);
    }
    // Round to 5 decimal places (~1m precision) to reduce file size
    points.push([Math.round(pt.shape_pt_lat * 1e5) / 1e5, Math.round(pt.shape_pt_lon * 1e5) / 1e5]);
  }

  // Build final structure: prefixed route_id -> array of polylines
  const json: Record<string, [number, number][][]> = {};
  let totalShapes = 0;

  for (const [routeId, shapeIds] of routeToShapeIds) {
    const polylines: [number, number][][] = [];
    for (const shapeId of shapeIds) {
      const points = shapeMap.get(shapeId);
      if (points && points.length > 0) {
        polylines.push(points);
        totalShapes++;
      }
    }
    if (polylines.length > 0) {
      json[`${prefix}:${routeId}`] = polylines;
    }
  }

  console.log(
    `  [${prefix}] ${routeToShapeIds.size} routes, ${totalShapes} shapes, ${shapePoints.length} points`,
  );
  return json;
}

function extractTimetable(
  db: Database.Database,
  prefix: string,
): {
  timetable: Map<string, Map<string, Map<string, number[]>>>;
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
    tripCount: trips.length,
    stopTimeCount: stopTimes.length,
    skipped,
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
): Record<string, { r: string; h: string; d: Record<string, number[]> }[]> {
  const json: Record<string, { r: string; h: string; d: Record<string, number[]> }[]> = {};

  let groupCount = 0;
  for (const [stopId, routeMap] of timetable) {
    const stopGroups: { r: string; h: string; d: Record<string, number[]> }[] = [];

    for (const [routeId, headsignMap] of routeMap) {
      for (const [headsign, serviceMap] of headsignMap) {
        const services: Record<string, number[]> = {};

        for (const [serviceId, times] of serviceMap) {
          times.sort((a, b) => a - b);
          services[serviceId] = times;
        }

        stopGroups.push({ r: routeId, h: headsign, d: services });
        groupCount++;
      }
    }

    json[stopId] = stopGroups;
  }

  console.log(`  ${timetable.size} stops, ${groupCount} route/headsign groups`);
  return json;
}

async function main(): Promise<void> {
  console.log('=== GTFS DB -> JSON (per-source) ===\n');

  // Load resource definitions
  const allDefs = await loadAllGtfsSources();
  const sources: BuildSource[] = allDefs.map((d) => ({
    prefix: d.pipeline.prefix,
    nameEn: d.resource.nameEn,
  }));

  if (sources.length === 0) {
    throw new Error('No GTFS source definitions found.');
  }

  for (const source of sources) {
    const dbPath = join(DB_DIR, `${source.prefix}.db`);
    if (!existsSync(dbPath)) {
      console.warn(`  WARN: Skipping "${source.prefix}" (DB not found: ${dbPath})`);
      continue;
    }

    console.log(`\nReading ${source.prefix}.db (${source.nameEn})...`);
    const db = new Database(dbPath, { readonly: true });

    // Extract data
    const stops = extractStops(db, source.prefix);
    const routes = extractRoutes(db, source.prefix);
    const calendar = extractCalendar(db, source.prefix);
    const shapes = extractShapes(db, source.prefix);
    const { timetable } = extractTimetable(db, source.prefix);

    db.close();

    // Convert timetable
    console.log(`  Building timetable for ${source.prefix}...`);
    const timetableJson = timetableToJson(timetable);

    // Write per-source JSON files
    const sourceOutputDir = join(OUTPUT_DIR, source.prefix);
    if (!existsSync(sourceOutputDir)) {
      mkdirSync(sourceOutputDir, { recursive: true });
    }

    console.log(`\n  Writing JSON files to ${source.prefix}/:`);
    writeJson(join(sourceOutputDir, 'stops.json'), stops);
    writeJson(join(sourceOutputDir, 'routes.json'), routes);
    writeJson(join(sourceOutputDir, 'calendar.json'), calendar);
    writeJson(join(sourceOutputDir, 'timetable.json'), timetableJson);
    writeJson(join(sourceOutputDir, 'shapes.json'), shapes);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
