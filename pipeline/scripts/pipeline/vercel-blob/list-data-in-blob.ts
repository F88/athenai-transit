#!/usr/bin/env -S npx tsx

/**
 * List data files in Vercel Blob (read-only).
 *
 * Lists blob keys and sizes in the store. With no filter it lists the whole
 * store; `--source <name>` or `--prefix <path>` narrows it. Read-only: this
 * never uploads or deletes.
 *
 * Requires `VERCEL_V3_BLOB_READ_WRITE_TOKEN`.
 *
 * Exit codes: 0 = ok (including help), 1 = error / bad usage.
 */

import { parseArgs } from 'node:util';

import { list } from '@vercel/blob';

import {
  blobStoreIdFromToken,
  formatErrorRedacted,
  listArgsSchema,
  resolveListPrefix,
} from './blob-lib';

const HELP = `List data files in Vercel Blob (read-only).

Usage:
  npm run vercel:blob:list -- [--source <name> | --prefix <path>]

Filter (optional; omit to list the entire store):
  --source <name>    List keys under <name>/ (e.g. --source kotr)
  --prefix <path>    List keys under an arbitrary (non-empty) prefix

Options:
  --help, -h         Show this help

Environment:
  VERCEL_V3_BLOB_READ_WRITE_TOKEN   Blob read-write token (required)

Exit codes: 0 = ok (including help), 1 = error / bad usage.`;

interface BlobInfo {
  pathname: string;
  size: number;
  uploadedAt: Date;
  etag: string;
}

/** List every blob under `prefix` (all blobs when `prefix` is undefined). */
async function listAll(prefix: string | undefined, token: string): Promise<BlobInfo[]> {
  const out: BlobInfo[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor, limit: 1000, token });
    for (const blob of res.blobs) {
      out.push({
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        etag: blob.etag,
      });
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

function parseList() {
  return parseArgs({
    options: {
      source: { type: 'string' },
      prefix: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  }).values;
}

async function main(): Promise<void> {
  // Read-only: no args lists the whole store; --help shows help.
  let raw: ReturnType<typeof parseList>;
  try {
    raw = parseList();
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

  const parsed = listArgsSchema.safeParse({ source: raw.source, prefix: raw.prefix });
  if (!parsed.success) {
    console.error(`Error: ${parsed.error.issues.map((i) => i.message).join('; ')}\n`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  const token = process.env['VERCEL_V3_BLOB_READ_WRITE_TOKEN'];
  if (!token) {
    console.error('Error: VERCEL_V3_BLOB_READ_WRITE_TOKEN environment variable is required.');
    process.exitCode = 1;
    return;
  }

  console.log(`Target Blob store (inferred from token): ${blobStoreIdFromToken(token)}`);
  const { prefix, label } = resolveListPrefix(parsed.data);
  const blobs = await listAll(prefix, token);
  if (blobs.length === 0) {
    console.log(`No blobs found ${label}.`);
    return;
  }

  blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  let totalBytes = 0;
  for (const blob of blobs) {
    totalBytes += blob.size;
    console.log(
      `  ${blob.pathname.padEnd(40)} ${String(blob.size).padStart(10)} ${blob.uploadedAt.toISOString()} ${blob.etag}`,
    );
  }
  console.log(`\n${blobs.length} blob(s), ${totalBytes} bytes total ${label}.`);
}

main()
  .catch((err: unknown) => {
    console.error(formatErrorRedacted(err));
    process.exitCode = 1;
  })
  .finally(() => {
    // Always print the resolved exit code on the final line (every path).
    // list is read-only: 0 = ok, 1 = error / bad usage (no partial state).
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nExit code: ${code} (${label})`);
  });
