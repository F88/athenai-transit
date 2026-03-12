/**
 * Shared utilities for download scripts.
 *
 * Provides common helpers used by both `download-gtfs.ts` and
 * `download-odpt-json.ts` to avoid code duplication.
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of retry attempts for network requests. */
export const MAX_RETRIES = 3;

/** Timeout in milliseconds for individual fetch requests. */
export const FETCH_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes.
 * @returns Formatted string (e.g. "1.2 KB", "3.4 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param dir - Directory path to ensure.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a timestamp string for archive filenames.
 *
 * @returns Timestamp in `YYYYMMDD-HHmmss` format.
 */
export function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

/**
 * Generate an archive filename with a timestamp.
 *
 * @param filename - Original filename (e.g. "ToeiBus-GTFS.zip", "odpt_Station.json").
 * @returns Timestamped filename (e.g. "ToeiBus-GTFS_20260312-143000.zip").
 */
export function archiveFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${filename}_${timestamp()}`;
  }
  const baseName = filename.substring(0, dotIndex);
  const ext = filename.substring(dotIndex);
  return `${baseName}_${timestamp()}${ext}`;
}

/**
 * Add timeout context to an error message.
 *
 * `AbortSignal.timeout()` throws a generic `TimeoutError` without
 * indicating which URL or how long the timeout was. This helper
 * detects timeout errors and wraps them with actionable context.
 *
 * @param err - The caught error.
 * @param url - The URL that was being fetched.
 * @returns A new Error with context if it was a timeout, otherwise the original error.
 */
export function wrapTimeoutError(err: unknown, url: string): Error {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`, { cause: err });
  }
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/**
 * Execute an async operation with exponential backoff retry.
 *
 * @param fn - Async function to execute. Receives the current attempt number (1-based).
 * @param label - Label for log messages (e.g. URL or resource name).
 * @param maxRetries - Maximum number of attempts (default: {@link MAX_RETRIES}).
 * @returns The result of `fn`.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  label: string,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts (${label}): ${String(err)}`, {
          cause: err,
        });
      }
      const delay = 2 ** (attempt - 1) * 1000;
      console.warn(
        `  Attempt ${attempt}/${maxRetries} failed: ${String(err)}. Retrying in ${delay / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript control flow: loop always returns or throws, but compiler cannot prove it.
  throw new Error(`Failed after ${maxRetries} attempts (${label})`, { cause: lastError });
}

// ---------------------------------------------------------------------------
// Download with retry and progress
// ---------------------------------------------------------------------------

/** Result of a successful file download. */
export interface DownloadResult {
  /** Total bytes written to disk. */
  bytes: number;
  /** Download duration in milliseconds. */
  durationMs: number;
  /** HTTP Content-Type header value, if present. */
  contentType: string;
}

/**
 * Download a file with retry, progress display, and streaming to disk.
 *
 * Shows real-time download progress (percentage when Content-Length is
 * available, otherwise raw byte count). Retries on failure with
 * exponential backoff via {@link withRetry}.
 *
 * @param url - URL to download.
 * @param dest - Local file path to write to.
 * @returns Download result with byte count, duration, and content type.
 */
export async function downloadWithRetry(url: string, dest: string): Promise<DownloadResult> {
  return withRetry(async () => {
    let res: Response;
    const startTime = performance.now();
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw wrapTimeoutError(err, url);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentLength = Number(res.headers.get('content-length') || 0);
    const contentType = res.headers.get('content-type') ?? '';
    if (contentLength > 0) {
      console.log(`  Content-Length: ${contentLength.toLocaleString()} bytes`);
    }

    if (!res.body) {
      throw new Error(`Response body is empty for ${url}`);
    }

    const out = createWriteStream(dest);
    let downloaded = 0;

    const progress = new Transform({
      transform(chunk: Uint8Array, _encoding, callback) {
        downloaded += chunk.byteLength;
        if (contentLength > 0) {
          const pct = ((downloaded / contentLength) * 100).toFixed(0);
          process.stdout.write(
            `\r  Progress: ${formatBytes(downloaded)} / ${formatBytes(contentLength)} (${pct}%)`,
          );
        } else {
          process.stdout.write(`\r  Downloaded: ${formatBytes(downloaded)}`);
        }
        callback(null, chunk);
      },
      flush(callback) {
        process.stdout.write('\n');
        callback();
      },
    });

    const readable = Readable.from(res.body);
    await pipeline(readable, progress, out);

    const durationMs = Math.round(performance.now() - startTime);
    return { bytes: downloaded, durationMs, contentType };
  }, url);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Result of parsing the CLI argument for download scripts.
 *
 * - `kind: 'help'` — `--help` or no argument was given.
 * - `kind: 'list'` — `--list` was given.
 * - `kind: 'source-name'` — a source name was given.
 * - `kind: 'targets'` — `--targets <path>` was given for batch execution.
 */
export type ParsedArg =
  | { kind: 'help' }
  | { kind: 'list' }
  | { kind: 'source-name'; name: string }
  | { kind: 'targets'; path: string };

/**
 * Parse the first CLI argument (`process.argv[2]`) for download scripts.
 *
 * @returns Parsed argument result.
 */
export function parseDownloadArg(): ParsedArg {
  const arg = process.argv[2];
  if (!arg || arg === '--help' || arg === '-h') {
    return { kind: 'help' };
  }
  if (arg === '--list') {
    return { kind: 'list' };
  }
  if (arg === '--targets') {
    const filePath = process.argv[3];
    if (!filePath) {
      return { kind: 'help' };
    }
    return { kind: 'targets', path: filePath };
  }
  return { kind: 'source-name', name: arg };
}

// ---------------------------------------------------------------------------
// Top-level error handler
// ---------------------------------------------------------------------------

/**
 * Run a main function with proper error handling for CLI scripts.
 *
 * Catches unhandled errors, logs them to stderr, and sets
 * `process.exitCode = 1` instead of crashing with an unhandled
 * promise rejection.
 *
 * @param fn - The async main function to execute.
 */
export function runMain(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${err.cause.message}`);
    }
    process.exitCode = 1;
    console.error('\nExit code: 1 (error)');
  });
}

// ---------------------------------------------------------------------------
// Batch execution
// ---------------------------------------------------------------------------

/**
 * Load a target list from a TypeScript file.
 *
 * The file must `export default` a `string[]` of source names.
 *
 * @param filePath - Path to the target list file (.ts).
 * @returns Array of source names.
 */
export async function loadTargetFile(filePath: string): Promise<string[]> {
  const absolutePath = resolve(filePath);
  const mod = (await import(pathToFileURL(absolutePath).href)) as { default: string[] };
  return mod.default;
}

/** Result of a single source download in a batch run. */
export interface BatchResult {
  sourceName: string;
  success: boolean;
  durationMs: number;
}

/**
 * Run a download script for each source name in sequence.
 *
 * Each source runs in a separate child process for error isolation.
 * A failed source does not stop subsequent sources.
 *
 * @param scriptPath - Absolute path to the download script (e.g. download-gtfs.ts).
 * @param sourceNames - Array of source names to download.
 * @returns Array of results for each source.
 */
export function runBatch(scriptPath: string, sourceNames: string[]): BatchResult[] {
  const results: BatchResult[] = [];

  for (let i = 0; i < sourceNames.length; i++) {
    if (i > 0) {
      console.log('');
    }
    const sourceName = sourceNames[i];
    const startTime = performance.now();
    let success = true;

    try {
      execFileSync('npx', ['tsx', scriptPath, sourceName], {
        stdio: 'inherit',
        env: process.env,
      });
    } catch {
      success = false;
    }

    const durationMs = Math.round(performance.now() - startTime);
    results.push({ sourceName, success, durationMs });
  }

  return results;
}

/** Exit code: all sources succeeded. */
export const EXIT_OK = 0;

/** Exit code: some sources failed (partial failure). */
export const EXIT_WARN = 1;

/** Exit code: all sources failed. */
export const EXIT_ERROR = 2;

/**
 * Print a summary table of batch results.
 *
 * @param results - Batch execution results.
 */
export function printBatchSummary(results: BatchResult[]): void {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log('\n=== Batch Summary ===\n');
  for (const r of results) {
    const status = r.success ? 'OK' : 'FAILED';
    const duration = (r.durationMs / 1000).toFixed(1);
    console.log(`  ${r.sourceName.padEnd(30)} ${status.padEnd(8)} ${duration}s`);
  }
  console.log(
    `\n  Total: ${results.length} sources, ${succeeded.length} succeeded, ${failed.length} failed (${(totalMs / 1000).toFixed(1)}s)`,
  );
}

/**
 * Determine the exit code based on batch results.
 *
 * Follows the same convention as validate-generated-data.ts:
 * - 0 (EXIT_OK): all succeeded
 * - 1 (EXIT_WARN): partial failure (some succeeded, some failed)
 * - 2 (EXIT_ERROR): all failed
 *
 * @param results - Batch execution results.
 * @returns Exit code.
 */
export function determineBatchExitCode(results: BatchResult[]): number {
  if (results.length === 0) {
    return EXIT_OK;
  }
  const failedCount = results.filter((r) => !r.success).length;
  if (failedCount === results.length) {
    return EXIT_ERROR;
  }
  if (failedCount > 0) {
    return EXIT_WARN;
  }
  return EXIT_OK;
}

/** Human-readable label for each exit code. */
const EXIT_CODE_LABELS: Record<number, string> = {
  [EXIT_OK]: 'ok',
  [EXIT_WARN]: 'partial failure',
  [EXIT_ERROR]: 'all failed',
};

/**
 * Format an exit code with its label for log output.
 *
 * @param exitCode - Exit code value.
 * @returns Formatted string (e.g. "Exit code: 1 (partial failure)").
 */
export function formatExitCode(exitCode: number): string {
  const label = EXIT_CODE_LABELS[exitCode] ?? 'unknown';
  return `Exit code: ${exitCode} (${label})`;
}
