#!/usr/bin/env -S npx tsx

/**
 * Delete data files from Vercel Blob (targeted, explicit).
 *
 * Deletes blobs by source directory or arbitrary key prefix. Intended for
 * removing data that must not remain published -- e.g. a data source whose
 * provider-set usage period has ended (a license deletion obligation).
 * Companion to `upload-data-to-blob.ts`, which never deletes.
 *
 * SAFE BY DEFAULT: without `--yes` this is a dry run (lists what would be
 * deleted, deletes nothing). Requires exactly one target (`--source <name>` or
 * a non-empty `--prefix <path>`). There is intentionally no "delete
 * everything" option.
 *
 * Requires `VERCEL_V3_BLOB_READ_WRITE_TOKEN`.
 *
 * Exit codes: 0 = ok (dry run / help / all deleted), 1 = partial failure or
 * other error (bad usage, missing token), 2 = all deletes failed.
 */

import { parseArgs } from 'node:util';

import { del, list } from '@vercel/blob';

import {
  blobStoreIdFromToken,
  deleteArgsSchema,
  formatErrorRedacted,
  redactBlobTokens,
  resolveDeleteTarget,
} from './blob-lib';

const DELETE_CHUNK_SIZE = 100;

const HELP = `Delete data files from Vercel Blob (targeted, explicit).

Safe by default: without --yes this is a dry run (lists matches, deletes nothing).
There is no "delete everything" option.

Usage:
  npm run vercel:blob:delete -- (--source <name> | --prefix <path>) [--yes]

Target (exactly one required):
  --source <name>    Delete keys under <name>/ (e.g. --source kotr)
  --prefix <path>    Delete keys under an arbitrary (non-empty) prefix

Options:
  --yes              Actually delete (without it: dry run)
  --help, -h         Show this help

Environment:
  VERCEL_V3_BLOB_READ_WRITE_TOKEN   Blob read-write token (required)

Exit codes: 0 = ok (dry run / help / all deleted), 1 = partial failure or other error, 2 = all failed.`;

/** List every blob under `prefix`. */
async function listAll(
  prefix: string,
  token: string,
): Promise<{ pathname: string; url: string }[]> {
  const out: { pathname: string; url: string }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor, limit: 1000, token });
    for (const blob of res.blobs) {
      out.push({ pathname: blob.pathname, url: blob.url });
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

function parseDelete() {
  return parseArgs({
    options: {
      source: { type: 'string' },
      prefix: { type: 'string' },
      yes: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  }).values;
}

async function main(): Promise<void> {
  // No args -> show help (exit 0). Common CLI behaviour.
  if (process.argv.slice(2).length === 0) {
    console.log(HELP);
    return;
  }

  let raw: ReturnType<typeof parseDelete>;
  try {
    raw = parseDelete();
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

  const parsed = deleteArgsSchema.safeParse({
    source: raw.source,
    prefix: raw.prefix,
    yes: raw.yes,
  });
  if (!parsed.success) {
    console.error(`Error: ${parsed.error.issues.map((i) => i.message).join('; ')}\n`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }
  const args = parsed.data;

  const token = process.env['VERCEL_V3_BLOB_READ_WRITE_TOKEN'];
  if (!token) {
    console.error('Error: VERCEL_V3_BLOB_READ_WRITE_TOKEN environment variable is required.');
    process.exitCode = 1;
    return;
  }

  console.log(`Target Blob store (inferred from token): ${blobStoreIdFromToken(token)}`);
  const { prefix, label } = resolveDeleteTarget(args);
  const blobs = await listAll(prefix, token);
  if (blobs.length === 0) {
    console.log(`No blobs found for ${label}. Nothing to delete.`);
    return;
  }

  console.log(`${blobs.length} blob(s) match ${label}:`);
  for (const blob of blobs) {
    console.log(`  ${blob.pathname}`);
  }

  if (!args.yes) {
    console.log('\nDry run (no --yes): nothing deleted. Re-run with --yes to delete.');
    return;
  }

  console.log(`\nDeleting ${blobs.length} blob(s)...`);
  const urls = blobs.map((blob) => blob.url);
  let deleted = 0;
  let failed = 0;
  // del() is atomic per call, so a failing chunk fails all its urls together;
  // the chunk size is therefore the finest failure granularity available.
  for (let i = 0; i < urls.length; i += DELETE_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + DELETE_CHUNK_SIZE);
    try {
      await del(chunk, { token });
      deleted += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error(
        `  ERR deleting ${chunk.length} blob(s): ${redactBlobTokens(
          err instanceof Error ? err.message : String(err),
        )}`,
      );
    }
  }
  console.log(`Deleted ${deleted} blob(s), ${failed} failed.`);

  // Exit-code contract (matches upload): 0 all deleted, 1 partial, 2 all failed.
  if (deleted === 0 && failed > 0) {
    process.exitCode = 2;
  } else if (failed > 0) {
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
    // Code 1 groups partial delete failure and usage/precondition errors,
    // hence "partial failure or other error".
    const code = process.exitCode ?? 0;
    let label = 'ok';
    if (code === 2) {
      label = 'all failed';
    } else if (code === 1) {
      label = 'partial failure or other error';
    }
    console.log(`\nExit code: ${code} (${label})`);
  });
