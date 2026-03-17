#!/usr/bin/env -S npx tsx

/**
 * Check ODPT Members Portal for available GTFS resources.
 *
 * Fetches metadata from the ODPT Members Portal API and compares
 * with local resource definitions to identify updates.
 *
 * Usage:
 *   npx tsx pipeline/scripts/analysis/check-odpt-resources.ts              # all tracked sources
 *   npx tsx pipeline/scripts/analysis/check-odpt-resources.ts kanto-bus     # single source
 *   npx tsx pipeline/scripts/analysis/check-odpt-resources.ts --all         # all ODPT sources (including not tracked)
 *   npx tsx pipeline/scripts/analysis/check-odpt-resources.ts --list        # list tracked ODPT sources
 *   npx tsx pipeline/scripts/analysis/check-odpt-resources.ts --format tsv  # TSV output
 *
 * API: https://members-portal.odpt.org/api/v1/resources
 * Docs: https://developer.odpt.org/api_addendum
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { listGtfsSourceNames, loadGtfsSource } from '../../lib/load-gtfs-sources';
import { loadDownloadMeta } from '../../lib/download-meta';
import type { DownloadMeta, DownloadMetaSuccess } from '../../lib/download-meta';
import { ensureDir } from '../../lib/pipeline-utils';
import {
  detectWarnings,
  EXPIRING_SOON_DAYS,
  extractDateParam,
  extractUrlBase,
  getDaysUntilExpiry,
} from '../../lib/check-warnings';
import type { Warning, ResourceSnapshot } from '../../lib/check-warnings';

// ---------------------------------------------------------------------------
// ODPT Members Portal API types
// ---------------------------------------------------------------------------

interface OdptDataResource {
  explain_ja: string;
  explain_en: string;
  start_at: string;
  end_at: string | null;
  uploaded_at: string;
  url: string;
  feed_start_date: string;
  feed_end_date: string;
  is_feed_available_period: boolean;
}

interface OdptDataset {
  name_ja: string;
  name_en: string;
  format_type: string;
  dataresource: OdptDataResource[];
}

interface OdptOrganization {
  name_ja: string;
  name_en: string;
  label: string;
  datasets: OdptDataset[];
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

const MEMBERS_PORTAL_API = 'https://members-portal.odpt.org/api/v1/resources';

async function fetchOdptResources(format: string): Promise<OdptOrganization[]> {
  const url = `${MEMBERS_PORTAL_API}?format=${format}`;
  console.log(`Fetching ${url} ...\n`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Members Portal API`);
  }
  return (await res.json()) as OdptOrganization[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the latest resource by start_at for a dataset. */
function findLatestResource(resources: OdptDataResource[]): OdptDataResource | null {
  if (resources.length === 0) {
    return null;
  }
  return resources.reduce((latest, r) => (r.start_at > latest.start_at ? r : latest));
}

// ---------------------------------------------------------------------------
// Check result snapshot (for diff detection)
// ---------------------------------------------------------------------------

const SNAPSHOT_DIR = resolve(import.meta.dirname, '..', '..', 'state', 'check-result');

interface SnapshotFile extends ResourceSnapshot {
  sourceName: string;
  checkedAt: string;
}

function saveSnapshot(sourceName: string, resources: OdptDataResource[]): void {
  const newUrls = resources.map((r) => r.url).sort();

  // Only rewrite when resourceUrls actually changed to avoid
  // daily no-op commits from timestamp-only differences.
  const previous = loadSnapshot(sourceName);
  if (previous) {
    const prevSorted = [...previous.resourceUrls].sort();
    if (prevSorted.length === newUrls.length && prevSorted.every((url, i) => url === newUrls[i])) {
      return;
    }
  }

  ensureDir(SNAPSHOT_DIR);
  const snapshot: SnapshotFile = {
    sourceName,
    checkedAt: new Date().toISOString(),
    resourceUrls: newUrls,
  };
  writeFileSync(
    join(SNAPSHOT_DIR, `${sourceName}.json`),
    JSON.stringify(snapshot, null, 2) + '\n',
    'utf-8',
  );
}

function loadSnapshot(sourceName: string): ResourceSnapshot | null {
  const filePath = join(SNAPSHOT_DIR, `${sourceName}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as SnapshotFile;
  } catch {
    console.warn(`[loadSnapshot] Failed to parse ${sourceName}.json, treating as empty`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local source lookup
// ---------------------------------------------------------------------------

interface LocalSourceInfo {
  /** Resource definition file name (e.g. "kanto-bus"). */
  name: string;
  /** Download URL base path from resource definition (without query). */
  urlBase: string;
  /** Download metadata from last successful download job, if available. */
  downloadMeta: DownloadMetaSuccess | null;
  /** Raw download metadata including errors, for displaying last download status. */
  rawMeta: DownloadMeta | null;
}

async function loadTrackedSources(): Promise<LocalSourceInfo[]> {
  const names = listGtfsSourceNames();
  const sources: LocalSourceInfo[] = [];
  for (const name of names) {
    const src = await loadGtfsSource(name);
    if (src.resource.catalog.type !== 'odpt') {
      continue;
    }
    const meta = loadDownloadMeta(name);
    sources.push({
      name,
      urlBase: extractUrlBase(src.resource.downloadUrl),
      downloadMeta: meta && meta.status === 'ok' ? meta : null,
      rawMeta: meta,
    });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  mode: 'all-tracked' | 'all-odpt' | 'single' | 'list';
  sourceName?: string;
  isTsv: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse --format flag and its value
  let isTsv = false;
  const formatIdx = args.indexOf('--format');
  if (formatIdx >= 0) {
    const formatValue = args[formatIdx + 1];
    if (formatValue === 'tsv') {
      isTsv = true;
    } else {
      console.error(`Unknown format: ${formatValue ?? '(missing)'}`);
      process.exit(1);
    }
  }

  if (args.includes('--list')) {
    return { mode: 'list', isTsv: false };
  }
  if (args.includes('--all')) {
    return { mode: 'all-odpt', isTsv };
  }

  // Collect flags and their values to exclude from positional args
  const flagsWithValues = new Set(['--format']);
  const skipIndices = new Set<number>();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      skipIndices.add(i);
      if (flagsWithValues.has(args[i]) && i + 1 < args.length) {
        skipIndices.add(i + 1);
      }
    }
  }

  // Find source name (first positional arg)
  const sourceName = args.find((_, i) => !skipIndices.has(i));
  if (sourceName) {
    return { mode: 'single', sourceName, isTsv };
  }

  return { mode: 'all-tracked', isTsv };
}

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/analysis/check-odpt-resources.ts [options] [source-name]',
  );
  console.log('');
  console.log('Options:');
  console.log('  <source-name>   Check a single source (e.g. kanto-bus, keio-bus)');
  console.log('  --all           Show all ODPT sources (including not tracked)');
  console.log('  --list          List tracked ODPT sources');
  console.log('  --format tsv    Output in TSV format');
  console.log('  --help          Show this help message');
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Warning types that require immediate action (exit code 1). */
const CRITICAL_WARNINGS = new Set(['EXPIRED', 'REMOVED', 'NO_VALID_DATA']);

function printResult(
  org: OdptOrganization,
  ds: OdptDataset,
  local: LocalSourceInfo | undefined,
  isTsv: boolean,
  previousSnapshot: ResourceSnapshot | null,
): Warning[] {
  const isTracked = !!local;
  const meta = local?.downloadMeta ?? null;

  // Detect warnings regardless of output mode (needed for exit code)
  const warnings = isTracked
    ? detectWarnings(ds.dataresource, { downloadMeta: meta }, previousSnapshot)
    : [];

  if (isTsv) {
    const latest = findLatestResource(ds.dataresource);
    const latestDate = latest ? (extractDateParam(latest.url) ?? '') : '';
    console.log(
      [
        org.name_ja,
        org.label,
        ds.name_ja,
        local?.name ?? '',
        meta?.downloadedAt ?? '',
        meta?.feedInfo?.startDate ?? '',
        meta?.feedInfo?.endDate ?? '',
        latestDate,
        latest?.feed_start_date ?? '',
        latest?.feed_end_date ?? '',
        latest?.is_feed_available_period ?? '',
        latest?.uploaded_at ?? '',
      ].join('\t'),
    );

    if (isTracked && local) {
      saveSnapshot(local.name, ds.dataresource);
    }
    return warnings;
  }

  const tracked = isTracked ? local.name : 'not-tracked';
  console.log(`=== ${tracked} [CHECK] ===`);
  console.log(`  Organization: ${org.name_ja} (${org.label})`);
  console.log(`  Dataset:      ${ds.name_ja}`);

  // Local info from download metadata
  if (meta) {
    const localUrl = meta.url;
    const localDate = extractDateParam(localUrl) ?? '(no date param)';
    console.log(`  Local:      date=${localDate} downloaded=${meta.downloadedAt}`);
    if (meta.feedInfo) {
      console.log(
        `  Local feed: ${meta.feedInfo.startDate} - ${meta.feedInfo.endDate} ver=${meta.feedInfo.version}`,
      );
    }
  } else if (isTracked) {
    const raw = local.rawMeta;
    if (raw && raw.status === 'error') {
      console.log(`  Local:      LAST DOWNLOAD FAILED (${raw.downloadedAt})`);
      console.log(`  Error:      ${raw.error}`);
    } else {
      console.log(`  Local:      (no download metadata)`);
    }
  }

  // Warnings (already computed above before TSV branch)
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.log(`  *** ${w.type}: ${w.message}`);
    }
  }

  // Remote resources (sorted by start_at descending — newest first)
  const resources = [...ds.dataresource].sort((a, b) => b.start_at.localeCompare(a.start_at));
  const validCount = resources.filter((r) => r.is_feed_available_period).length;
  console.log(
    `  Remote:     ${resources.length} resources, ${validCount} currently valid (sorted by start_at desc)`,
  );

  const newUrls = new Set(
    warnings
      .filter((w): w is Warning & { type: 'NEW_RESOURCE' } => w.type === 'NEW_RESOURCE')
      .flatMap((w) => w.urls),
  );

  for (const r of resources) {
    const date = extractDateParam(r.url) ?? '';
    const avail = r.is_feed_available_period ? 'VALID' : 'expired';
    const isCurrent =
      meta &&
      extractUrlBase(r.url) === extractUrlBase(meta.url) &&
      date === (extractDateParam(meta.url) ?? '');
    const localMarker = isCurrent ? ' <-- LOCAL' : '';
    const newMarker = newUrls.has(r.url) ? ' [NEW]' : '';
    console.log(
      `    date=${date}  feed=${r.feed_start_date} - ${r.feed_end_date}  ${avail}  uploaded=${r.uploaded_at}${localMarker}${newMarker}`,
    );
  }

  // Save snapshot for next diff (tracked sources only)
  if (isTracked && local) {
    saveSnapshot(local.name, ds.dataresource);
  }

  console.log(`=== ${tracked} [END] ===\n`);
  return warnings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cli = parseArgs();

  // --list: show tracked ODPT sources and exit
  if (cli.mode === 'list') {
    const tracked = await loadTrackedSources();
    console.log('Tracked ODPT sources:\n');
    for (const src of tracked) {
      const meta = src.downloadMeta;
      const date = meta ? (extractDateParam(meta.url) ?? '') : '(no meta)';
      const dl = meta ? meta.downloadedAt : '';
      console.log(`  ${src.name.padEnd(16)} date=${date.padEnd(10)} downloaded=${dl}`);
    }
    return;
  }

  // Load local sources and build URL base lookup
  const tracked = await loadTrackedSources();
  const localByUrlBase = new Map<string, LocalSourceInfo>();
  for (const src of tracked) {
    localByUrlBase.set(src.urlBase, src);
  }

  // Validate source name for single mode
  if (cli.mode === 'single') {
    const found = tracked.find((s) => s.name === cli.sourceName);
    if (!found) {
      console.error(`Error: "${cli.sourceName}" is not a tracked ODPT source.`);
      console.error('Use --list to see tracked sources, or --all to show all ODPT sources.');
      process.exitCode = 1;
      return;
    }
  }

  // Fetch all ODPT resources (single API call)
  const orgs = await fetchOdptResources('gtfs');

  if (cli.isTsv) {
    console.log(
      [
        'organization',
        'org_label',
        'dataset',
        'local_name',
        'downloaded_at',
        'local_feed_start',
        'local_feed_end',
        'latest_date',
        'remote_feed_start',
        'remote_feed_end',
        'available',
        'uploaded',
      ].join('\t'),
    );
  }

  const allWarnings: Warning[] = [];
  const matchedSources = new Set<string>();

  for (const org of orgs) {
    for (const ds of org.datasets) {
      if (ds.dataresource.length === 0) {
        continue;
      }

      // Match any resource URL base against local sources
      let local: LocalSourceInfo | undefined;
      for (const r of ds.dataresource) {
        const base = extractUrlBase(r.url);
        local = localByUrlBase.get(base);
        if (local) {
          break;
        }
      }

      // Filter based on mode
      if (cli.mode === 'all-tracked' && !local) {
        continue;
      }
      if (cli.mode === 'single' && local?.name !== cli.sourceName) {
        continue;
      }

      if (local) {
        matchedSources.add(local.name);
      }

      const previousSnapshot = local ? loadSnapshot(local.name) : null;
      const warnings = printResult(org, ds, local, cli.isTsv, previousSnapshot);
      allWarnings.push(...warnings);
    }
  }

  // Check tracked sources not found in Members Portal API
  // (e.g. toei-bus, toei-train — published via different channels)
  if (cli.mode !== 'all-odpt') {
    for (const src of tracked) {
      if (matchedSources.has(src.name)) {
        continue;
      }
      if (cli.mode === 'single' && src.name !== cli.sourceName) {
        continue;
      }

      console.log(`=== ${src.name} [CHECK] ===`);
      console.log('  Not available in Members Portal API');

      const meta = src.downloadMeta;
      if (meta) {
        const localDate = extractDateParam(meta.url) ?? '(no date param)';
        console.log(`  Local:      date=${localDate} downloaded=${meta.downloadedAt}`);
        if (meta.feedInfo) {
          console.log(
            `  Local feed: ${meta.feedInfo.startDate} - ${meta.feedInfo.endDate} ver=${meta.feedInfo.version}`,
          );
        }
        // Check expiring soon from local metadata only.
        // Do NOT call detectWarnings with empty resources — it would
        // incorrectly emit REMOVED and NO_VALID_DATA for sources that
        // are simply not available in the Members Portal API.
        if (meta.feedInfo?.endDate) {
          const endStr = meta.feedInfo.endDate;
          const daysLeft = getDaysUntilExpiry(endStr);
          if (daysLeft < 0) {
            const w: Warning = { type: 'EXPIRED', message: `Local data expired (${endStr})` };
            console.log(`  *** ${w.type}: ${w.message}`);
            allWarnings.push(w);
          } else if (daysLeft <= EXPIRING_SOON_DAYS) {
            const w: Warning = {
              type: 'EXPIRING_SOON',
              message: `Local data expires in ${daysLeft} days (${endStr})`,
              daysLeft,
            };
            console.log(`  *** ${w.type}: ${w.message}`);
            allWarnings.push(w);
          }
        }
      } else {
        const raw = src.rawMeta;
        if (raw && raw.status === 'error') {
          console.log(`  Local:      LAST DOWNLOAD FAILED (${raw.downloadedAt})`);
          console.log(`  Error:      ${raw.error}`);
        } else {
          console.log('  Local:      (no download metadata)');
        }
        allWarnings.push({
          type: 'NO_DOWNLOAD_REPORT',
          message: `No download report for ${src.name}`,
        });
        console.log(`  *** NO_DOWNLOAD_REPORT: No download report — run download first`);
      }

      // Save empty snapshot (no remote resources, but record that we checked)
      saveSnapshot(src.name, []);

      console.log(`=== ${src.name} [END] ===\n`);
    }
  }

  // Exit code: 0 = ok, 1 = critical warnings, 2 = attention warnings
  const hasCritical = allWarnings.some((w) => CRITICAL_WARNINGS.has(w.type));
  const hasWarnings = allWarnings.length > 0;

  const exitCode = hasCritical ? 1 : hasWarnings ? 2 : 0;
  const label = exitCode === 0 ? 'ok' : exitCode === 1 ? 'critical' : 'attention';
  console.log(`\nExit code: ${exitCode} (${label})`);
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
  console.error('\nExit code: 1 (error)');
  process.exitCode = 1;
});
