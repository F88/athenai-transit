import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type AggregateTargetResult,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  determineAggregateExitCode,
  formatExitCode,
  parseCliArg,
  printAggregateSummary,
  runMain,
  uniqueInOrder,
} from '../pipeline-utils';

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

  // empty string as extra argument (detected via argv.length)
  it('returns help when --list has empty string extra arg', () => {
    process.argv = ['node', 'script.ts', '--list', ''];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when --targets <file> has empty string extra arg', () => {
    process.argv = ['node', 'script.ts', '--targets', 'file.ts', ''];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  it('returns help when source name has empty string extra arg', () => {
    process.argv = ['node', 'script.ts', 'toei-bus', ''];
    expect(parseCliArg()).toEqual({ kind: 'help' });
  });

  // ParseCliOptions: disabling modes
  describe('with ParseCliOptions', () => {
    it('rejects --list when allowList is false', () => {
      process.argv = ['node', 'script.ts', '--list'];
      expect(parseCliArg({ allowList: false })).toEqual({ kind: 'help' });
    });

    it('rejects --targets when allowTargets is false', () => {
      process.argv = ['node', 'script.ts', '--targets', 'file.ts'];
      expect(parseCliArg({ allowTargets: false })).toEqual({ kind: 'help' });
    });

    it('rejects source-name when allowSourceName is false', () => {
      process.argv = ['node', 'script.ts', 'toei-bus'];
      expect(parseCliArg({ allowSourceName: false })).toEqual({ kind: 'help' });
    });

    it('allows --targets when only allowTargets is true', () => {
      process.argv = ['node', 'script.ts', '--targets', 'file.ts'];
      expect(parseCliArg({ allowList: false, allowSourceName: false })).toEqual({
        kind: 'targets',
        path: 'file.ts',
      });
    });

    it('still returns help for --help regardless of options', () => {
      process.argv = ['node', 'script.ts', '--help'];
      expect(
        parseCliArg({ allowList: false, allowTargets: false, allowSourceName: false }),
      ).toEqual({ kind: 'help' });
    });

    it('still returns help for no args regardless of options', () => {
      process.argv = ['node', 'script.ts'];
      expect(
        parseCliArg({ allowList: false, allowTargets: false, allowSourceName: false }),
      ).toEqual({ kind: 'help' });
    });
  });
});

// ---------------------------------------------------------------------------
// uniqueInOrder
// ---------------------------------------------------------------------------

describe('uniqueInOrder', () => {
  it('removes duplicates while preserving first-seen order', () => {
    expect(uniqueInOrder(['minkuru', 'kobus', 'minkuru', 'toaran'])).toEqual([
      'minkuru',
      'kobus',
      'toaran',
    ]);
  });

  it('returns the original list when no duplicates exist', () => {
    expect(uniqueInOrder(['minkuru', 'kobus'])).toEqual(['minkuru', 'kobus']);
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

// ---------------------------------------------------------------------------
// determineAggregateExitCode
// ---------------------------------------------------------------------------

describe('determineAggregateExitCode', () => {
  const make = (
    prefix: string,
    status: AggregateTargetResult['status'],
  ): AggregateTargetResult => ({
    prefix,
    status,
    reason: status === 'ok' ? '' : `${status} reason`,
    durationMs: 10,
  });

  it('returns EXIT_ERROR for an empty result list', () => {
    expect(determineAggregateExitCode([])).toBe(EXIT_ERROR);
  });

  it('returns EXIT_OK when every result is ok', () => {
    expect(determineAggregateExitCode([make('a', 'ok'), make('b', 'ok'), make('c', 'ok')])).toBe(
      EXIT_OK,
    );
  });

  it('returns EXIT_WARN when at least one ok and some skipped', () => {
    expect(determineAggregateExitCode([make('a', 'ok'), make('b', 'skipped')])).toBe(EXIT_WARN);
  });

  it('returns EXIT_WARN when at least one ok and some failed', () => {
    expect(determineAggregateExitCode([make('a', 'ok'), make('b', 'failed')])).toBe(EXIT_WARN);
  });

  it('returns EXIT_WARN with a mix of ok / skipped / failed', () => {
    expect(
      determineAggregateExitCode([make('a', 'ok'), make('b', 'skipped'), make('c', 'failed')]),
    ).toBe(EXIT_WARN);
  });

  it('returns EXIT_ERROR when every result is skipped', () => {
    expect(determineAggregateExitCode([make('a', 'skipped'), make('b', 'skipped')])).toBe(
      EXIT_ERROR,
    );
  });

  it('returns EXIT_ERROR when every result is failed', () => {
    expect(determineAggregateExitCode([make('a', 'failed'), make('b', 'failed')])).toBe(EXIT_ERROR);
  });

  it('returns EXIT_ERROR with no ok across skipped + failed mix', () => {
    expect(determineAggregateExitCode([make('a', 'skipped'), make('b', 'failed')])).toBe(
      EXIT_ERROR,
    );
  });

  it('returns EXIT_WARN when exactly one of many is ok', () => {
    expect(
      determineAggregateExitCode([
        make('a', 'ok'),
        make('b', 'failed'),
        make('c', 'failed'),
        make('d', 'skipped'),
      ]),
    ).toBe(EXIT_WARN);
  });
});

// ---------------------------------------------------------------------------
// printAggregateSummary
// ---------------------------------------------------------------------------

describe('printAggregateSummary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const make = (
    prefix: string,
    status: AggregateTargetResult['status'],
    reason = '',
    durationMs = 100,
  ): AggregateTargetResult => ({ prefix, status, reason, durationMs });

  it('prints a header, one row per target, and a total footer', () => {
    printAggregateSummary([
      make('alpha', 'ok'),
      make('beta', 'skipped', 'data.json not found'),
      make('gamma', 'failed', 'JSON parse error'),
    ]);

    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((args) => String(args[0]))
      .join('\n');

    expect(calls).toContain('=== Aggregate Summary ===');
    expect(calls).toMatch(/alpha\s+OK\s+0\.1s/);
    expect(calls).toMatch(/beta\s+SKIPPED\s+0\.1s\s+\(data\.json not found\)/);
    expect(calls).toMatch(/gamma\s+FAILED\s+0\.1s\s+\(JSON parse error\)/);
    expect(calls).toContain('Total: 3 sources, 1 ok, 1 skipped, 1 failed');
  });

  it('omits the reason suffix for ok rows', () => {
    printAggregateSummary([make('alpha', 'ok')]);

    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((args) => String(args[0]))
      .join('\n');

    expect(calls).toMatch(/alpha\s+OK\s+0\.1s$/m);
  });

  it('sums per-target durations into the total footer (seconds)', () => {
    printAggregateSummary([make('a', 'ok', '', 1500), make('b', 'ok', '', 2500)]);

    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((args) => String(args[0]))
      .join('\n');

    expect(calls).toContain('(4.0s)');
  });
});
