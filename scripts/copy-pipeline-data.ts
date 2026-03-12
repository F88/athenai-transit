#!/usr/bin/env -S npx tsx

/**
 * Copy pipeline build output to the public directory.
 *
 * Copies pipeline/build/data/ -> public/data/ so that the Vite dev server
 * and production builds can serve the generated JSON files.
 *
 * Usage:
 *   npx tsx scripts/copy-pipeline-data.ts
 *   npm run data:sync
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const SRC_DIR = join(PROJECT_ROOT, 'pipeline/build/data');
const DEST_DIR = join(PROJECT_ROOT, 'public/data');

function main(): void {
  console.log('=== Copy pipeline output to public/ ===\n');

  if (!existsSync(SRC_DIR)) {
    console.error(`Error: Source directory not found: ${SRC_DIR}`);
    console.error('Run pipeline:build:json and pipeline:build:train-shapes first.');
    process.exitCode = 1;
    return;
  }

  console.log(`  From: ${SRC_DIR}`);
  console.log(`  To:   ${DEST_DIR}`);

  if (existsSync(DEST_DIR)) {
    rmSync(DEST_DIR, { recursive: true });
    console.log('  Cleaned existing public/data/');
  }

  cpSync(SRC_DIR, DEST_DIR, { recursive: true });

  console.log('\nDone!');
}

main();
