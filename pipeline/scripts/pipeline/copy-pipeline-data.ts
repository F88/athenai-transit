#!/usr/bin/env -S npx tsx

/**
 * Copy pipeline build output to the public directory.
 *
 * Copies:
 *   pipeline/workspace/_build/data-v2/ -> public/data-v2/
 *
 * Each directory is cleaned before copying to ensure a fresh state.
 * Missing source directories are skipped with a notice (not an error),
 * so partial pipeline runs are supported.
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/copy-pipeline-data.ts
 *   npm run pipeline:deliver:local
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sanitizeDirName } from './lib/file-utils';

// Repo root: three levels up from pipeline/scripts/pipeline/.
const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');

interface SyncTarget {
  label: string;
  src: string;
  dest: string;
}

export const TRANSIT_DATA_DELIVERY_BASE_DIR = 'public';
// export const TRANSIT_DATA_DELIVERY_BASE_DIR = '__AT_DATA__';

const DEFAULT_PIPELINE_TRANSIT_DATA_DIR = 'data-v2';

/**
 * Resolve the destination directory for transit data sync.
 *
 * This is the transit data delivery directory: where the web app fetches
 * its data from. Locally it lives under `TRANSIT_DATA_DELIVERY_BASE_DIR/`; in production the same
 * data is delivered from Vercel Blob. Reads `PIPELINE_TRANSIT_DATA_DIR`
 * env var; defaults to `data-v2`. Always under `TRANSIT_DATA_DELIVERY_BASE_DIR/`.
 */
export function resolveDestDir(env: Record<string, string | undefined> = process.env): string {
  const dir = sanitizeDirName(
    env.PIPELINE_TRANSIT_DATA_DIR ?? DEFAULT_PIPELINE_TRANSIT_DATA_DIR,
    'PIPELINE_TRANSIT_DATA_DIR',
  );
  return TRANSIT_DATA_DELIVERY_BASE_DIR + '/' + dir;
}

const TARGETS: SyncTarget[] = [
  {
    label: 'v2',
    src: join(PROJECT_ROOT, 'pipeline/workspace/_build/data-v2'),
    dest: join(PROJECT_ROOT, resolveDestDir()),
  },
];

function syncTarget(target: SyncTarget): boolean {
  const relSrc = target.src.substring(PROJECT_ROOT.length + 1);
  const relDest = target.dest.substring(PROJECT_ROOT.length + 1);

  if (!existsSync(target.src)) {
    console.log(`  [${target.label}] Skipped: ${relSrc} not found`);
    return false;
  }

  console.log(`  [${target.label}] ${relSrc}`);
  console.log(`  [${target.label}] → ${relDest}`);

  if (existsSync(target.dest)) {
    rmSync(target.dest, { recursive: true, force: true });
    console.log(`  [${target.label}] Cleaned existing ${relDest}`);
  }

  cpSync(target.src, target.dest, { recursive: true });
  console.log(`  [${target.label}] Done`);
  return true;
}

function main(): void {
  console.log(`=== Copy pipeline output to ${TRANSIT_DATA_DELIVERY_BASE_DIR}/ ===\n`);

  let synced = 0;
  for (const target of TARGETS) {
    if (syncTarget(target)) {
      synced++;
    }
    console.log('');
  }

  if (synced === 0) {
    console.error('Error: No source directories found. Run pipeline build steps first.');
    process.exitCode = 1;
    return;
  }

  console.log(`Done! (${synced}/${TARGETS.length} targets synced)`);
}

// Only run when executed directly (not when imported by other modules).
// Same pattern as pipeline/scripts/pipeline/check-odpt-resources.ts.
function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  main();
}
