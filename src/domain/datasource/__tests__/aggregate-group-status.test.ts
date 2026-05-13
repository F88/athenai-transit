/**
 * Tests for aggregate-group-status.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { aggregateGroupLoadStatus, type GroupLoadStatus } from '../aggregate-group-status';
import type { SourceLoadState, SourceLoadStatusEntry } from '../source-load-state';

function mapOf(entries: Record<string, SourceLoadStatusEntry>): SourceLoadState {
  return new Map(Object.entries(entries));
}

describe('aggregateGroupLoadStatus', () => {
  describe('single prefix', () => {
    it('reports loaded when the single prefix is loaded', () => {
      const result = aggregateGroupLoadStatus(['a'], mapOf({ a: { status: 'loaded' } }));
      expect(result).toEqual<GroupLoadStatus>({
        status: 'loaded',
        loadedPrefixes: ['a'],
      });
    });

    it('reports failed when the single prefix failed', () => {
      const err = new Error('boom');
      const result = aggregateGroupLoadStatus(
        ['a'],
        mapOf({ a: { status: 'failed', error: err } }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'failed',
        failedPrefixes: [{ prefix: 'a', error: err }],
        notAttemptedPrefixes: [],
      });
    });

    it('reports notAttempted when the single prefix is absent', () => {
      const result = aggregateGroupLoadStatus(['a'], mapOf({}));
      expect(result).toEqual<GroupLoadStatus>({
        status: 'notAttempted',
        notAttemptedPrefixes: ['a'],
      });
    });
  });

  describe('multi prefix', () => {
    it('reports loaded when all prefixes are loaded', () => {
      const result = aggregateGroupLoadStatus(
        ['a', 'b'],
        mapOf({ a: { status: 'loaded' }, b: { status: 'loaded' } }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'loaded',
        loadedPrefixes: ['a', 'b'],
      });
    });

    it('reports notAttempted when none of the prefixes are present', () => {
      const result = aggregateGroupLoadStatus(['a', 'b'], mapOf({}));
      expect(result).toEqual<GroupLoadStatus>({
        status: 'notAttempted',
        notAttemptedPrefixes: ['a', 'b'],
      });
    });

    it('reports partial when some are loaded and the rest are not attempted', () => {
      const result = aggregateGroupLoadStatus(['a', 'b'], mapOf({ a: { status: 'loaded' } }));
      expect(result).toEqual<GroupLoadStatus>({
        status: 'partial',
        loadedPrefixes: ['a'],
        failedPrefixes: [],
        notAttemptedPrefixes: ['b'],
      });
    });

    it('reports partial when some are loaded and some failed (partial failure)', () => {
      const err = new Error('boom');
      const result = aggregateGroupLoadStatus(
        ['a', 'b'],
        mapOf({ a: { status: 'loaded' }, b: { status: 'failed', error: err } }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'partial',
        loadedPrefixes: ['a'],
        failedPrefixes: [{ prefix: 'b', error: err }],
        notAttemptedPrefixes: [],
      });
    });

    it('reports partial when loaded coexists with both failed and not-attempted', () => {
      const err = new Error('boom');
      const result = aggregateGroupLoadStatus(
        ['a', 'b', 'c'],
        mapOf({ a: { status: 'loaded' }, b: { status: 'failed', error: err } }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'partial',
        loadedPrefixes: ['a'],
        failedPrefixes: [{ prefix: 'b', error: err }],
        notAttemptedPrefixes: ['c'],
      });
    });

    it('reports failed when every attempted prefix failed (no loaded)', () => {
      const errA = new Error('a-boom');
      const errB = new Error('b-boom');
      const result = aggregateGroupLoadStatus(
        ['a', 'b'],
        mapOf({
          a: { status: 'failed', error: errA },
          b: { status: 'failed', error: errB },
        }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'failed',
        failedPrefixes: [
          { prefix: 'a', error: errA },
          { prefix: 'b', error: errB },
        ],
        notAttemptedPrefixes: [],
      });
    });

    it('reports failed when failed coexists with not-attempted (no loaded)', () => {
      const err = new Error('boom');
      const result = aggregateGroupLoadStatus(
        ['a', 'b'],
        mapOf({ a: { status: 'failed', error: err } }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'failed',
        failedPrefixes: [{ prefix: 'a', error: err }],
        notAttemptedPrefixes: ['b'],
      });
    });

    it('preserves input prefix order in the per-status sub-lists', () => {
      const err = new Error('boom');
      const result = aggregateGroupLoadStatus(
        ['c', 'a', 'b'],
        mapOf({
          a: { status: 'loaded' },
          c: { status: 'loaded' },
          b: { status: 'failed', error: err },
        }),
      );
      expect(result).toEqual<GroupLoadStatus>({
        status: 'partial',
        loadedPrefixes: ['c', 'a'],
        failedPrefixes: [{ prefix: 'b', error: err }],
        notAttemptedPrefixes: [],
      });
    });
  });

  describe('empty input', () => {
    it('returns notAttempted with an empty list', () => {
      const result = aggregateGroupLoadStatus([], mapOf({}));
      expect(result).toEqual<GroupLoadStatus>({
        status: 'notAttempted',
        notAttemptedPrefixes: [],
      });
    });
  });
});
