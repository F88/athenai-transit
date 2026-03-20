/**
 * Download-specific utilities.
 *
 * Provides helpers for HTTP downloads with retry, progress display,
 * timeout handling, and archive filename generation.
 *
 * General pipeline utilities (CLI parsing, batch execution, formatting)
 * live in pipeline-utils.ts.
 */

import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { formatBytes } from '../format-utils';
import type { Authentication } from '../../types/resource-common';

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
// Authentication
// ---------------------------------------------------------------------------

/**
 * Append `acl:consumerKey` to a URL when authentication is required.
 *
 * @param url - Base URL (may already contain query parameters).
 * @param authentication - Authentication requirement from the resource definition.
 * @param accessToken - ODPT access token from environment variable.
 * @param context - Optional resource name for error messages.
 * @returns URL with token appended, or the original URL if no auth is needed.
 */
export function buildAuthenticatedUrl(
  url: string,
  authentication: Authentication,
  accessToken: string | undefined,
  context?: string,
): string {
  if (!authentication.required) {
    return url;
  }
  if (!accessToken) {
    const prefix = context ? `[${context}] ` : '';
    throw new Error(
      `${prefix}ODPT_ACCESS_TOKEN environment variable is required. ` +
        `Register at ${authentication.registrationUrl}`,
    );
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}acl:consumerKey=${encodeURIComponent(accessToken)}`;
}

/**
 * Redact authentication tokens from a string.
 *
 * Replaces `acl:consumerKey=<token>` patterns with `acl:consumerKey=[REDACTED]`
 * to prevent accidental token exposure in logs or persisted metadata.
 *
 * @param text - Text that may contain authentication tokens.
 * @returns Text with tokens replaced by `[REDACTED]`.
 */
export function redactTokens(text: string): string {
  return text.replace(/acl:consumerKey=[^\s&]+/g, 'acl:consumerKey=[REDACTED]');
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
        throw new Error(
          `Failed after ${maxRetries} attempts (${redactTokens(label)}): ${redactTokens(String(err))}`,
          { cause: err },
        );
      }
      const delay = 2 ** (attempt - 1) * 1000;
      console.warn(
        `  Attempt ${attempt}/${maxRetries} failed: ${redactTokens(String(err))}. Retrying in ${delay / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript control flow: loop always returns or throws, but compiler cannot prove it.
  throw new Error(`Failed after ${maxRetries} attempts (${redactTokens(label)})`, {
    cause: lastError,
  });
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
