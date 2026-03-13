import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BatchResult,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  determineBatchExitCode,
  formatBytes,
  formatExitCode,
  parseCliArg,
  runMain,
} from '../pipeline-utils';

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
// parseCliArg
// ---------------------------------------------------------------------------

describe('parseCliArg', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns help when no argument given', () => {
    process.argv = ['node', 'script.ts'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for --help', () => {
    process.argv = ['node', 'script.ts', '--help'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for -h', () => {
    process.argv = ['node', 'script.ts', '-h'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns list for --list', () => {
    process.argv = ['node', 'script.ts', '--list'];
    expect(parseCliArg()).toEqual({ kind: 'list' });
  });

  it('returns targets with path for --targets <file>', () => {
    process.argv = ['node', 'script.ts', '--targets', 'path/to/targets.ts'];
    expect(parseCliArg()).toEqual({ kind: 'targets', path: 'path/to/targets.ts' });
  });

  it('returns help when --targets has no path argument', () => {
    process.argv = ['node', 'script.ts', '--targets'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns source-name for a plain argument', () => {
    process.argv = ['node', 'script.ts', 'toei-bus'];
    expect(parseCliArg()).toEqual({ kind: 'source-name', name: 'toei-bus' });
  });
});

// ---------------------------------------------------------------------------
// runMain
// ---------------------------------------------------------------------------

describe('runMain', () => {
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('runs a sync function to completion', async () => {
    const fn = vi.fn();
    runMain(fn);
    // fn is called asynchronously via .then()
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(process.exitCode).toBeUndefined();
  });

  it('runs an async function to completion', async () => {
    const fn = vi.fn(async () => {});
    runMain(fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(process.exitCode).toBeUndefined();
  });

  it('catches a sync throw and sets exitCode to 1', async () => {
    runMain(() => {
      throw new Error('sync boom');
    });
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('sync boom'));
  });

  it('catches an async rejection and sets exitCode to 1', async () => {
    runMain(async () => {
      throw new Error('async boom');
    });
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('async boom'));
  });

  it('logs the cause when error has a cause', async () => {
    runMain(() => {
      throw new Error('outer', { cause: new Error('inner cause') });
    });
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('inner cause'));
  });

  it('handles non-Error throws gracefully', async () => {
    runMain(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error';
    });
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });
});
