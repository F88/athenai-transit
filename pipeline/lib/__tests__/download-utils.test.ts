import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FETCH_TIMEOUT_MS, archiveFilename, withRetry, wrapTimeoutError } from '../download-utils';

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
