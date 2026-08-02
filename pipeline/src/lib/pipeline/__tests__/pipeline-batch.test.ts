import { describe, expect, it } from 'vitest';

import {
  type BatchResult,
  determineBatchExitCode,
  mapWithConcurrency,
  parseConcurrency,
} from '../pipeline-batch';
import { EXIT_ERROR, EXIT_OK, EXIT_WARN } from '../pipeline-utils';

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
// parseConcurrency
// ---------------------------------------------------------------------------

describe('parseConcurrency', () => {
  it('defaults to 1 for undefined / empty', () => {
    expect(parseConcurrency(undefined)).toBe(1);
    expect(parseConcurrency('')).toBe(1);
    expect(parseConcurrency('   ')).toBe(1);
  });

  it('parses a positive integer', () => {
    expect(parseConcurrency('6')).toBe(6);
    expect(parseConcurrency('1')).toBe(1);
  });

  it('floors a fractional value', () => {
    expect(parseConcurrency('4.9')).toBe(4);
  });

  it('falls back to 1 for invalid or < 1 values', () => {
    expect(parseConcurrency('0')).toBe(1);
    expect(parseConcurrency('-3')).toBe(1);
    expect(parseConcurrency('abc')).toBe(1);
    expect(parseConcurrency('NaN')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// mapWithConcurrency
// ---------------------------------------------------------------------------

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    // Later items resolve sooner, so completion order != input order.
    const results = await mapWithConcurrency([30, 10, 20, 0], 4, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });

    expect(results).toEqual(['0:30', '1:10', '2:20', '3:0']);
  });

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const seen: number[] = [];

    const results = await mapWithConcurrency(items, 4, (n) => {
      seen.push(n);
      return Promise.resolve(n * 2);
    });

    expect(results).toEqual(items.map((n) => n * 2));
    expect([...seen].sort((a, b) => a - b)).toEqual(items);
  });

  it('never exceeds the concurrency limit and reaches it', async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return null;
      },
    );

    expect(peak).toBe(3);
  });

  it('clamps concurrency to at least 1', async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3], 0, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 3));
      active -= 1;
      return null;
    });

    expect(peak).toBe(1);
  });

  it('handles an empty item list', async () => {
    const results = await mapWithConcurrency([], 4, () => Promise.resolve('x'));
    expect(results).toEqual([]);
  });
});
