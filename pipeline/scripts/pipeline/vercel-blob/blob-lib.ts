/**
 * Pure helpers for the Vercel Blob upload / delete scripts:
 * Blob key derivation, path containment, and CLI argument schemas (zod).
 *
 * Kept free of `fs` / network so it can be unit-tested.
 */

import { isAbsolute, relative } from 'node:path';

import { z } from 'zod';

export const MAX_CONCURRENCY = 10;

/** A single directory-name segment (no path separators). */
const SEGMENT = /^[^/\\]+$/;

/**
 * Derive a Blob object key from a file path.
 *
 * The key is `filePath` relative to `baseDir`, with POSIX separators and no
 * leading directory prefix (e.g. `85b/data.json`). This matches the
 * `vercel.json` rewrite `destination: <store>/:path*`.
 */
export function deriveBlobKey(baseDir: string, filePath: string): string {
  return relative(baseDir, filePath).split(/[\\/]/).join('/');
}

/**
 * Whether `target` is `base` itself or a path nested inside `base`.
 *
 * Both paths should be absolute (ideally realpath-resolved) for a reliable
 * containment check that resists `..` traversal and symlink escapes.
 */
export function isPathInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Best-effort, INFERRED store id parsed from a Vercel Blob read-write token
 * (`vercel_blob_rw_<storeId>_<secret>`), for display so the operator can see
 * which store is being targeted.
 *
 * This relies on the token's undocumented format and will break if Vercel
 * changes it, so the result is an estimate, not an authoritative id (the SDK
 * exposes no store-metadata API). Callers should present it as inferred. The
 * secret is never returned; `(unknown)` is returned for an unexpected format.
 */
export function blobStoreIdFromToken(token: string): string {
  const match = /^vercel_blob_rw_([^_]+)_/.exec(token);
  return match ? match[1] : '(unknown)';
}

/**
 * Redact any Vercel Blob read-write token (`vercel_blob_rw_<storeId>_<secret>`)
 * found in `text`, so a token can never leak into logs or error output. The
 * whole token run (store id and secret) is replaced with a fixed marker.
 */
export function redactBlobTokens(text: string): string {
  return text.replace(/vercel_blob_rw_[A-Za-z0-9_-]+/g, 'vercel_blob_rw_[REDACTED]');
}

/** Format an unknown thrown value as a redacted, single-string message. */
export function formatErrorRedacted(err: unknown): string {
  const raw = err instanceof Error ? (err.stack ?? err.message) : String(err);
  return redactBlobTokens(raw);
}

// ---------------------------------------------------------------------------
// upload args
// ---------------------------------------------------------------------------

/**
 * Requires exactly one target: one or more `--source <name>` (repeatable) or
 * `--all`.
 */
export const uploadArgsSchema = z
  .object({
    dir: z.string(),
    source: z
      .array(z.string().regex(SEGMENT, 'source must be a single directory name (no slashes)'))
      .optional(),
    all: z.boolean().default(false),
    concurrency: z.coerce.number().int().min(1).max(MAX_CONCURRENCY).default(MAX_CONCURRENCY),
    dryRun: z.boolean().default(false),
  })
  .refine((a) => [(a.source?.length ?? 0) > 0, a.all].filter(Boolean).length === 1, {
    message: 'Specify exactly one of --source <name> (repeatable) or --all.',
  });

export type UploadArgs = z.infer<typeof uploadArgsSchema>;

// ---------------------------------------------------------------------------
// delete args
// ---------------------------------------------------------------------------

/**
 * Requires exactly one target: `--source <name>` or `--prefix <path>`.
 *
 * There is intentionally no "delete everything" option, and `--prefix` must be
 * non-empty so it can never match (and delete) the whole store.
 */
export const deleteArgsSchema = z
  .object({
    source: z
      .string()
      .regex(SEGMENT, 'source must be a single directory name (no slashes)')
      .optional(),
    prefix: z.string().min(1, 'prefix must not be empty').optional(),
    yes: z.boolean().default(false),
  })
  .refine((a) => [a.source !== undefined, a.prefix !== undefined].filter(Boolean).length === 1, {
    message: 'Specify exactly one of --source <name> or --prefix <path>.',
  });

export type DeleteArgs = z.infer<typeof deleteArgsSchema>;

/** Resolve the `list()` prefix and a human-readable label for a delete target. */
export function resolveDeleteTarget(args: DeleteArgs): { prefix: string; label: string } {
  if (args.source !== undefined) {
    return { prefix: `${args.source}/`, label: `prefix "${args.source}/"` };
  }
  if (args.prefix !== undefined) {
    return { prefix: args.prefix, label: `prefix "${args.prefix}"` };
  }
  // Unreachable: deleteArgsSchema requires exactly one target.
  throw new Error('No delete target (--source or --prefix) provided.');
}

// ---------------------------------------------------------------------------
// list args
// ---------------------------------------------------------------------------

/**
 * Read-only listing. The filter is optional (omit to list the whole store);
 * at most one of `--source` / `--prefix` may be given.
 */
export const listArgsSchema = z
  .object({
    source: z
      .string()
      .regex(SEGMENT, 'source must be a single directory name (no slashes)')
      .optional(),
    prefix: z.string().min(1, 'prefix must not be empty').optional(),
  })
  .refine((a) => [a.source !== undefined, a.prefix !== undefined].filter(Boolean).length <= 1, {
    message: 'Specify at most one of --source <name> or --prefix <path>.',
  });

export type ListArgs = z.infer<typeof listArgsSchema>;

/**
 * Resolve the `list()` prefix (undefined = entire store) and a label. Listing
 * the whole store is safe here because this operation is read-only.
 */
export function resolveListPrefix(args: ListArgs): { prefix: string | undefined; label: string } {
  if (args.source !== undefined) {
    return { prefix: `${args.source}/`, label: `under "${args.source}/"` };
  }
  if (args.prefix !== undefined) {
    return { prefix: args.prefix, label: `under "${args.prefix}"` };
  }
  return { prefix: undefined, label: 'in the entire store' };
}
