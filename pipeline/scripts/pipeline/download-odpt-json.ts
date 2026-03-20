#!/usr/bin/env -S npx tsx

/**
 * Download ODPT JSON API data.
 *
 * Fetches JSON data from ODPT API endpoints and saves to local files.
 * Authentication is handled via ODPT_ACCESS_TOKEN environment variable.
 *
 * Features:
 * - Retry with exponential backoff on network failure
 * - JSON response integrity check
 * - JSON archive preservation with timestamp
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/download-odpt-json.ts <source-name>
 *   npx tsx pipeline/scripts/pipeline/download-odpt-json.ts yurikamome-station
 *
 * Output: pipeline/workspace/data/odpt-json/{outDir}/{odptType}.json
 *   e.g. pipeline/workspace/data/odpt-json/yurikamome/odpt_Station.json
 */

import { statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { OdptJsonSourceDefinition } from '../../src/types/odpt-json-resource';
import {
  archiveFilename,
  buildAuthenticatedUrl,
  FETCH_TIMEOUT_MS,
  redactTokens,
  withRetry,
  wrapTimeoutError,
} from '../../src/lib/download/download-utils';
import { saveDownloadMeta } from '../../src/lib/download/download-meta';
import {
  determineBatchExitCode,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../../src/lib/pipeline-utils';
import { ensureDir } from '../../src/lib/utils';
import {
  listOdptJsonSourceNames,
  loadOdptJsonSource,
} from '../../src/lib/resources/load-odpt-json-sources';

import { ARCHIVES_DIR, ODPT_JSON_DATA_DIR, PIPELINE_ROOT } from '../../src/lib/paths';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive output filename from odptType.
 * e.g. 'odpt:Station' → 'odpt_Station.json'
 */
function deriveFilename(source: OdptJsonSourceDefinition): string {
  if (source.pipeline.outFileName) {
    return source.pipeline.outFileName;
  }
  return source.resource.odptType.replace(':', '_') + '.json';
}

/**
 * Build the full endpoint URL with authentication if required.
 */
function buildUrl(source: OdptJsonSourceDefinition, accessToken: string | undefined): string {
  return buildAuthenticatedUrl(
    source.resource.endpointUrl,
    source.resource.authentication,
    accessToken,
    source.resource.nameEn,
  );
}

// ---------------------------------------------------------------------------
// Fetch with retry
// ---------------------------------------------------------------------------

/** Result of a successful fetch. */
interface FetchResult {
  /** Response body as text. */
  body: string;
  /** HTTP Content-Type header value, if present. */
  contentType: string;
}

async function fetchWithRetry(url: string, label: string): Promise<FetchResult> {
  return withRetry(async () => {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw wrapTimeoutError(err, label);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const body = await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    return { body, contentType };
  }, label);
}

// ---------------------------------------------------------------------------
// JSON archive preservation
// ---------------------------------------------------------------------------

function archiveJson(body: string, archiveDir: string, filename: string): string {
  ensureDir(archiveDir);
  const archivePath = join(archiveDir, archiveFilename(filename));
  writeFileSync(archivePath, body, 'utf-8');
  return archivePath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Usage: npx tsx pipeline/scripts/pipeline/download-odpt-json.ts <source-name>');
  console.log('       npx tsx pipeline/scripts/pipeline/download-odpt-json.ts --targets <file>');
  console.log('       npx tsx pipeline/scripts/pipeline/download-odpt-json.ts --list\n');
  console.log('Options:');
  console.log('  --targets <file>  Batch download from a target list file (.ts)');
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
    const names = listOdptJsonSourceNames();
    console.log('Available ODPT JSON sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch download (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'download-odpt-json.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

  const accessToken = process.env['ODPT_ACCESS_TOKEN'];

  let source: OdptJsonSourceDefinition;
  try {
    source = await loadOdptJsonSource(arg.name);
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

  const { outDir, prefix } = source.pipeline;
  const { nameJa, nameEn, provider, license } = source.resource;
  const filename = deriveFilename(source);
  const outputDir = join(ODPT_JSON_DATA_DIR, outDir);
  const outputPath = join(outputDir, filename);
  const archiveDir = join(ARCHIVES_DIR, 'odpt-json', outDir);

  const downloadedAt = new Date().toISOString();
  const t0 = performance.now();

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Format: ${source.resource.dataFormat.type}`);
  console.log(`  Name: ${nameJa} (${nameEn})`);
  console.log(`  Provider: ${provider.name.ja.long}`);
  console.log(`  License: ${license.name}`);
  console.log(`  Output: ${outDir}/ (prefix: ${prefix})`);
  console.log('');

  try {
    // Build URL with auth
    const url = buildUrl(source, accessToken);

    // 1. Fetch with retry
    console.log(`Downloading ${source.resource.endpointUrl}`);
    const startTime = performance.now();
    const result = await fetchWithRetry(url, source.resource.endpointUrl);
    const durationMs = Math.round(performance.now() - startTime);
    const bodyBytes = Buffer.byteLength(result.body, 'utf-8');
    console.log(`  Filename: ${filename}`);
    console.log(`  Size: ${bodyBytes.toLocaleString()} bytes`);
    console.log(`  Content-Type: ${result.contentType || '(not provided)'}`);
    console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);

    // Validate that the response is valid JSON (download integrity check)
    try {
      JSON.parse(result.body);
    } catch {
      throw new Error('Response is not valid JSON');
    }

    // 2. Archive with timestamp
    const archivePath = archiveJson(result.body, archiveDir, filename);
    console.log(`  Archived: ${archivePath}`);

    // 3. Write to output directory
    ensureDir(outputDir);
    writeFileSync(outputPath, result.body, 'utf-8');

    console.log(`\nSaved to ${outputDir}/`);
    const savedSize = statSync(outputPath).size;
    console.log(`  ${filename.padEnd(24)} ${savedSize.toLocaleString().padStart(10)} bytes`);

    // 4. Record download metadata
    const totalDurationMs = Math.round(performance.now() - t0);
    saveDownloadMeta({
      sourceName: arg.name,
      type: 'odpt-json',
      status: 'ok',
      downloadedAt,
      url: source.resource.endpointUrl,
      size: bodyBytes,
      contentType: result.contentType || '',
      durationMs: totalDurationMs,
      archivePath: archivePath.replace(PIPELINE_ROOT + '/', ''),
    });
    console.log(`\nDownload metadata: workspace/state/download-meta/${arg.name}.json`);
  } catch (err) {
    const totalDurationMs = Math.round(performance.now() - t0);
    const errorMessage = redactTokens(err instanceof Error ? err.message : String(err));
    console.error(`\nFATAL: ${errorMessage}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${redactTokens(err.cause.message)}`);
    }
    saveDownloadMeta({
      sourceName: arg.name,
      type: 'odpt-json',
      status: 'error',
      downloadedAt,
      url: source.resource.endpointUrl,
      durationMs: totalDurationMs,
      error: errorMessage,
    });
    process.exitCode = 1;
  } finally {
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nExit code: ${code} (${label})\n=== ${arg.name} [END] ===`);
  }
}

runMain(main);
