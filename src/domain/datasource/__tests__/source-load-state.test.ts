/**
 * Tests for source-load-state.ts (pure types + reducer).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  buildInitialSourceLoadState,
  sourceLoadStateReducer,
  type SourceLoadState,
  type SourceLoadStateAction,
} from '../source-load-state';
import type { LoadResult } from '../../../repositories/athenai-repository';

describe('buildInitialSourceLoadState', () => {
  it('returns an empty map when both loaded and failed are empty', () => {
    const loadResult: LoadResult = { loaded: [], failed: [] };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.size).toBe(0);
  });

  it('marks all loaded prefixes with status "loaded"', () => {
    const loadResult: LoadResult = {
      loaded: ['alpha', 'beta', 'gamma'],
      failed: [],
    };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.size).toBe(3);
    expect(state.get('alpha')).toEqual({ status: 'loaded' });
    expect(state.get('beta')).toEqual({ status: 'loaded' });
    expect(state.get('gamma')).toEqual({ status: 'loaded' });
  });

  it('marks all failed prefixes with status "failed" and preserves error', () => {
    const errA = new Error('network');
    const errB = new TypeError('parse');
    const loadResult: LoadResult = {
      loaded: [],
      failed: [
        { prefix: 'alpha', error: errA },
        { prefix: 'beta', error: errB },
      ],
    };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.size).toBe(2);
    expect(state.get('alpha')).toEqual({ status: 'failed', error: errA });
    expect(state.get('beta')).toEqual({ status: 'failed', error: errB });
  });

  it('handles a mix of loaded and failed entries', () => {
    const err = new Error('boom');
    const loadResult: LoadResult = {
      loaded: ['ok1', 'ok2'],
      failed: [{ prefix: 'bad', error: err }],
    };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.size).toBe(3);
    expect(state.get('ok1')?.status).toBe('loaded');
    expect(state.get('ok2')?.status).toBe('loaded');
    expect(state.get('bad')).toEqual({ status: 'failed', error: err });
  });

  it('omits prefixes that appear in neither array (= "never attempted")', () => {
    const loadResult: LoadResult = {
      loaded: ['known'],
      failed: [],
    };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.has('unknown')).toBe(false);
  });

  it('last write wins when the same prefix appears in both loaded and failed', () => {
    // Defensive: spec-wise this should not happen, but verify the reducer
    // does not crash and resolves deterministically (failed last).
    const err = new Error('x');
    const loadResult: LoadResult = {
      loaded: ['dup'],
      failed: [{ prefix: 'dup', error: err }],
    };
    const state = buildInitialSourceLoadState(loadResult);
    expect(state.get('dup')).toEqual({ status: 'failed', error: err });
  });
});

describe('sourceLoadStateReducer', () => {
  it('returns state unchanged (Phase 1 has no actions)', () => {
    const state: SourceLoadState = new Map([['x', { status: 'loaded' }]]);
    // Phase 1: SourceLoadStateAction is `never`; cast for the test.
    const result = sourceLoadStateReducer(state, undefined as unknown as SourceLoadStateAction);
    expect(result).toBe(state);
  });
});
