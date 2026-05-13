import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { SourceLoadStateProvider } from '../../contexts/source-load-state-provider';
import { useLoadResult } from '../use-load-result';
import type { LoadResult } from '../../repositories/athenai-repository';

function wrapper(loadResult: LoadResult, sourcesParam: string | null = null) {
  return ({ children }: { children: ReactNode }) => (
    <SourceLoadStateProvider initialLoadResult={loadResult} sourcesParam={sourcesParam}>
      {children}
    </SourceLoadStateProvider>
  );
}

describe('useLoadResult', () => {
  it('returns the startup load result snapshot verbatim', () => {
    const err = new Error('boom');
    const loadResult: LoadResult = {
      loaded: ['alpha', 'beta'],
      failed: [{ prefix: 'bad', error: err }],
    };
    const { result } = renderHook(() => useLoadResult(), { wrapper: wrapper(loadResult) });
    expect(result.current.loaded).toEqual(['alpha', 'beta']);
    expect(result.current.failed).toEqual([{ prefix: 'bad', error: err }]);
  });

  it('returns empty arrays when the initial load result is empty', () => {
    const loadResult: LoadResult = { loaded: [], failed: [] };
    const { result } = renderHook(() => useLoadResult(), { wrapper: wrapper(loadResult) });
    expect(result.current.loaded).toEqual([]);
    expect(result.current.failed).toEqual([]);
  });

  it('throws when used outside a SourceLoadStateProvider', () => {
    expect(() => renderHook(() => useLoadResult())).toThrow(
      /must be used within a SourceLoadStateProvider/,
    );
  });
});
