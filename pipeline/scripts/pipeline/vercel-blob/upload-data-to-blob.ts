#!/usr/bin/env -S npx tsx

/**
 * Upload built v2 data files to Vercel Blob.
 *
 * Uploads every `.json` file under `--dir` to a Vercel Blob store, keyed by its
 * path relative to that directory (no prefix, e.g. `85b/data.json`). This
 * matches the `vercel.json` rewrite `destination: <store>/:path*`, so the app
 * can fetch the data via a same-origin `/data-v3/*` route that proxies to the
 * store.
 *
 * Requires `--dir` (constrained to inside the pipeline build output dir,
 * `pipeline/workspace/_build`) and exactly one target: `--source <name>`
 * (repeatable) or `--all`. The upload source is the build output, e.g.
 * `pipeline/workspace/_build/data-v2`. Uploads are additive/overwriting only --
 * this script never deletes (see
 * `delete-data-from-blob.ts`). Cache-Control is NOT set here: it is controlled
 * centrally by `vercel.json`, which overrides the proxied Blob response.
 *
 * Requires `VERCEL_V3_BLOB_READ_WRITE_TOKEN` (except for `--dry-run`).
 *
 * Exit codes: 0 = all uploaded (or dry run / help), 1 = partial failure or
 * other error (unmatched --source, bad usage, no files, missing token),
 * 2 = all failed.
 */

import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { put } from '@vercel/blob';

import { BUILD_DIR } from '../../../src/lib/paths';
import {
  MAX_CONCURRENCY,
  blobStoreIdFromToken,
  deriveBlobKey,
  formatErrorRedacted,
  isPathInside,
  redactBlobTokens,
  uploadArgsSchema,
} from './blob-lib';

const HELP = `Upload built v2 data files to Vercel Blob.

Usage:
  npm run vercel:blob:upload -- --dir <path> (--source <name>... | --all) [options]

Required:
  --dir <path>              Base directory to upload from (must be inside the build
                            output dir, e.g. pipeline/workspace/_build/data-v2)
  --source <name> | --all   Upload the given source(s), or every source under --dir.
                            --source is repeatable (e.g. --source a --source b).

Options:
  --concurrency <n>  Concurrent uploads, 1-${MAX_CONCURRENCY} (default: ${MAX_CONCURRENCY})
  --dry-run          List files + keys that would be uploaded; upload nothing (no token needed)
  --help, -h         Show this help

Environment:
  VERCEL_V3_BLOB_READ_WRITE_TOKEN   Blob read-write token (required unless --dry-run)

Exit codes: 0 = all uploaded (or dry run / help), 1 = partial failure or other error, 2 = all failed.`;

/** Recursively collect `.json` files under `dir`, never following symlinks. */
function collectJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue; // never follow symlinks (defence against escaping the dir)
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/** Run `worker` over `items` with at most `limit` in flight at once. */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function parseUpload() {
  return parseArgs({
    options: {
      dir: { type: 'string' },
      source: { type: 'string', multiple: true },
      all: { type: 'boolean' },
      concurrency: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  }).values;
}

/**
 * Resolve `dir` to a real path and require it to be inside the pipeline build
 * output dir (`pipeline/workspace/_build`). Returns the resolved real path, or
 * `null` if it does not exist or escapes.
 */
function resolveDirWithinBuild(dir: string): string | null {
  try {
    const realDir = realpathSync(resolve(dir));
    const realRoot = realpathSync(BUILD_DIR);
    return isPathInside(realRoot, realDir) ? realDir : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  // No args -> show help (exit 0). Common CLI behaviour.
  if (process.argv.slice(2).length === 0) {
    console.log(HELP);
    return;
  }

  let raw: ReturnType<typeof parseUpload>;
  try {
    raw = parseUpload();
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  if (raw.help) {
    console.log(HELP);
    return;
  }

  const parsed = uploadArgsSchema.safeParse({
    dir: raw.dir,
    source: raw.source,
    all: raw.all,
    concurrency: raw.concurrency,
    dryRun: raw['dry-run'],
  });
  if (!parsed.success) {
    console.error(`Error: ${parsed.error.issues.map((i) => i.message).join('; ')}\n`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }
  const { dir, source, concurrency, dryRun } = parsed.data;

  const realDir = resolveDirWithinBuild(dir);
  if (realDir === null) {
    console.error(
      `Error: --dir must be an existing directory inside pipeline/workspace/_build: ${dir}`,
    );
    process.exitCode = 1;
    return;
  }

  let files = collectJsonFiles(realDir);
  let unmatchedSources: string[] = [];
  if (source !== undefined) {
    const wanted = new Set(source);
    files = files.filter((f) => wanted.has(deriveBlobKey(realDir, f).split('/')[0]));
    // Record requested sources that matched nothing so we can warn (after the
    // target-store line) and exit non-zero, rather than silently dropping them
    // when other sources did match.
    const matched = new Set(files.map((f) => deriveBlobKey(realDir, f).split('/')[0]));
    unmatchedSources = source.filter((name) => !matched.has(name));
  }

  if (files.length === 0) {
    const forSources = source ? ` for source(s) "${source.join(', ')}"` : '';
    console.error(`No .json files found under ${dir}${forSources}.`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    for (const name of unmatchedSources) {
      console.warn(`Warning: source "${name}" matched no files under ${dir}.`);
    }
    console.log(`[dry-run] ${files.length} file(s) from ${dir} would be uploaded:\n`);
    let totalBytes = 0;
    for (const file of files) {
      const size = statSync(file).size;
      totalBytes += size;
      console.log(
        `  ${deriveBlobKey(realDir, file).padEnd(40)} ${(size / 1024).toFixed(0).padStart(6)} KB`,
      );
    }
    const unmatchedNote =
      unmatchedSources.length > 0 ? `, ${unmatchedSources.length} source(s) not found` : '';
    console.log(
      `\n[dry-run] total ${files.length} file(s), ${(totalBytes / 1048576).toFixed(1)} MB${unmatchedNote}. Nothing uploaded.`,
    );
    if (unmatchedSources.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const token = process.env['VERCEL_V3_BLOB_READ_WRITE_TOKEN'];
  if (!token) {
    console.error('Error: VERCEL_V3_BLOB_READ_WRITE_TOKEN environment variable is required.');
    process.exitCode = 1;
    return;
  }

  console.log(`Target Blob store (inferred from token): ${blobStoreIdFromToken(token)}`);
  for (const name of unmatchedSources) {
    console.warn(`Warning: source "${name}" matched no files under ${dir}.`);
  }
  console.log(`Uploading ${files.length} file(s) from ${dir} (concurrency ${concurrency})...\n`);

  let ok = 0;
  let failed = 0;
  await runPool(files, concurrency, async (file) => {
    const key = deriveBlobKey(realDir, file);
    try {
      const body = readFileSync(file);
      const { url } = await put(key, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token,
      });
      ok++;
      console.log(
        `  ok  ${key.padEnd(40)} ${(body.byteLength / 1024).toFixed(0).padStart(6)} KB -> ${url}`,
      );
    } catch (err) {
      failed++;
      console.error(
        `  ERR ${key}: ${redactBlobTokens(err instanceof Error ? err.message : String(err))}`,
      );
    }
  });

  const unmatchedNote =
    unmatchedSources.length > 0 ? `, ${unmatchedSources.length} source(s) not found` : '';
  console.log(`\nDone: ${ok} uploaded, ${failed} failed${unmatchedNote}.`);

  // Exit-code contract (matches the pipeline convention): 0 ok, 1 partial
  // (some uploads failed, or a requested --source matched no files), 2 all failed.
  if (ok === 0 && failed > 0) {
    process.exitCode = 2;
  } else if (failed > 0 || unmatchedSources.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err: unknown) => {
    console.error(formatErrorRedacted(err));
    process.exitCode = 2;
  })
  .finally(() => {
    // Always print the resolved exit code on the final line (every path,
    // including early returns and errors), matching the other pipeline scripts.
    // Code 1 groups partial upload failure, an unmatched --source, and
    // usage/precondition errors, hence "partial failure or other error".
    const code = process.exitCode ?? 0;
    let label = 'ok';
    if (code === 2) {
      label = 'all failed';
    } else if (code === 1) {
      label = 'partial failure or other error';
    }
    console.log(`\nExit code: ${code} (${label})`);
  });
