import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BatchResult,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  FETCH_TIMEOUT_MS,
  archiveFilename,
  determineBatchExitCode,
  formatBytes,
  formatExitCode,
  parseDownloadArg,
  withRetry,
  wrapTimeoutError,
} from '../download-utils';

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('returns bytes for values below 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('returns KB for values between 1 KB and 1 MB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('returns MB for values >= 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    expect(formatBytes(1024 * 1024 * 100)).toBe('100.0 MB');
  });

  it('handles exact boundary values', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});

// ---------------------------------------------------------------------------
// archiveFilename
// ---------------------------------------------------------------------------

describe('archiveFilename', () => {
  beforeEach(() => {
    // Fix the date to a known value for deterministic timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 12, 14, 30, 45)); // 2026-03-12 14:30:45 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserts timestamp before file extension', () => {
    const result = archiveFilename('ToeiBus-GTFS.zip');
    expect(result).toBe('ToeiBus-GTFS_20260312-143045.zip');
  });

  it('handles multiple dots in filename', () => {
    const result = archiveFilename('data.backup.tar.gz');
    // lastIndexOf('.') finds the last dot
    expect(result).toBe('data.backup.tar_20260312-143045.gz');
  });

  it('appends timestamp when no extension', () => {
    const result = archiveFilename('archive');
    expect(result).toBe('archive_20260312-143045');
  });

  it('appends timestamp when dot is at position 0 (hidden file)', () => {
    const result = archiveFilename('.gitignore');
    // dotIndex === 0, so treated as no-extension
    expect(result).toBe('.gitignore_20260312-143045');
  });

  it('handles JSON files', () => {
    const result = archiveFilename('odpt_Station.json');
    expect(result).toBe('odpt_Station_20260312-143045.json');
  });
});

// ---------------------------------------------------------------------------
// wrapTimeoutError
// ---------------------------------------------------------------------------

describe('wrapTimeoutError', () => {
  it('wraps DOMException TimeoutError with URL context', () => {
    const original = new DOMException('The operation was aborted', 'TimeoutError');
    const wrapped = wrapTimeoutError(original, 'https://example.com/data.zip');

    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe(
      `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: https://example.com/data.zip`,
    );
    expect(wrapped.cause).toBe(original);
  });

  it('returns the original Error as-is for non-timeout errors', () => {
    const original = new Error('Network error');
    const result = wrapTimeoutError(original, 'https://example.com');

    expect(result).toBe(original);
  });

  it('wraps non-Error values in a new Error', () => {
    const result = wrapTimeoutError('string error', 'https://example.com');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('string error');
  });

  it('wraps DOMException with a different name as a generic Error', () => {
    const original = new DOMException('Aborted', 'AbortError');
    const result = wrapTimeoutError(original, 'https://example.com');

    // DOMException may not extend Error in all environments (e.g. jsdom),
    // so it falls through to the String(err) branch.
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('Aborted');
  });
});

// ---------------------------------------------------------------------------
// determineBatchExitCode
// ---------------------------------------------------------------------------

describe('determineBatchExitCode', () => {
  const ok = (name: string): BatchResult => ({ sourceName: name, success: true, durationMs: 100 });
  const fail = (name: string): BatchResult => ({
    sourceName: name,
    success: false,
    durationMs: 100,
  });

  it('returns EXIT_OK (0) for an empty results array', () => {
    expect(determineBatchExitCode([])).toBe(EXIT_OK);
  });

  it('returns EXIT_OK (0) when all succeeded', () => {
    expect(determineBatchExitCode([ok('a'), ok('b'), ok('c')])).toBe(EXIT_OK);
  });

  it('returns EXIT_WARN (1) when some succeeded and some failed', () => {
    expect(determineBatchExitCode([ok('a'), fail('b'), ok('c')])).toBe(EXIT_WARN);
  });

  it('returns EXIT_ERROR (2) when all failed', () => {
    expect(determineBatchExitCode([fail('a'), fail('b')])).toBe(EXIT_ERROR);
  });

  it('returns EXIT_ERROR (2) for a single failed source', () => {
    expect(determineBatchExitCode([fail('a')])).toBe(EXIT_ERROR);
  });

  it('returns EXIT_OK (0) for a single successful source', () => {
    expect(determineBatchExitCode([ok('a')])).toBe(EXIT_OK);
  });
});

// ---------------------------------------------------------------------------
// formatExitCode
// ---------------------------------------------------------------------------

describe('formatExitCode', () => {
  it('formats EXIT_OK', () => {
    expect(formatExitCode(EXIT_OK)).toBe('Exit code: 0 (ok)');
  });

  it('formats EXIT_WARN', () => {
    expect(formatExitCode(EXIT_WARN)).toBe('Exit code: 1 (partial failure)');
  });

  it('formats EXIT_ERROR', () => {
    expect(formatExitCode(EXIT_ERROR)).toBe('Exit code: 2 (all failed)');
  });

  it('formats unknown exit code', () => {
    expect(formatExitCode(99)).toBe('Exit code: 99 (unknown)');
  });
});

// ---------------------------------------------------------------------------
// parseDownloadArg
// ---------------------------------------------------------------------------

describe('parseDownloadArg', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns help when no argument given', () => {
    process.argv = ['node', 'script.ts'];
    expect(parseDownloadArg()).toEqual({ kind: 'help' });
  });

  it('returns help for --help', () => {
    process.argv = ['node', 'script.ts', '--help'];
    expect(parseDownloadArg()).toEqual({ kind: 'help' });
  });

  it('returns help for -h', () => {
    process.argv = ['node', 'script.ts', '-h'];
    expect(parseDownloadArg()).toEqual({ kind: 'help' });
  });

  it('returns list for --list', () => {
    process.argv = ['node', 'script.ts', '--list'];
    expect(parseDownloadArg()).toEqual({ kind: 'list' });
  });

  it('returns targets with path for --targets <file>', () => {
    process.argv = ['node', 'script.ts', '--targets', 'path/to/targets.ts'];
    expect(parseDownloadArg()).toEqual({ kind: 'targets', path: 'path/to/targets.ts' });
  });

  it('returns help when --targets has no path argument', () => {
    process.argv = ['node', 'script.ts', '--targets'];
    expect(parseDownloadArg()).toEqual({ kind: 'help' });
  });

  it('returns source-name for a plain argument', () => {
    process.argv = ['node', 'script.ts', 'toei-bus'];
    expect(parseDownloadArg()).toEqual({ kind: 'source-name', name: 'toei-bus' });
  });
});

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns result on first attempt success', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const result = await withRetry(fn, 'test');

    expect(result).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, 'test', 3);

    // Advance past the 1s backoff delay (2^0 * 1000)
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

    const promise = withRetry(fn, 'https://example.com', 3);

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const resultPromise = promise.catch((err: Error) => err);

    // Advance past both backoff delays (1s + 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const err = await resultPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(
      'Failed after 3 attempts (https://example.com): Error: persistent error',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('preserves original error as cause when all retries exhausted', async () => {
    const originalError = new Error('root cause');
    const fn = vi.fn().mockRejectedValue(originalError);

    // maxRetries=1 means no backoff delay — fails immediately
    await expect(withRetry(fn, 'test', 1)).rejects.toMatchObject({
      message: 'Failed after 1 attempts (test): Error: root cause',
      cause: originalError,
    });
  });

  it('uses exponential backoff delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, 'test', 3);

    // First retry: 2^0 * 1000 = 1000ms
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry: 2^1 * 1000 = 2000ms
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('ok');
  });

  it('logs warning on each failed attempt except the last', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    const fn = vi.fn().mockRejectedValue(new Error('oops'));

    const promise = withRetry(fn, 'test', 3);

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const resultPromise = promise.catch(() => {});

    // Advance past both backoff delays (1s + 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await resultPromise;

    // Warnings for attempt 1 and 2 (not attempt 3 which throws)
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('Attempt 1/3 failed');
    expect(warnSpy.mock.calls[1][0]).toContain('Attempt 2/3 failed');
  });
});
