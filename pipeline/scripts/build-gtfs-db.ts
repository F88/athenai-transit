#!/usr/bin/env -S npx tsx

/**
 * Convert GTFS CSV files into per-source SQLite databases.
 *
 * Loads source definitions from pipeline/resources/gtfs/ and imports all CSV
 * files found in each source directory into a separate database. CSV values
 * are stored as-is without any ID prefixing — prefix logic is handled later
 * by build-gtfs-json.ts at JSON output time.
 *
 * Usage:
 *   npx tsx pipeline/scripts/build-gtfs-db.ts            # all sources
 *   npx tsx pipeline/scripts/build-gtfs-db.ts toei-bus    # specific source only
 *   npm run pipeline:build:db
 *
 * Input:  pipeline/data/gtfs/{directory}/*.txt (GTFS CSV files)
 * Output: pipeline/build/{prefix}.db per source (e.g. tobus.db, toaran.db)
 */

import Database from 'better-sqlite3';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';

import { splitCsvLine } from '../lib/csv-utils';
import { loadAllGtfsSources } from './load-gtfs-sources';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '..');
const GTFS_BASE_DIR = join(ROOT, 'data/gtfs');
const OUTPUT_DIR = join(ROOT, 'build');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// GTFS Schema Definitions (per GTFS Static spec)
//
// Tables are created in dependency order so that FOREIGN KEY constraints
// reference only tables that already exist.
// ---------------------------------------------------------------------------

const SCHEMA: string[] = [
  // =========================================================================
  // Independent tables (no FK dependencies)
  // =========================================================================

  // agency.txt
  `CREATE TABLE IF NOT EXISTS agency (
    agency_id    TEXT PRIMARY KEY,
    agency_name  TEXT NOT NULL,
    agency_url   TEXT NOT NULL,
    agency_timezone TEXT NOT NULL,
    agency_lang  TEXT,
    agency_phone TEXT,
    agency_fare_url TEXT,
    agency_email TEXT
  )`,

  // agency_jp.txt (GTFS-JP)
  `CREATE TABLE IF NOT EXISTS agency_jp (
    agency_id              TEXT PRIMARY KEY,
    agency_official_name   TEXT,
    agency_zip_number      TEXT,
    agency_address         TEXT,
    agency_president_pos   TEXT,
    agency_president_name  TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
  )`,

  // calendar.txt
  `CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT PRIMARY KEY,
    monday     INTEGER NOT NULL,
    tuesday    INTEGER NOT NULL,
    wednesday  INTEGER NOT NULL,
    thursday   INTEGER NOT NULL,
    friday     INTEGER NOT NULL,
    saturday   INTEGER NOT NULL,
    sunday     INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL
  )`,

  // calendar_dates.txt
  `CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id     TEXT NOT NULL,
    date           TEXT NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date),
    FOREIGN KEY (service_id) REFERENCES calendar(service_id)
  )`,

  // levels.txt
  `CREATE TABLE IF NOT EXISTS levels (
    level_id    TEXT PRIMARY KEY,
    level_index REAL NOT NULL,
    level_name  TEXT
  )`,

  // stops.txt
  `CREATE TABLE IF NOT EXISTS stops (
    stop_id            TEXT PRIMARY KEY,
    stop_code          TEXT,
    stop_name          TEXT NOT NULL,
    stop_desc          TEXT,
    stop_lat           REAL NOT NULL,
    stop_lon           REAL NOT NULL,
    zone_id            TEXT,
    stop_url           TEXT,
    location_type      INTEGER,
    parent_station     TEXT,
    stop_timezone      TEXT,
    wheelchair_boarding INTEGER,
    platform_code      TEXT,
    tts_stop_name      TEXT,
    level_id           TEXT,
    stop_access        TEXT,
    FOREIGN KEY (parent_station) REFERENCES stops(stop_id),
    FOREIGN KEY (level_id) REFERENCES levels(level_id)
  )`,

  // routes.txt
  `CREATE TABLE IF NOT EXISTS routes (
    route_id           TEXT PRIMARY KEY,
    agency_id          TEXT,
    route_short_name   TEXT,
    route_long_name    TEXT,
    route_desc         TEXT,
    route_type         INTEGER NOT NULL,
    route_url          TEXT,
    route_color        TEXT,
    route_text_color   TEXT,
    route_sort_order   INTEGER,
    continuous_pickup  INTEGER,
    continuous_drop_off INTEGER,
    network_id         TEXT,
    jp_parent_route_id TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
  )`,

  // =========================================================================
  // Dependent tables
  // =========================================================================

  // trips.txt
  `CREATE TABLE IF NOT EXISTS trips (
    route_id              TEXT NOT NULL,
    service_id            TEXT NOT NULL,
    trip_id               TEXT PRIMARY KEY,
    trip_headsign         TEXT,
    trip_short_name       TEXT,
    direction_id          INTEGER,
    block_id              TEXT,
    shape_id              TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed         INTEGER,
    cars_allowed          INTEGER,
    jp_trip_desc          TEXT,
    jp_trip_desc_symbol   TEXT,
    jp_office_id          TEXT,
    jp_pattern_id         TEXT,
    FOREIGN KEY (route_id) REFERENCES routes(route_id),
    FOREIGN KEY (service_id) REFERENCES calendar(service_id)
  )`,

  // stop_times.txt
  `CREATE TABLE IF NOT EXISTS stop_times (
    trip_id                          TEXT NOT NULL,
    arrival_time                     TEXT,
    departure_time                   TEXT,
    stop_id                          TEXT NOT NULL,
    stop_sequence                    INTEGER NOT NULL,
    stop_headsign                    TEXT,
    pickup_type                      INTEGER,
    drop_off_type                    INTEGER,
    shape_dist_traveled              REAL,
    timepoint                        INTEGER,
    location_group_id                TEXT,
    location_id                      TEXT,
    start_pickup_drop_off_window     TEXT,
    end_pickup_drop_off_window       TEXT,
    continuous_pickup                INTEGER,
    continuous_drop_off              INTEGER,
    pickup_booking_rule_id           TEXT,
    drop_off_booking_rule_id         TEXT,
    PRIMARY KEY (trip_id, stop_sequence),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id)
  )`,

  // shapes.txt
  `CREATE TABLE IF NOT EXISTS shapes (
    shape_id            TEXT NOT NULL,
    shape_pt_lat        REAL NOT NULL,
    shape_pt_lon        REAL NOT NULL,
    shape_pt_sequence   INTEGER NOT NULL,
    shape_dist_traveled REAL,
    PRIMARY KEY (shape_id, shape_pt_sequence)
  )`,

  // fare_attributes.txt
  `CREATE TABLE IF NOT EXISTS fare_attributes (
    fare_id           TEXT PRIMARY KEY,
    price             REAL NOT NULL,
    ic_price          REAL,
    currency_type     TEXT NOT NULL,
    payment_method    INTEGER NOT NULL,
    transfers         INTEGER,
    agency_id         TEXT,
    transfer_duration INTEGER,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
  )`,

  // fare_rules.txt
  `CREATE TABLE IF NOT EXISTS fare_rules (
    fare_id        TEXT NOT NULL,
    route_id       TEXT,
    origin_id      TEXT,
    destination_id TEXT,
    contains_id    TEXT,
    FOREIGN KEY (fare_id) REFERENCES fare_attributes(fare_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
  )`,

  // feed_info.txt
  `CREATE TABLE IF NOT EXISTS feed_info (
    feed_publisher_name TEXT NOT NULL,
    feed_publisher_url  TEXT NOT NULL,
    feed_lang           TEXT NOT NULL,
    feed_start_date     TEXT,
    feed_end_date       TEXT,
    feed_version        TEXT,
    default_lang        TEXT,
    feed_contact_email  TEXT,
    feed_contact_url    TEXT
  )`,

  // translations.txt
  `CREATE TABLE IF NOT EXISTS translations (
    table_name      TEXT NOT NULL,
    field_name      TEXT NOT NULL,
    language        TEXT NOT NULL,
    translation     TEXT NOT NULL,
    record_id       TEXT,
    record_sub_id   TEXT,
    record_sequence TEXT,
    field_value     TEXT
  )`,

  // attributions.txt
  `CREATE TABLE IF NOT EXISTS attributions (
    attribution_id    TEXT,
    agency_id         TEXT,
    route_id          TEXT,
    trip_id           TEXT,
    organization_name TEXT NOT NULL,
    is_producer       INTEGER,
    is_operator       INTEGER,
    is_authority      INTEGER,
    is_data_source    INTEGER,
    attribution_url   TEXT,
    attribution_email TEXT,
    attribution_phone TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
  )`,

  // office_jp.txt (GTFS-JP)
  `CREATE TABLE IF NOT EXISTS office_jp (
    office_id    TEXT PRIMARY KEY,
    office_name  TEXT,
    office_url   TEXT,
    office_phone TEXT
  )`,

  // pathways.txt
  `CREATE TABLE IF NOT EXISTS pathways (
    pathway_id         TEXT PRIMARY KEY,
    from_stop_id       TEXT NOT NULL,
    to_stop_id         TEXT NOT NULL,
    pathway_mode       INTEGER NOT NULL,
    is_bidirectional   INTEGER NOT NULL,
    length             REAL,
    traversal_time     INTEGER,
    stair_count        INTEGER,
    max_slope          REAL,
    min_width          REAL,
    signposted_as      TEXT,
    reverse_signposted_as TEXT,
    FOREIGN KEY (from_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (to_stop_id) REFERENCES stops(stop_id)
  )`,

  // frequencies.txt
  `CREATE TABLE IF NOT EXISTS frequencies (
    trip_id      TEXT NOT NULL,
    start_time   TEXT NOT NULL,
    end_time     TEXT NOT NULL,
    headway_secs INTEGER NOT NULL,
    exact_times  INTEGER,
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
  )`,

  // transfers.txt
  `CREATE TABLE IF NOT EXISTS transfers (
    from_stop_id      TEXT,
    to_stop_id        TEXT,
    from_route_id     TEXT,
    to_route_id       TEXT,
    from_trip_id      TEXT,
    to_trip_id        TEXT,
    transfer_type     INTEGER NOT NULL,
    min_transfer_time INTEGER,
    FOREIGN KEY (from_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (to_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (from_route_id) REFERENCES routes(route_id),
    FOREIGN KEY (to_route_id) REFERENCES routes(route_id),
    FOREIGN KEY (from_trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (to_trip_id) REFERENCES trips(trip_id)
  )`,

  // pattern_jp.txt (GTFS-JP)
  `CREATE TABLE IF NOT EXISTS pattern_jp (
    pattern_id   TEXT PRIMARY KEY,
    route_id     TEXT NOT NULL,
    pattern_name TEXT,
    pattern_url  TEXT,
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
  )`,

  // areas.txt
  `CREATE TABLE IF NOT EXISTS areas (
    area_id   TEXT PRIMARY KEY,
    area_name TEXT
  )`,

  // stop_areas.txt
  `CREATE TABLE IF NOT EXISTS stop_areas (
    area_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    FOREIGN KEY (area_id) REFERENCES areas(area_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id)
  )`,

  // networks.txt
  `CREATE TABLE IF NOT EXISTS networks (
    network_id   TEXT PRIMARY KEY,
    network_name TEXT
  )`,

  // route_networks.txt
  `CREATE TABLE IF NOT EXISTS route_networks (
    network_id TEXT NOT NULL,
    route_id   TEXT NOT NULL,
    FOREIGN KEY (network_id) REFERENCES networks(network_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
  )`,

  // location_groups.txt
  `CREATE TABLE IF NOT EXISTS location_groups (
    location_group_id   TEXT PRIMARY KEY,
    location_group_name TEXT
  )`,

  // location_group_stops.txt
  `CREATE TABLE IF NOT EXISTS location_group_stops (
    location_group_id TEXT NOT NULL,
    stop_id           TEXT NOT NULL,
    FOREIGN KEY (location_group_id) REFERENCES location_groups(location_group_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id)
  )`,

  // booking_rules.txt
  `CREATE TABLE IF NOT EXISTS booking_rules (
    booking_rule_id            TEXT PRIMARY KEY,
    booking_type               INTEGER NOT NULL,
    prior_notice_duration_min  INTEGER,
    prior_notice_duration_max  INTEGER,
    prior_notice_last_day      INTEGER,
    prior_notice_last_time     TEXT,
    prior_notice_start_day     INTEGER,
    message                    TEXT,
    pickup_message             TEXT,
    drop_off_message           TEXT
  )`,

  // =========================================================================
  // GTFS Fares v2
  // =========================================================================

  // timeframes.txt
  `CREATE TABLE IF NOT EXISTS timeframes (
    timeframe_group_id TEXT NOT NULL,
    start_time         TEXT,
    end_time           TEXT,
    service_id         TEXT,
    FOREIGN KEY (service_id) REFERENCES calendar(service_id)
  )`,

  // rider_categories.txt
  `CREATE TABLE IF NOT EXISTS rider_categories (
    rider_category_id          TEXT PRIMARY KEY,
    rider_category_name        TEXT NOT NULL,
    is_default_fare_category   INTEGER,
    eligibility_url            TEXT
  )`,

  // fare_media.txt
  `CREATE TABLE IF NOT EXISTS fare_media (
    fare_media_id   TEXT PRIMARY KEY,
    fare_media_name TEXT NOT NULL,
    fare_media_type INTEGER NOT NULL
  )`,

  // fare_products.txt
  `CREATE TABLE IF NOT EXISTS fare_products (
    fare_product_id   TEXT NOT NULL,
    fare_product_name TEXT NOT NULL,
    rider_category_id TEXT,
    fare_media_id     TEXT,
    amount            REAL NOT NULL,
    currency          TEXT NOT NULL,
    FOREIGN KEY (rider_category_id) REFERENCES rider_categories(rider_category_id),
    FOREIGN KEY (fare_media_id) REFERENCES fare_media(fare_media_id)
  )`,

  // fare_leg_rules.txt
  `CREATE TABLE IF NOT EXISTS fare_leg_rules (
    leg_group_id             TEXT,
    network_id               TEXT,
    from_area_id             TEXT,
    to_area_id               TEXT,
    from_timeframe_group_id  TEXT,
    to_timeframe_group_id    TEXT,
    fare_product_id          TEXT NOT NULL,
    rule_priority            INTEGER,
    FOREIGN KEY (from_area_id) REFERENCES areas(area_id),
    FOREIGN KEY (to_area_id) REFERENCES areas(area_id),
    FOREIGN KEY (fare_product_id) REFERENCES fare_products(fare_product_id)
  )`,

  // fare_leg_join_rules.txt
  `CREATE TABLE IF NOT EXISTS fare_leg_join_rules (
    from_leg_group_id       TEXT,
    to_leg_group_id         TEXT,
    transfer_fare_product_id TEXT,
    duration_limit           INTEGER,
    duration_limit_type      INTEGER,
    fare_transfer_type       INTEGER
  )`,

  // fare_transfer_rules.txt
  `CREATE TABLE IF NOT EXISTS fare_transfer_rules (
    from_leg_group_id        TEXT,
    to_leg_group_id          TEXT,
    transfer_fare_product_id TEXT,
    duration_limit           INTEGER,
    duration_limit_type      INTEGER,
    fare_transfer_type       INTEGER
  )`,
];

// ---------------------------------------------------------------------------
// Indexes for query performance
// ---------------------------------------------------------------------------

const INDEXES: string[] = [
  'CREATE INDEX idx_stops_lat           ON stops (stop_lat)',
  'CREATE INDEX idx_stops_lon           ON stops (stop_lon)',
  'CREATE INDEX idx_stop_times_stop_dep ON stop_times (stop_id, departure_time)',
  'CREATE INDEX idx_trips_route         ON trips (route_id)',
  'CREATE INDEX idx_cal_dates_date      ON calendar_dates (date)',
  'CREATE INDEX idx_translations_table  ON translations (table_name, field_name)',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved source info for build processing. */
interface BuildSource {
  directory: string;
  prefix: string;
  nameEn: string;
}

interface ImportSummary {
  source: string;
  table: string;
  rows: number;
}

// ---------------------------------------------------------------------------
// Schema introspection helpers
// ---------------------------------------------------------------------------

/**
 * Extract column definitions from a CREATE TABLE DDL.
 *
 * NOTE: The regex assumes single-word types (TEXT, INTEGER, REAL) which is
 * sufficient for the current GTFS schema. If compound types like DECIMAL(10,2)
 * are needed in the future, consider replacing DDL parsing with a structured
 * schema definition.
 */
function extractSchemaColumns(ddl: string): { name: string; nullable: boolean }[] {
  const columns: { name: string; nullable: boolean }[] = [];
  // Match column definitions: column_name TYPE [NOT NULL] [...]
  // Stop at lines that start with PRIMARY KEY, FOREIGN KEY, or closing paren
  const body = ddl.match(/\(([^]*)\)/)?.[1];
  if (!body) {
    return columns;
  }

  for (const line of body.split(',')) {
    const trimmed = line.trim();
    // Skip constraints
    if (/^(PRIMARY KEY|FOREIGN KEY)\b/i.test(trimmed)) {
      continue;
    }
    const colMatch = trimmed.match(/^(\w+)\s+\w+/);
    if (colMatch) {
      const name = colMatch[1];
      const notNull = /NOT NULL/i.test(trimmed) || /PRIMARY KEY/i.test(trimmed);
      columns.push({ name, nullable: !notNull });
    }
  }
  return columns;
}

/** Build a lookup: tableName -> column definitions */
function buildSchemaMap(): Map<string, { name: string; nullable: boolean }[]> {
  const map = new Map<string, { name: string; nullable: boolean }[]>();
  for (const ddl of SCHEMA) {
    const tableMatch = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (!tableMatch) {
      continue;
    }
    map.set(tableMatch[1], extractSchemaColumns(ddl));
  }
  return map;
}

// ---------------------------------------------------------------------------
// CSV streaming reader
// ---------------------------------------------------------------------------

interface CsvStream {
  headers: string[];
  rows: AsyncIterable<string[]>;
}

/** Open a CSV file and return its headers plus an async iterable of data rows. */
async function openCsvStream(filePath: string): Promise<CsvStream | null> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const iter = rl[Symbol.asyncIterator]();

  // Read lines until we find a non-empty header line
  let headers: string[] | null = null;
  while (headers === null) {
    const { value, done } = await iter.next();
    if (done) {
      return null;
    } // Empty file
    const line = value.trim();
    if (line.length === 0) {
      continue;
    }
    headers = splitCsvLine(line.replace(/^\uFEFF/, '')).map((h) => h.trim());
  }

  // Return headers and an async iterable over remaining data rows
  const rows: AsyncIterable<string[]> = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          while (true) {
            const { value, done } = await iter.next();
            if (done) {
              return { value: undefined, done: true as const };
            }
            const line = value.trim();
            if (line.length === 0) {
              continue;
            }
            // NOTE: readline is line-based, so CSV records with embedded
            // newlines inside quoted fields would be split across iterations.
            // GTFS feeds rarely contain such values; if needed, switch to a
            // streaming CSV parser that buffers until quotes are balanced.
            return { value: splitCsvLine(line), done: false as const };
          }
        },
      };
    },
  };

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Header validation
// ---------------------------------------------------------------------------

function validateHeaders(
  tableName: string,
  csvHeaders: string[],
  schemaColumns: { name: string; nullable: boolean }[],
): { usableHeaders: string[]; ok: boolean } {
  const schemaNames = new Set(schemaColumns.map((c) => c.name));
  const csvSet = new Set(csvHeaders);

  let ok = true;

  // CSV columns not in schema -> warn and skip
  const extraInCsv = csvHeaders.filter((h) => !schemaNames.has(h));
  if (extraInCsv.length > 0) {
    console.warn(
      `  WARN [${tableName}]: CSV columns not in schema (ignored): ${extraInCsv.join(', ')}`,
    );
  }

  // Schema NOT NULL columns missing from CSV -> error
  const missingRequired = schemaColumns.filter((c) => !c.nullable && !csvSet.has(c.name));
  if (missingRequired.length > 0) {
    console.error(
      `  ERROR [${tableName}]: Required columns missing from CSV: ${missingRequired.map((c) => c.name).join(', ')}`,
    );
    ok = false;
  }

  // Schema nullable columns missing from CSV -> warn
  const missingNullable = schemaColumns.filter((c) => c.nullable && !csvSet.has(c.name));
  if (missingNullable.length > 0) {
    console.warn(
      `  WARN [${tableName}]: Nullable columns missing from CSV (will be NULL): ${missingNullable.map((c) => c.name).join(', ')}`,
    );
  }

  // Usable headers = CSV headers that exist in schema
  const usableHeaders = csvHeaders.filter((h) => schemaNames.has(h));
  return { usableHeaders, ok };
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

function tableNameFromFile(filename: string): string {
  return filename.replace(/\.txt$/, '');
}

// ---------------------------------------------------------------------------
// Data import (streaming + batched)
// ---------------------------------------------------------------------------

async function importCsvFile(
  db: Database.Database,
  filePath: string,
  tableName: string,
  schemaColumns: { name: string; nullable: boolean }[],
): Promise<number> {
  const csv = await openCsvStream(filePath);
  if (!csv) {
    return 0;
  }

  // Validate headers against schema
  const validation = validateHeaders(tableName, csv.headers, schemaColumns);
  if (!validation.ok) {
    throw new Error(`Schema validation failed for ${tableName}. Cannot import.`);
  }

  const { usableHeaders } = validation;
  const usableIndices = usableHeaders.map((h) => csv.headers.indexOf(h));

  // Prepare INSERT statement
  const placeholders = usableHeaders.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${tableName} (${usableHeaders.join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(insertSql);

  const insertBatch = db.transaction((rows: unknown[][]) => {
    for (const values of rows) {
      stmt.run(...values);
    }
  });

  let batch: unknown[][] = [];
  let totalRows = 0;

  for await (const row of csv.rows) {
    const values = usableIndices.map((idx) => {
      const v = row[idx]?.trim() ?? '';
      if (v === '') {
        return null;
      }
      return v;
    });

    batch.push(values);

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      totalRows += batch.length;
      batch = [];
    }
  }

  // Flush remaining rows
  if (batch.length > 0) {
    insertBatch(batch);
    totalRows += batch.length;
  }

  return totalRows;
}

// ---------------------------------------------------------------------------
// FK integrity check
// ---------------------------------------------------------------------------

function checkForeignKeys(db: Database.Database): void {
  console.log('\nChecking foreign key integrity...');

  const violations = db.prepare('PRAGMA foreign_key_check').all() as Array<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>;

  if (violations.length === 0) {
    console.log('  No foreign key violations found.');
    return;
  }

  // Group by table
  const byTable = new Map<string, typeof violations>();
  for (const v of violations) {
    const list = byTable.get(v.table) ?? [];
    list.push(v);
    byTable.set(v.table, list);
  }

  console.warn(`  WARN: ${violations.length} foreign key violation(s) found:`);
  for (const [table, tableViolations] of byTable) {
    console.warn(
      `    ${table}: ${tableViolations.length} violation(s) (parent: ${tableViolations[0].parent})`,
    );
    // Show up to 5 sample violations
    const samples = tableViolations.slice(0, 5);
    for (const s of samples) {
      console.warn(`      rowid=${s.rowid}, parent_table=${s.parent}, fkid=${s.fkid}`);
    }
    if (tableViolations.length > 5) {
      console.warn(`      ... and ${tableViolations.length - 5} more`);
    }
  }
}

// ---------------------------------------------------------------------------
// DB statistics output
// ---------------------------------------------------------------------------

function printStatistics(db: Database.Database, dbPath: string): void {
  console.log('\n=== Database Statistics ===');

  const dbSize = statSync(dbPath).size;
  const pageSize = (db.prepare('PRAGMA page_size').get() as { page_size: number }).page_size;
  const pageCount = (db.prepare('PRAGMA page_count').get() as { page_count: number }).page_count;

  console.log(`  File:       ${dbPath}`);
  console.log(`  Total size: ${formatBytes(dbSize)}`);
  console.log(`  Page size:  ${pageSize} bytes`);
  console.log(`  Page count: ${pageCount}`);

  // Per-object storage via dbstat virtual table
  console.log('\n  Per-object storage:');
  console.log(
    `  ${'Object'.padEnd(40)} ${'Size'.padStart(10)} ${'Pages'.padStart(7)} ${'% of DB'.padStart(8)}`,
  );
  console.log(`  ${'-'.repeat(65)}`);

  try {
    const dbstatRows = db
      .prepare(
        `SELECT name, SUM(pgsize) as total_size, COUNT(*) as pages
         FROM dbstat
         GROUP BY name
         ORDER BY total_size DESC`,
      )
      .all() as Array<{ name: string; total_size: number; pages: number }>;

    for (const row of dbstatRows) {
      const pct = ((row.total_size / dbSize) * 100).toFixed(1);
      console.log(
        `  ${row.name.padEnd(40)} ${formatBytes(row.total_size).padStart(10)} ${String(row.pages).padStart(7)} ${(pct + '%').padStart(8)}`,
      );
    }
  } catch {
    console.log(
      '  (dbstat virtual table not available — compile SQLite with SQLITE_ENABLE_DBSTAT_VTAB)',
    );
  }

  // Per-table row counts
  console.log('\n  Per-table row counts:');
  const schemaMap = buildSchemaMap();
  for (const tableName of schemaMap.keys()) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get() as {
        cnt: number;
      };
      console.log(`  ${tableName.padEnd(24)} ${String(result.cnt).padStart(10)} rows`);
    } catch {
      // Table might not exist if no data was imported
    }
  }

  // Index info
  console.log('\n  Indexes:');
  try {
    const indexRows = db
      .prepare(
        `SELECT name, SUM(pgsize) as total_size
         FROM dbstat
         WHERE name LIKE 'idx_%'
         GROUP BY name
         ORDER BY total_size DESC`,
      )
      .all() as Array<{ name: string; total_size: number }>;

    if (indexRows.length === 0) {
      console.log('  (no custom indexes found in dbstat)');
    }

    for (const row of indexRows) {
      // Find which table this index belongs to
      const indexInfo = db
        .prepare(`SELECT tbl_name FROM sqlite_master WHERE type='index' AND name=?`)
        .get(row.name) as { tbl_name: string } | undefined;
      const tblName = indexInfo?.tbl_name ?? '?';
      console.log(
        `  ${row.name.padEnd(30)} on ${tblName.padEnd(16)} ${formatBytes(row.total_size).padStart(10)}`,
      );
    }
  } catch {
    console.log('  (dbstat not available for index stats)');
  }
}

// ---------------------------------------------------------------------------
// Build one source DB
// ---------------------------------------------------------------------------

async function buildSourceDb(
  source: BuildSource,
  schemaMap: Map<string, { name: string; nullable: boolean }[]>,
): Promise<{ dbPath: string; summary: ImportSummary[] }> {
  const sourceDir = join(GTFS_BASE_DIR, source.directory);
  const prefix = source.prefix;
  const dbPath = join(OUTPUT_DIR, `${prefix}.db`);

  console.log(`\n========================================`);
  console.log(`Source: ${source.directory} (${source.nameEn})`);
  console.log(`  prefix: ${prefix}`);
  console.log(`  output: ${dbPath}`);
  console.log(`========================================`);

  // Remove existing DB for this source
  if (existsSync(dbPath)) {
    rmSync(dbPath);
    console.log(`Removed existing DB: ${dbPath}`);
  }

  // Create database and tables
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // Disable during bulk import for performance

  for (const ddl of SCHEMA) {
    db.exec(ddl);
  }
  console.log(`${SCHEMA.length} tables created.`);

  const knownTables = new Set(schemaMap.keys());
  const summary: ImportSummary[] = [];

  // Import CSV data
  const csvFiles = readdirSync(sourceDir)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  if (csvFiles.length === 0) {
    console.warn(`  WARN: No .txt files found in ${sourceDir}`);
    db.close();
    return { dbPath, summary };
  }

  console.log(`Found ${csvFiles.length} GTFS files`);

  for (const file of csvFiles) {
    const tableName = tableNameFromFile(file);

    if (!knownTables.has(tableName)) {
      console.log(`  SKIP: ${file} (no matching table definition)`);
      continue;
    }

    const filePath = join(sourceDir, file);
    const columns = schemaMap.get(tableName)!;

    try {
      const rowCount = await importCsvFile(db, filePath, tableName, columns);

      if (rowCount === 0) {
        console.log(`  SKIP: ${file} (no data rows)`);
        continue;
      }

      summary.push({ source: prefix, table: tableName, rows: rowCount });
      console.log(`  ${tableName.padEnd(20)} ${String(rowCount).padStart(10)} rows`);
    } catch (err) {
      console.error(
        `  ERROR importing ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  // Create indexes
  console.log('\nCreating indexes...');
  for (const idx of INDEXES) {
    db.exec(idx);
  }
  console.log(`${INDEXES.length} indexes created.`);

  // FK integrity check
  db.pragma('foreign_keys = ON');
  checkForeignKeys(db);

  // VACUUM and ANALYZE
  console.log('\nOptimizing database...');
  db.exec('VACUUM');
  db.exec('ANALYZE');
  console.log('VACUUM + ANALYZE complete.');

  // Statistics
  printStatistics(db, dbPath);

  db.close();
  return { dbPath, summary };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== GTFS CSV -> SQLite DB (per-source) ===\n');

  // 1. Load resource definitions
  const allDefs = await loadAllGtfsSources();
  let sources: BuildSource[] = allDefs.map((d) => ({
    directory: d.pipeline.outDir,
    prefix: d.pipeline.prefix,
    nameEn: d.resource.nameEn,
  }));

  const cliFilter = process.argv[2];

  if (cliFilter) {
    sources = sources.filter((r) => r.directory === cliFilter);
    if (sources.length === 0) {
      throw new Error(
        `No resource found with directory "${cliFilter}". Available: ${allDefs
          .map((d) => d.pipeline.outDir)
          .join(', ')}`,
      );
    }
  }

  // Filter to sources whose directories actually exist
  sources = sources.filter((r) => {
    const dir = join(GTFS_BASE_DIR, r.directory);
    if (!existsSync(dir)) {
      console.warn(`  WARN: Skipping "${r.directory}" (directory not found: ${dir})`);
      return false;
    }
    return true;
  });

  if (sources.length === 0) {
    throw new Error('No GTFS data sources found with existing directories.');
  }

  console.log(`Data sources (${sources.length}):`);
  for (const s of sources) {
    console.log(`  ${s.directory} (prefix: ${s.prefix}) — ${s.nameEn}`);
  }

  // 2. Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Build schema map for validation
  const schemaMap = buildSchemaMap();

  // 3. Build per-source databases
  const allSummary: ImportSummary[] = [];
  const dbPaths: string[] = [];

  for (const source of sources) {
    const { dbPath, summary } = await buildSourceDb(source, schemaMap);
    dbPaths.push(dbPath);
    allSummary.push(...summary);
  }

  // 4. Final summary
  console.log('\n=== Import Summary ===');
  const totalRows = allSummary.reduce((acc, s) => acc + s.rows, 0);
  console.log(`  Sources:    ${sources.map((s) => `${s.directory} (${s.prefix})`).join(', ')}`);
  console.log(`  Tables:     ${new Set(allSummary.map((s) => s.table)).size}`);
  console.log(`  Total rows: ${totalRows.toLocaleString()}`);
  for (const dbPath of dbPaths) {
    console.log(`  DB: ${dbPath} (${formatBytes(statSync(dbPath).size)})`);
  }
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
