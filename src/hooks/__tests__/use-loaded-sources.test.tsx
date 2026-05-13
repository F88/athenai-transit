import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { SourceLoadStateProvider } from '../../contexts/source-load-state-provider';
import { useLoadedSources } from '../use-loaded-sources';
import type { LoadResult } from '../../repositories/athenai-repository';

function wrapper(loadResult: LoadResult) {
  return ({ children }: { children: ReactNode }) => (
    <SourceLoadStateProvider initialLoadResult={loadResult}>{children}</SourceLoadStateProvider>
  );
}

describe('useLoadedSources', () => {
  it('returns a set of loaded prefixes only', () => {
    const loadResult: LoadResult = {
      loaded: ['alpha', 'beta'],
      failed: [{ prefix: 'bad', error: new Error('x') }],
    };
    const { result } = renderHook(() => useLoadedSources(), { wrapper: wrapper(loadResult) });
    expect(result.current.size).toBe(2);
    expect(result.current.has('alpha')).toBe(true);
    expect(result.current.has('beta')).toBe(true);
  });

  it('excludes failed prefixes from the result', () => {
    const loadResult: LoadResult = {
      loaded: ['ok'],
      failed: [{ prefix: 'bad', error: new Error('x') }],
    };
    const { result } = renderHook(() => useLoadedSources(), { wrapper: wrapper(loadResult) });
    expect(result.current.has('ok')).toBe(true);
    expect(result.current.has('bad')).toBe(false);
  });

  it('returns an empty set when nothing loaded', () => {
    const loadResult: LoadResult = {
      loaded: [],
      failed: [{ prefix: 'bad', error: new Error('x') }],
    };
    const { result } = renderHook(() => useLoadedSources(), { wrapper: wrapper(loadResult) });
    expect(result.current.size).toBe(0);
  });

  it('throws when used outside a SourceLoadStateProvider', () => {
    expect(() => renderHook(() => useLoadedSources())).toThrow(
      /must be used within a SourceLoadStateProvider/,
    );
  });
});
