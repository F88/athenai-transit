#!/usr/bin/env -S npx tsx

/**
 * Convert GTFS CSV files into a per-source SQLite database.
 *
 * Each invocation processes a single GTFS source. For batch processing,
 * use `--targets <file>` which runs this script once per source in a
 * child process (same pattern as download-gtfs.ts).
 *
 * Usage:
 *   npx tsx pipeline/scripts/build-gtfs-db.ts <source-name>
 *   npx tsx pipeline/scripts/build-gtfs-db.ts toei-bus
 *   npx tsx pipeline/scripts/build-gtfs-db.ts --targets pipeline/targets/download-gtfs.ts
 *   npx tsx pipeline/scripts/build-gtfs-db.ts --list
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

import { splitCsvLine } from '../lib/csv-utils';
import { INDEXES, SCHEMA } from '../lib/gtfs-schema';
import {
  determineBatchExitCode,
  formatBytes,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../lib/pipeline-utils';
import { listGtfsSourceNames, loadGtfsSource } from '../lib/load-gtfs-sources';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

import { DB_DIR, GTFS_DATA_DIR } from '../lib/paths';

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
): Promise<void> {
  const sourceDir = join(GTFS_BASE_DIR, source.directory);
  const dbPath = join(OUTPUT_DIR, `${source.directory}.db`);
  const tmpDbPath = `${dbPath}.tmp`;

  // Build into a temporary file so the existing DB remains intact on failure.
  // On success, the temp file is renamed to the final path.
  if (existsSync(tmpDbPath)) {
    rmSync(tmpDbPath);
    console.log(`Removed stale temp file: ${tmpDbPath}`);
  }

  console.log(`Creating temp DB: ${tmpDbPath}`);
  const db = new Database(tmpDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // Disable during bulk import for performance

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
    rmSync(tmpDbPath, { force: true });
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
      const rowCount = await importCsvFile(db, filePath, tableName, columns);

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

  // FK integrity check
  db.pragma('foreign_keys = ON');
  checkForeignKeys(db);

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
  console.log('Usage: npx tsx pipeline/scripts/build-gtfs-db.ts <source-name>');
  console.log('       npx tsx pipeline/scripts/build-gtfs-db.ts --targets <file>');
  console.log('       npx tsx pipeline/scripts/build-gtfs-db.ts --list\n');
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
