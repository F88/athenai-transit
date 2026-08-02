/**
 * Per-source batch execution for pipeline CLI scripts.
 *
 * Runs a per-source script (`npx tsx <script> <source>`) once per source, either
 * sequentially ({@link runBatch}) or with bounded concurrency
 * ({@link runBatchConcurrent}), and summarizes the results. Split out of
 * `pipeline-utils.ts` to keep the batch-execution concern self-contained.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { EXIT_ERROR, EXIT_OK, EXIT_WARN } from './pipeline-utils';

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

/**
 * Run an async worker over items with a bounded concurrency.
 *
 * A fixed pool of `concurrency` runners pulls items from a shared cursor until
 * the list is exhausted. Results are written back at each item's original index,
 * so the returned array is in input order regardless of completion order. The
 * worker is expected to never reject (batch callers capture failures as data);
 * a rejecting worker propagates and aborts the pool.
 *
 * Pure (no process spawning) so the concurrency policy is unit-testable.
 *
 * @param items - Items to process.
 * @param concurrency - Maximum number of workers in flight (clamped to >= 1).
 * @param worker - Async function invoked with each item and its index.
 * @returns Results in input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const poolSize = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => run()));
  return results;
}

/**
 * Run one per-source child process, streaming its output live with every line
 * prefixed by `[source]`.
 *
 * Under concurrency, lines from different children may interleave, but each line
 * names its source so it stays attributable. Nothing is buffered, so memory does
 * not scale with output size. A spawn-level failure (the child prints nothing)
 * is surfaced with an explicit prefixed line. Always resolves (never rejects) so
 * one failed source cannot abort the pool.
 *
 * @param scriptPath - Absolute path to the per-source script.
 * @param sourceName - Source name (child CLI argument and log prefix).
 * @param completionLabel - Called once on completion; returns e.g. `[3/46]`.
 * @returns The batch result once the child closes.
 */
function runChildStreaming(
  scriptPath: string,
  sourceName: string,
  completionLabel: () => string,
): Promise<BatchResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const prefix = `[${sourceName}] `;
    let settled = false;

    const finish = (success: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      const durationMs = Math.round(performance.now() - startTime);
      const status = success ? 'ok' : 'FAILED';
      const seconds = (durationMs / 1000).toFixed(1);
      // Completion marker on its own prefixed line.
      process.stdout.write(`${prefix}done ${completionLabel()} (${status}, ${seconds}s)\n`);
      resolve({ sourceName, success, durationMs });
    };

    const child = spawn('npx', ['tsx', scriptPath, sourceName], { env: process.env });

    // Prefix every line. readline emits a final line even without a trailing
    // newline, so no output is dropped when the stream closes.
    createInterface({ input: child.stdout }).on('line', (line) => {
      process.stdout.write(`${prefix}${line}\n`);
    });
    createInterface({ input: child.stderr }).on('line', (line) => {
      process.stderr.write(`${prefix}${line}\n`);
    });

    // Spawn-level failure (e.g. `npx` not found): the child prints nothing, so
    // surface the reason explicitly before finishing.
    child.on('error', (err) => {
      process.stderr.write(`${prefix}spawn failed: ${err.message}\n`);
      finish(false);
    });
    child.on('close', (code) => {
      finish(code === 0);
    });
  });
}

/**
 * Concurrent counterpart of {@link runBatch}.
 *
 * Runs the same per-source child process (`npx tsx <script> <source>`), but up
 * to `concurrency` at a time instead of strictly one-by-one. Each child's output
 * is streamed live with every line prefixed by `[source]`: lines from concurrent
 * children may interleave, but every line stays attributable to its source, and
 * nothing is buffered. Error isolation is preserved (a failed source does not
 * stop others) and the returned results are in input (source) order.
 *
 * The existing sequential {@link runBatch} is intentionally left untouched;
 * callers opt in to this variant one at a time.
 *
 * @param scriptPath - Absolute path to the per-source script.
 * @param sourceNames - Source names to process.
 * @param options.concurrency - Max child processes in flight (default 1).
 * @returns Array of results in source order.
 */
export function runBatchConcurrent(
  scriptPath: string,
  sourceNames: string[],
  options: { concurrency?: number } = {},
): Promise<BatchResult[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  const total = sourceNames.length;
  console.log(
    `(concurrency: ${concurrency}, ${total} sources; each line is prefixed with [source])\n`,
  );

  // Completion counter. Workers are async on a single thread (not OS threads),
  // so this increment is race-free.
  let completed = 0;
  const nextCompletionLabel = (): string => {
    completed += 1;
    return `[${completed}/${total}]`;
  };

  return mapWithConcurrency(sourceNames, concurrency, (sourceName) =>
    runChildStreaming(scriptPath, sourceName, nextCompletionLabel),
  );
}

/**
 * Parse a concurrency value (e.g. from an env var) into a positive integer.
 *
 * Invalid, missing, or < 1 values fall back to 1 (sequential). Pure, so the
 * parsing rules are unit-testable without touching the environment.
 *
 * @param raw - Raw string value (or undefined).
 * @returns An integer >= 1.
 */
export function parseConcurrency(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return 1;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.floor(n);
}

/**
 * Read a concurrency setting from an environment variable.
 *
 * Thin wrapper over {@link parseConcurrency} that reads `process.env[name]`.
 *
 * @param name - Environment variable name.
 * @returns An integer >= 1 (1 = sequential / opt-out).
 */
export function parseConcurrencyEnv(name: string): number {
  return parseConcurrency(process.env[name]);
}

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
