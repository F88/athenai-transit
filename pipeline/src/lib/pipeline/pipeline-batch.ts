/**
 * Per-source batch execution for pipeline CLI scripts.
 *
 * Runs a per-source script (`npx tsx <script> <source>`) once per source, either
 * sequentially ({@link runBatch}) or with bounded concurrency
 * ({@link runBatchConcurrent}), and summarizes the results. Split out of
 * `pipeline-utils.ts` to keep the batch-execution concern self-contained.
 */

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

import { EXIT_ERROR, EXIT_OK, EXIT_WARN } from './pipeline-utils';

const execFileAsync = promisify(execFile);

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
 * Concurrent counterpart of {@link runBatch}.
 *
 * Runs the same per-source child process (`npx tsx <script> <source>`), but up
 * to `concurrency` at a time instead of strictly one-by-one. Each child's output
 * is buffered and flushed as a single block on completion, so parallel runs stay
 * readable (no interleaving). Error isolation is preserved (a failed source does
 * not stop others) and the returned results are in input (source) order.
 *
 * The existing sequential {@link runBatch} is intentionally left untouched;
 * callers opt in to this variant one at a time.
 *
 * @param scriptPath - Absolute path to the per-source script.
 * @param sourceNames - Source names to process.
 * @param options.concurrency - Max child processes in flight (default 1).
 * @returns Array of results in source order.
 */
export async function runBatchConcurrent(
  scriptPath: string,
  sourceNames: string[],
  options: { concurrency?: number } = {},
): Promise<BatchResult[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  const total = sourceNames.length;
  console.log(`(concurrency: ${concurrency}, ${total} sources)\n`);

  // Completion counter. Workers are async on a single thread (not OS threads),
  // so this increment is race-free.
  let completed = 0;

  return mapWithConcurrency(sourceNames, concurrency, async (sourceName) => {
    const startTime = performance.now();
    let success = true;
    let output = '';

    try {
      const { stdout, stderr } = await execFileAsync('npx', ['tsx', scriptPath, sourceName], {
        env: process.env,
        // Per-source logs can be large (every extracted file is printed); avoid
        // ENOBUFS by allowing a generous buffer.
        maxBuffer: 64 * 1024 * 1024,
      });
      output = stdout + (stderr ? `\n${stderr}` : '');
    } catch (err) {
      success = false;
      const e = err as { stdout?: string; stderr?: string };
      output = (e.stdout ?? '') + (e.stderr ? `\n${e.stderr}` : '');
    }

    const durationMs = Math.round(performance.now() - startTime);
    completed += 1;

    // Readable parallel logs: buffer each source's whole output and flush it as
    // ONE atomic console.log on completion, wrapped in a labeled delimiter. A
    // single console.log never interleaves with another, so blocks stay intact;
    // the header (completion index / source / status / duration) makes each
    // block easy to locate even though they arrive in completion order, not
    // source order.
    const status = success ? 'ok' : 'FAILED';
    const seconds = (durationMs / 1000).toFixed(1);
    const header = `===== [${completed}/${total}] ${sourceName}: ${status} (${seconds}s) =====`;
    console.log(`${header}\n${output.trimEnd()}\n`);

    return { sourceName, success, durationMs };
  });
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
