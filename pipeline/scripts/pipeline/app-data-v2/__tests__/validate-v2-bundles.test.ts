/**
 * Tests for validate-v2-bundles.ts existence-check policy.
 *
 * Focus: classifyExistenceOutcome — the pure decision that a partial miss
 * (some sources missing their required bundles) is non-fatal and only a total
 * wipeout (no source present) is a hard error. This is what lets a single
 * upstream resource outage skip one source instead of blocking the whole
 * Blob update.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { classifyExistenceOutcome, type SourcePresence } from '../validate-v2-bundles';

function present(prefix: string): SourcePresence {
  return { prefix, allRequiredPresent: true };
}

function missing(prefix: string): SourcePresence {
  return { prefix, allRequiredPresent: false };
}

describe('classifyExistenceOutcome', () => {
  it('all sources present: nothing missing, not fatal', () => {
    const outcome = classifyExistenceOutcome([present('a'), present('b'), present('c')]);

    expect(outcome.presentPrefixes).toEqual(['a', 'b', 'c']);
    expect(outcome.missingPrefixes).toEqual([]);
    expect(outcome.fatal).toBe(false);
  });

  it('partial miss: skips the missing sources, NOT fatal (the core fix)', () => {
    // e.g. iyt2 removed upstream while every other source built fine.
    const outcome = classifyExistenceOutcome([present('kobus'), missing('iyt2'), present('ntbus')]);

    expect(outcome.presentPrefixes).toEqual(['kobus', 'ntbus']);
    expect(outcome.missingPrefixes).toEqual(['iyt2']);
    expect(outcome.fatal).toBe(false);
  });

  it('all sources missing: fatal (total build wipeout)', () => {
    const outcome = classifyExistenceOutcome([missing('a'), missing('b')]);

    expect(outcome.presentPrefixes).toEqual([]);
    expect(outcome.missingPrefixes).toEqual(['a', 'b']);
    expect(outcome.fatal).toBe(true);
  });

  it('single source present: not fatal', () => {
    const outcome = classifyExistenceOutcome([present('only')]);

    expect(outcome.fatal).toBe(false);
    expect(outcome.presentPrefixes).toEqual(['only']);
  });

  it('single source missing: fatal (every — i.e. the one — source is missing)', () => {
    const outcome = classifyExistenceOutcome([missing('only')]);

    expect(outcome.fatal).toBe(true);
    expect(outcome.missingPrefixes).toEqual(['only']);
  });

  it('one present among many missing: still not fatal', () => {
    const outcome = classifyExistenceOutcome([
      missing('a'),
      missing('b'),
      present('c'),
      missing('d'),
    ]);

    expect(outcome.presentPrefixes).toEqual(['c']);
    expect(outcome.missingPrefixes).toEqual(['a', 'b', 'd']);
    expect(outcome.fatal).toBe(false);
  });

  it('empty target list: not fatal (degenerate — nothing to wipe out)', () => {
    const outcome = classifyExistenceOutcome([]);

    expect(outcome.presentPrefixes).toEqual([]);
    expect(outcome.missingPrefixes).toEqual([]);
    expect(outcome.fatal).toBe(false);
  });

  it('preserves target order in both partitions', () => {
    const outcome = classifyExistenceOutcome([
      present('z'),
      missing('y'),
      present('x'),
      missing('w'),
    ]);

    expect(outcome.presentPrefixes).toEqual(['z', 'x']);
    expect(outcome.missingPrefixes).toEqual(['y', 'w']);
  });
});
