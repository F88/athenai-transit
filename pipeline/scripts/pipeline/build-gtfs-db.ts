#!/usr/bin/env -S npx tsx

/**
 * Convert GTFS CSV files into a per-source SQLite database.
 *
 * Each invocation processes a single GTFS source. For batch processing,
 * use `--targets <file>` which runs this script once per source in a
 * child process (same pattern as download-gtfs.ts).
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts toei-bus
 *   npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --targets pipeline/config/targets/build-db.ts
 *   npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --list
 *
 * Input:  pipeline/workspace/data/gtfs/{directory}/*.txt (GTFS CSV files)
 * Output: pipeline/workspace/_build/db/{outDir}.db (e.g. toei-bus.db, toei-train.db)
 */

import Database from 'better-sqlite3';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';

import { splitCsvLine } from '../../src/lib/pipeline/gtfs-csv-parser';
import {
  GTFS_JP_LEGACY_TRANSLATION_HEADERS,
  GTFS_TRANSLATABLE_FIELDS,
  convertGtfsJpLegacyTranslationRow,
  isGtfsJpLegacyTranslationsHeader,
  type GtfsJpLegacyTranslationSets,
} from './lib/gtfs-csv-converter';
import { INDEXES, SCHEMA } from '../../src/lib/pipeline/gtfs-schema';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../src/lib/pipeline/pipeline-utils';
import { formatBytes } from '../../src/lib/format-utils';
import { listGtfsSourceNames, loadGtfsSource } from '../../src/lib/resources/load-gtfs-sources';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, GTFS_DATA_DIR } from '../../src/lib/paths';

const GTFS_BASE_DIR = GTFS_DATA_DIR;
const OUTPUT_DIR = DB_DIR;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved source info for build processing. */
interface BuildSource {
  directory: string;
  nameEn: string;
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

/**
 * Read just the CSV header row of a file and close the underlying
 * resources before returning. Used by callers that need to dispatch on
 * file format before deciding which importer to invoke.
 *
 * Done as a dedicated reader (rather than reusing {@link openCsvStream}
 * and discarding the iterator) so the readline interface and file
 * stream are released deterministically — relying on GC would leak file
 * descriptors when this is called once per source in a batch run.
 *
 * @returns the parsed header columns, or `null` if the file has no
 *   non-empty lines.
 */
async function peekCsvHeaders(filePath: string): Promise<string[] | null> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      return splitCsvLine(trimmed.replace(/^\uFEFF/, '')).map((h) => h.trim());
    }
    return null;
  } finally {
    rl.close();
    stream.destroy();
  }
}

/**
 * Stream a CSV file and collect the distinct values of a single column
 * into an in-memory `Set<string>`. Used for pre-scanning standard GTFS
 * CSVs (stops.txt, routes.txt, stop_times.txt) to build lookup sets
 * before importing a legacy translations.txt that mixes translations
 * across multiple tables/fields.
 *
 * Empty/whitespace-only values are skipped. Values are trimmed.
 *
 * @returns the set of distinct non-empty trimmed values, or an empty
 *   set if the file does not exist, has no rows, or the column is not
 *   present in the header.
 */
async function peekDistinctColumn(filePath: string, columnName: string): Promise<Set<string>> {
  const result = new Set<string>();
  if (!existsSync(filePath)) {
    return result;
  }
  const csv = await openCsvStream(filePath);
  if (!csv) {
    return result;
  }
  const colIndex = csv.headers.indexOf(columnName);
  if (colIndex === -1) {
    return result;
  }
  for await (const row of csv.rows) {
    const value = (row[colIndex] ?? '').trim();
    if (value !== '') {
      result.add(value);
    }
  }
  return result;
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

/**
 * Pre-scan every translatable (table, field) listed in
 * {@link GTFS_TRANSLATABLE_FIELDS} from the source CSVs and build the
 * value-based classification sets used by
 * {@link convertGtfsJpLegacyTranslationRow}.
 *
 * Files / columns that are absent in the feed contribute an empty set
 * — the converter still works because every column is optional in the
 * 3-column form (a `trans_id` only emits rows for sets it actually
 * matches).
 */
async function buildLegacyTranslationSets(sourceDir: string): Promise<GtfsJpLegacyTranslationSets> {
  const byTableField = new Map<string, Set<string>>();
  // Group fields by table to scan each file only once.
  const fieldsByTable = new Map<string, string[]>();
  for (const { table, field } of GTFS_TRANSLATABLE_FIELDS) {
    const list = fieldsByTable.get(table) ?? [];
    list.push(field);
    fieldsByTable.set(table, list);
  }
  for (const [table, fields] of fieldsByTable) {
    const filePath = join(sourceDir, `${table}.txt`);
    if (!existsSync(filePath)) {
      continue;
    }
    for (const field of fields) {
      const set = await peekDistinctColumn(filePath, field);
      if (set.size > 0) {
        byTableField.set(`${table}.${field}`, set);
      }
    }
  }
  return { byTableField };
}

/**
 * Import a translations.txt file shipped in the GTFS-JP legacy
 * 3-column format (`trans_id, lang, translation`).
 *
 * The pure CSV-row → standard-rows conversion lives in
 * {@link convertGtfsJpLegacyTranslationRow}; this function adds CSV
 * streaming, header validation, pre-scan of the source CSVs to build
 * classification sets, and batched DB inserts on top.
 *
 * The 3-column form has no table/field identifier — each `trans_id`
 * value is matched against every translatable column in the feed and
 * one standard row is emitted for every match (including the case of a
 * single value matching multiple tables, e.g. a stop name that also
 * appears verbatim as a `trip_headsign`). Rows whose `trans_id` does
 * not match any column are counted as orphans and skipped with a
 * summary warn log.
 *
 * Throws if the header is not exactly the expected 3-column legacy
 * form, so any drift in the source feed surfaces as a loud failure
 * rather than silent data loss.
 */
async function importGtfsJpLegacyTranslations(
  db: Database.Database,
  filePath: string,
  sourceDir: string,
): Promise<number> {
  const csv = await openCsvStream(filePath);
  if (!csv) {
    return 0;
  }

  if (!isGtfsJpLegacyTranslationsHeader(csv.headers)) {
    throw new Error(
      `Unexpected translations.txt headers: [${csv.headers.join(', ')}] (expected [${GTFS_JP_LEGACY_TRANSLATION_HEADERS.join(', ')}])`,
    );
  }

  // Pre-scan source CSVs to build the value-based classification sets.
  // The pure converter takes them as input so it stays I/O-free and
  // the test suite can exercise classification without touching disk.
  const sets = await buildLegacyTranslationSets(sourceDir);
  const setSummary = Array.from(sets.byTableField.entries())
    .map(([k, v]) => `${k}=${v.size}`)
    .join(', ');
  console.log(`  [translations] classifier sets: ${setSummary || '(none)'}`);

  const stmt = db.prepare(
    'INSERT INTO translations (table_name, field_name, language, translation, field_value) VALUES (?, ?, ?, ?, ?)',
  );

  const insertBatch = db.transaction((rows: unknown[][]) => {
    for (const values of rows) {
      stmt.run(...values);
    }
  });

  let batch: unknown[][] = [];
  let totalRows = 0;
  let orphanCount = 0;
  const orphanSamples: string[] = [];

  for await (const row of csv.rows) {
    const stds = convertGtfsJpLegacyTranslationRow(
      {
        trans_id: row[0] ?? '',
        lang: row[1] ?? '',
        translation: row[2] ?? '',
      },
      sets,
    );
    if (stds.length === 0) {
      const transId = (row[0] ?? '').trim();
      const lang = (row[1] ?? '').trim();
      const translation = (row[2] ?? '').trim();
      // Only count rows that had all three fields populated as orphans
      // — an empty-field row is a malformed input, not an unmatched
      // trans_id.
      if (transId !== '' && lang !== '' && translation !== '') {
        orphanCount++;
        if (orphanSamples.length < 5) {
          orphanSamples.push(transId);
        }
      }
      continue;
    }

    for (const std of stds) {
      batch.push([std.table_name, std.field_name, std.language, std.translation, std.field_value]);

      if (batch.length >= BATCH_SIZE) {
        insertBatch(batch);
        totalRows += batch.length;
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    totalRows += batch.length;
  }

  if (orphanCount > 0) {
    console.warn(
      `  WARN [translations]: ${orphanCount} orphan rows skipped (trans_id not in any translatable column). Samples: ${orphanSamples.map((s) => `"${s}"`).join(', ')}`,
    );
  }

  return totalRows;
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

/**
 * Remove the temp DB file plus its WAL sidecars (`-wal`, `-shm`).
 *
 * `journal_mode = WAL` produces sidecar files alongside the main DB
 * file; if the temp build aborts before {@link Database#close}, those
 * sidecars are left on disk. The next run's stale cleanup must remove
 * them too — otherwise SQLite's WAL recovery on reopen can revive
 * partially-written transactions and produce inconsistent state.
 *
 * Reports any files that were actually removed (an empty list returns
 * an empty string).
 */
function cleanupTempDbArtifacts(tmpDbPath: string): string[] {
  const removed: string[] = [];
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${tmpDbPath}${suffix}`;
    if (existsSync(p)) {
      rmSync(p, { force: true });
      removed.push(p);
    }
  }
  return removed;
}

async function buildSourceDb(
  source: BuildSource,
  schemaMap: Map<string, { name: string; nullable: boolean }[]>,
): Promise<void> {
  const sourceDir = join(GTFS_BASE_DIR, source.directory);
  const dbPath = join(OUTPUT_DIR, `${source.directory}.db`);
  const tmpDbPath = `${dbPath}.tmp`;

  // Build into a temporary file so the existing DB remains intact on failure.
  // On success, the temp file is renamed to the final path.
  // Clean up any leftover temp artifacts (main file + WAL sidecars)
  // from a previous failed run before opening a fresh DB.
  const staleRemoved = cleanupTempDbArtifacts(tmpDbPath);
  if (staleRemoved.length > 0) {
    console.log(`Removed stale temp files: ${staleRemoved.join(', ')}`);
  }

  console.log(`Creating temp DB: ${tmpDbPath}`);
  const db = new Database(tmpDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // Keep OFF: bulk import performance; no FK check is run post-import

  // Wrap the entire build in try/catch so a failure during import,
  // index creation, VACUUM, or rename always closes the DB handle and
  // removes the temp file plus its WAL sidecars. Without this, a
  // partial run would leak `.db.tmp`, `.db.tmp-wal`, and `.db.tmp-shm`
  // onto disk, and the next run's stale cleanup could miss the
  // sidecars (causing WAL recovery to revive partial state).
  try {
    await buildSourceDbInner(db, source, sourceDir, dbPath, tmpDbPath, schemaMap);
  } catch (err) {
    try {
      db.close();
    } catch {
      // Already closed (e.g. by the rename path that ran before
      // throwing). Ignore — the goal here is to release the handle so
      // the rmSync below can succeed on Windows-style file locks.
    }
    const removed = cleanupTempDbArtifacts(tmpDbPath);
    if (removed.length > 0) {
      console.error(`Cleaned up failed temp DB artifacts: ${removed.join(', ')}`);
    }
    throw err;
  }
}

async function buildSourceDbInner(
  db: Database.Database,
  source: BuildSource,
  sourceDir: string,
  dbPath: string,
  tmpDbPath: string,
  schemaMap: Map<string, { name: string; nullable: boolean }[]>,
): Promise<void> {
  for (const ddl of SCHEMA) {
    db.exec(ddl);
  }
  console.log(`${SCHEMA.length} tables created.`);

  const knownTables = new Set(schemaMap.keys());

  // Import CSV data
  const csvFiles = readdirSync(sourceDir)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  if (csvFiles.length === 0) {
    console.warn(`  WARN: No .txt files found in ${sourceDir}`);
    db.close();
    cleanupTempDbArtifacts(tmpDbPath);
    return;
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
      let rowCount: number;
      if (
        (source.directory === 'odakyu-bus' ||
          source.directory === 'tokai-kisen' ||
          source.directory === 'orange-ferry' ||
          source.directory === 'uwajima-unyu' ||
          source.directory === 'meimon-taiyo-ferry') &&
        tableName === 'translations' &&
        isGtfsJpLegacyTranslationsHeader((await peekCsvHeaders(filePath)) ?? [])
      ) {
        // These sources ship translations.txt in the legacy GTFS-JP
        // 3-column format (`trans_id, lang, translation`), which the
        // standard 6-column schema cannot ingest directly. The detect
        // is `allowlist + header peek` so that if a source later
        // upgrades to the standard 6-column form, the header check
        // fails and the dispatch quietly falls back to the standard
        // importer rather than misreporting and throwing.
        //
        // The legacy form carries no table/field identifier; the
        // converter pre-scans every translatable column in the feed
        // and emits one standard row per matching (table, field). A
        // single trans_id may produce multiple rows (e.g. a stop name
        // that also appears as a trip_headsign).
        console.log(
          `  WARN [translations] (${source.directory}): legacy GTFS-JP 3-column format detected — auto-converting to standard 6-column (value-based classification)`,
        );
        rowCount = await importGtfsJpLegacyTranslations(db, filePath, sourceDir);
      } else {
        rowCount = await importCsvFile(db, filePath, tableName, columns);
      }

      if (rowCount === 0) {
        console.log(`  SKIP: ${file} (no data rows)`);
        continue;
      }

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

  // VACUUM and ANALYZE
  console.log('\nOptimizing database...');
  db.exec('VACUUM');
  db.exec('ANALYZE');
  console.log('VACUUM + ANALYZE complete.');

  // Statistics
  printStatistics(db, tmpDbPath);

  db.close();

  // Replace existing DB with the successfully built one
  const hadExisting = existsSync(dbPath);
  renameSync(tmpDbPath, dbPath);
  if (hadExisting) {
    console.log(`\nReplaced existing DB: ${dbPath} (${formatBytes(statSync(dbPath).size)})`);
  } else {
    console.log(`\nCreated DB: ${dbPath} (${formatBytes(statSync(dbPath).size)})`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Usage: npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts <source-name>');
  console.log('       npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --targets <file>');
  console.log('       npx tsx pipeline/scripts/pipeline/build-gtfs-db.ts --list\n');
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
    console.log(`=== Batch build-db (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'build-gtfs-db.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  // Single source mode
  let source;
  try {
    source = await loadGtfsSource(arg.name);
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

  const { outDir } = source.pipeline;
  const { nameEn } = source.resource;
  const sourceDir = join(GTFS_BASE_DIR, outDir);

  if (!existsSync(sourceDir)) {
    console.error(`Error: GTFS data directory not found: ${sourceDir}`);
    console.error('  Run download-gtfs.ts first to fetch the GTFS data.');
    process.exitCode = 1;
    return;
  }

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Name:   ${nameEn}`);
  console.log(`  Input:  ${sourceDir}`);
  console.log(`  Output: ${join(OUTPUT_DIR, `${outDir}.db`)}`);
  console.log('');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const schemaMap = buildSchemaMap();
  const buildSource: BuildSource = { directory: outDir, nameEn };
  const t0 = performance.now();

  // Intentionally NOT delegating error handling to runMain here.
  // This try/catch/finally ensures that Duration, Exit code, and the
  // "=== [END] ===" marker are always printed — even on failure.
  // These markers are important for readable log output when this script
  // runs as a batch child process (--targets).
  // The catch sets process.exitCode and returns (does not re-throw),
  // so runMain's catch is not triggered — no duplicate FATAL output.
  try {
    await buildSourceDb(buildSource, schemaMap);
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
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
