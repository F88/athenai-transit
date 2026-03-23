/**
 * Shared utilities for pipeline CLI scripts.
 *
 * Provides common helpers for CLI argument parsing, batch execution,
 * error handling, and formatting — used across all pipeline scripts
 * (download, build-db, build-json, etc.).
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Result of parsing the CLI argument for pipeline scripts.
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
 * Options for {@link parseCliArg} to enable/disable specific argument modes.
 *
 * All options default to `true`. Set to `false` to reject that mode
 * (returns `{ kind: 'help' }` instead).
 *
 * Example — global builder that only accepts `--targets`:
 * ```ts
 * parseCliArg({ allowList: false, allowSourceName: false })
 * ```
 */
export interface ParseCliOptions {
  /** Allow `--list` mode. @default true */
  allowList?: boolean;
  /** Allow `--targets <file>` mode. @default true */
  allowTargets?: boolean;
  /** Allow `<source-name>` positional argument. @default true */
  allowSourceName?: boolean;
}

/**
 * Parse the first CLI argument (`process.argv[2]`) for pipeline scripts.
 *
 * @param options - Optional flags to disable specific modes.
 * @returns Parsed argument result.
 */
export function parseCliArg(options?: ParseCliOptions): ParsedArg {
  const { allowList = true, allowTargets = true, allowSourceName = true } = options ?? {};
  const arg = process.argv[2];

  switch (arg) {
    case undefined:
    case '':
    case '--help':
    case '-h':
      return { kind: 'help' };

    case '--list':
      if (!allowList) {
        return { kind: 'help' };
      }
      // --list takes no additional arguments; extra args indicate user error.
      return process.argv.length > 3 ? { kind: 'help' } : { kind: 'list' };

    case '--targets': {
      if (!allowTargets) {
        return { kind: 'help' };
      }
      const filePath = process.argv[3];
      // Missing path or flag-like path (e.g. --targets --list) is invalid.
      if (!filePath || filePath.startsWith('-')) {
        return { kind: 'help' };
      }
      // --targets <file> takes exactly one argument; extra args indicate user error.
      return process.argv.length > 4 ? { kind: 'help' } : { kind: 'targets', path: filePath };
    }

    default:
      // Unknown flags (e.g. --unknown, -x, --, -) are invalid arguments.
      if (arg.startsWith('-')) {
        return { kind: 'help' };
      }
      if (!allowSourceName) {
        return { kind: 'help' };
      }
      // Source name takes no additional arguments; extra args indicate user error.
      return process.argv.length > 3 ? { kind: 'help' } : { kind: 'source-name', name: arg };
  }
}

// ---------------------------------------------------------------------------
// Top-level error handler
// ---------------------------------------------------------------------------

/** Options for {@link runMain}. */
export interface RunMainOptions {
  /**
   * Exit code to set when an unhandled error occurs.
   * @default 1
   */
  fatalExitCode?: number;
}

/**
 * Run a main function with proper error handling for CLI scripts.
 *
 * Catches unhandled errors, logs them to stderr, and sets
 * `process.exitCode` instead of crashing with an unhandled
 * promise rejection.
 *
 * @param fn - The main function to execute (sync or async).
 * @param options - Optional configuration.
 */
export function runMain(fn: () => void | Promise<void>, options?: RunMainOptions): void {
  const fatalExitCode = options?.fatalExitCode ?? 1;
  Promise.resolve()
    .then(() => fn())
    .catch((err: unknown) => {
      console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.cause instanceof Error) {
        console.error(`  Cause: ${err.cause.message}`);
      }
      process.exitCode = fatalExitCode;
      // Don't use formatExitCode() here — its labels ("partial failure",
      // "all failed") are for batch results. runMain's catch is a fatal
      // error safety net, so "error" is always the correct label.
      console.error(`\nExit code: ${fatalExitCode} (error)`);
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

/** Result of a single source operation in a batch run. */
export interface BatchResult {
  sourceName: string;
  success: boolean;
  durationMs: number;
}

/**
 * Run a pipeline script for each source name in sequence.
 *
 * Each source runs in a separate child process for error isolation.
 * A failed source does not stop subsequent sources.
 *
 * @param scriptPath - Absolute path to the script (e.g. download-gtfs.ts, build-gtfs-db.ts).
 * @param sourceNames - Array of source names to process.
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
      console.error(`  [${sourceName}] FAILED`);
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
 * Follows the same convention as validate-app-data.ts:
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
