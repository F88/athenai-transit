#!/usr/bin/env -S npx tsx

/**
 * Copy pipeline build output to the public directory.
 *
 * Copies:
 *   pipeline/workspace/_build/data/    -> public/data/    (v1)
 *   pipeline/workspace/_build/data-v2/ -> public/data-v2/ (v2)
 *
 * Each directory is cleaned before copying to ensure a fresh state.
 * Missing source directories are skipped with a warning (not an error),
 * so partial pipeline runs are supported.
 *
 * Usage:
 *   npx tsx scripts/copy-pipeline-data.ts
 *   npm run data:sync
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');

interface SyncTarget {
  label: string;
  src: string;
  dest: string;
}

const TARGETS: SyncTarget[] = [
  {
    label: 'v1',
    src: join(PROJECT_ROOT, 'pipeline/workspace/_build/data'),
    dest: join(PROJECT_ROOT, 'public/data'),
  },
  {
    label: 'v2',
    src: join(PROJECT_ROOT, 'pipeline/workspace/_build/data-v2'),
    dest: join(PROJECT_ROOT, 'public/data-v2'),
  },
];

function syncTarget(target: SyncTarget): boolean {
  if (!existsSync(target.src)) {
    console.log(`  [${target.label}] Skipped: ${target.src} not found`);
    return false;
  }

  console.log(`  [${target.label}] ${target.src}`);
  console.log(`  [${target.label}] → ${target.dest}`);

  if (existsSync(target.dest)) {
    rmSync(target.dest, { recursive: true, force: true });
    console.log(`  [${target.label}] Cleaned existing ${target.dest}`);
  }

  cpSync(target.src, target.dest, { recursive: true });
  console.log(`  [${target.label}] Done`);
  return true;
}

function main(): void {
  console.log('=== Copy pipeline output to public/ ===\n');

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

main();
