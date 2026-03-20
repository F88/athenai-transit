#!/usr/bin/env -S npx tsx

/**
 * Download GTFS static data from ODPT public API.
 *
 * Usage:
 *   npx tsx pipeline/scripts/download-gtfs.ts <source-name>
 *   npx tsx pipeline/scripts/download-gtfs.ts toei-bus
 *   npx tsx pipeline/scripts/download-gtfs.ts toei-train
 *
 * Features:
 * - Retry with exponential backoff on network failure
 * - Download progress display
 * - ZIP extraction via adm-zip (no OS-level unzip dependency)
 * - ZIP archive preservation with timestamp
 */

import AdmZip from 'adm-zip';
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  archiveFilename,
  buildAuthenticatedUrl,
  downloadWithRetry,
  redactTokens,
} from '../lib/download-utils';
import type { ExtractedFileInfo, FeedInfoMeta } from '../lib/download-meta';
import { saveDownloadMeta } from '../lib/download-meta';
import { parseFeedInfoTxt } from '../lib/gtfs-feed-info';
import {
  determineBatchExitCode,
  ensureDir,
  formatExitCode,
  loadTargetFile,
  parseCliArg,
  printBatchSummary,
  runBatch,
  runMain,
} from '../lib/pipeline-utils';
import { listGtfsSourceNames, loadGtfsSource } from '../lib/load-gtfs-sources';

import { ARCHIVES_DIR, GTFS_DATA_DIR, PIPELINE_ROOT } from '../lib/paths';

// ---------------------------------------------------------------------------
// ZIP extraction (adm-zip)
// ---------------------------------------------------------------------------

function extractZip(zipPath: string, destDir: string): string[] {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Guard against Zip Slip: reject entries with path traversal components
  for (const entry of entries) {
    const name = entry.entryName;
    if (name.startsWith('/') || name.startsWith('\\') || name.includes('..')) {
      throw new Error(`Zip Slip detected: refusing to extract entry "${name}"`);
    }
  }

  zip.extractAllTo(destDir, true);
  return entries.map((e) => e.entryName);
}

// ---------------------------------------------------------------------------
// ZIP archive preservation
// ---------------------------------------------------------------------------

function archiveZip(zipPath: string, archiveDir: string, zipFileName: string): string {
  ensureDir(archiveDir);
  const archivePath = join(archiveDir, archiveFilename(zipFileName));
  copyFileSync(zipPath, archivePath);
  return archivePath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Usage: npx tsx pipeline/scripts/download-gtfs.ts <source-name>');
  console.log('       npx tsx pipeline/scripts/download-gtfs.ts --targets <file>');
  console.log('       npx tsx pipeline/scripts/download-gtfs.ts --list\n');
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
    const names = listGtfsSourceNames();
    console.log('Available GTFS sources:\n');
    for (const name of names) {
      console.log(`  ${name}`);
    }
    return;
  }

  if (arg.kind === 'targets') {
    const sourceNames = await loadTargetFile(arg.path);
    console.log(`=== Batch download (${sourceNames.length} targets) ===\n`);
    const scriptPath = resolve(import.meta.dirname, 'download-gtfs.ts');
    const results = runBatch(scriptPath, sourceNames);
    printBatchSummary(results);
    const exitCode = determineBatchExitCode(results);
    console.log(`\n${formatExitCode(exitCode)}`);
    process.exitCode = exitCode;
    return;
  }

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

  const accessToken = process.env['ODPT_ACCESS_TOKEN'];
  const { outDir, prefix } = source.pipeline;
  const { downloadUrl, nameJa, nameEn, provider, license, authentication } = source.resource;

  const gtfsDir = join(GTFS_DATA_DIR, outDir);
  const archiveDir = join(ARCHIVES_DIR, 'gtfs', outDir);

  console.log(`=== ${arg.name} [START] ===\n`);
  console.log(`  Format: ${source.resource.dataFormat.type}`);
  console.log(`  Name: ${nameJa} (${nameEn})`);
  console.log(`  Provider: ${provider.name.ja.long}`);
  console.log(`  License: ${license.name}`);
  console.log(`  Output: ${outDir}/ (prefix: ${prefix})`);
  console.log('');

  const tmpDir = join(tmpdir(), `${outDir}-gtfs-${Date.now()}`);
  const zipFileName = downloadUrl.split('/').pop()!.split('?')[0];
  const zipPath = join(tmpDir, zipFileName);
  const downloadedAt = new Date().toISOString();
  const t0 = performance.now();

  try {
    ensureDir(tmpDir);

    // 1. Download ZIP with retry
    const url = buildAuthenticatedUrl(downloadUrl, authentication, accessToken, nameEn);
    console.log(`Downloading ${downloadUrl}`);
    const result = await downloadWithRetry(url, zipPath);
    console.log(`  Filename: ${zipFileName}`);
    console.log(`  Size: ${result.bytes.toLocaleString()} bytes`);
    console.log(`  Content-Type: ${result.contentType || '(not provided)'}`);
    console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

    // 2. Archive ZIP with timestamp
    const archivePath = archiveZip(zipPath, archiveDir, zipFileName);
    console.log(`  Archived: ${archivePath}`);

    // 3. Clean existing GTFS text files before extraction
    ensureDir(gtfsDir);
    const oldFiles = readdirSync(gtfsDir).filter((f) => f.endsWith('.txt'));
    for (const file of oldFiles) {
      rmSync(join(gtfsDir, file));
    }
    if (oldFiles.length > 0) {
      console.log(`\nRemoved ${oldFiles.length} existing GTFS file(s).`);
    }

    // 4. Extract ZIP
    console.log('\nExtracting ZIP...');
    const entries = extractZip(zipPath, gtfsDir);
    console.log(`Extracted ${entries.length} files to ${gtfsDir}`);
    const extractedFiles: ExtractedFileInfo[] = [];
    for (const entry of entries) {
      const size = statSync(join(gtfsDir, entry)).size;
      extractedFiles.push({ name: entry, size });
      console.log(`  ${entry.padEnd(24)} ${size.toLocaleString().padStart(10)} bytes`);
    }

    // 5. Parse feed_info.txt for metadata
    const feedInfo: FeedInfoMeta | null = parseFeedInfoTxt(gtfsDir);
    if (feedInfo) {
      console.log(`\nFeed info: ${feedInfo.publisherName} v${feedInfo.version}`);
      console.log(`  Period: ${feedInfo.startDate} - ${feedInfo.endDate}`);
    }

    // 6. Record download metadata
    const totalDurationMs = Math.round(performance.now() - t0);
    saveDownloadMeta({
      sourceName: arg.name,
      type: 'gtfs',
      status: 'ok',
      downloadedAt,
      url: downloadUrl,
      size: result.bytes,
      contentType: result.contentType || '',
      durationMs: totalDurationMs,
      archivePath: archivePath.replace(PIPELINE_ROOT + '/', ''),
      extractedFiles,
      ...(feedInfo ? { feedInfo } : {}),
    });
    console.log(`\nDownload metadata: state/download-meta/${arg.name}.json`);

    // GTFS content validation is handled by the build step, not the downloader.
  } catch (err) {
    const totalDurationMs = Math.round(performance.now() - t0);
    const errorMessage = redactTokens(err instanceof Error ? err.message : String(err));
    console.error(`\nFATAL: ${errorMessage}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${redactTokens(err.cause.message)}`);
    }
    saveDownloadMeta({
      sourceName: arg.name,
      type: 'gtfs',
      status: 'error',
      downloadedAt,
      url: downloadUrl,
      durationMs: totalDurationMs,
      error: errorMessage,
    });
    process.exitCode = 1;
  } finally {
    // Clean up temp directory
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nExit code: ${code} (${label})\n=== ${arg.name} [END] ===`);
  }
}

runMain(main);
