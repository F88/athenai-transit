import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BatchResult,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  determineBatchExitCode,
  formatExitCode,
  parseCliArg,
  runMain,
} from '../pipeline-utils';

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

  // extra arguments after valid args → help
  it('returns help when --targets <file> has extra arguments', () => {
    process.argv = ['node', 'script.ts', '--targets', 'path/to/targets.ts', '--list'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets <file> has extra source name', () => {
    process.argv = ['node', 'script.ts', '--targets', 'path/to/targets.ts', 'toei-bus'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --list has extra arguments', () => {
    process.argv = ['node', 'script.ts', '--list', '--targets', 'path/to/targets.ts'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --list has extra source name', () => {
    process.argv = ['node', 'script.ts', '--list', 'toei-bus'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when source name has extra arguments', () => {
    process.argv = ['node', 'script.ts', 'toei-bus', 'extra-arg'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when source name has extra flag', () => {
    process.argv = ['node', 'script.ts', 'toei-bus', '--list'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  // --help with extra args still returns help
  it('returns help for --help with extra args', () => {
    process.argv = ['node', 'script.ts', '--help', '--list'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  // --targets + flag as file path → help
  it('returns help when --targets is followed by --list', () => {
    process.argv = ['node', 'script.ts', '--targets', '--list'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets is followed by --help', () => {
    process.argv = ['node', 'script.ts', '--targets', '--help'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets is followed by -h', () => {
    process.argv = ['node', 'script.ts', '--targets', '-h'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets is followed by unknown flag', () => {
    process.argv = ['node', 'script.ts', '--targets', '--unknown'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets is followed by short flag', () => {
    process.argv = ['node', 'script.ts', '--targets', '-f'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  // unknown flags return help
  it('returns help for unknown double-dash flag', () => {
    process.argv = ['node', 'script.ts', '--unknown'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for unknown short flag', () => {
    process.argv = ['node', 'script.ts', '-x'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for single dash', () => {
    process.argv = ['node', 'script.ts', '-'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for double dash alone', () => {
    process.argv = ['node', 'script.ts', '--'];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help for empty string argument', () => {
    process.argv = ['node', 'script.ts', ''];
    expect(parseCliArg()).toEqual({ kind: 'help' });
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
    runMain(() => Promise.reject(new Error('async boom')));
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

  it('uses fatalExitCode option when provided', async () => {
    runMain(
      () => {
        throw new Error('fatal with custom code');
      },
      { fatalExitCode: 2 },
    );
    await vi.waitFor(() => expect(process.exitCode).toBe(2));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Exit code: 2'));
  });

  it('defaults fatalExitCode to 1 when not provided', async () => {
    runMain(() => {
      throw new Error('default code');
    });
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Exit code: 1'));
  });
});
