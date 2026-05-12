import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { SourceLoadStateProvider } from '../../contexts/source-load-state-provider';
import { useSourceLoadStatus } from '../use-source-load-status';
import type { LoadResult } from '../../repositories/athenai-repository';

function wrapper(loadResult: LoadResult) {
  return ({ children }: { children: ReactNode }) => (
    <SourceLoadStateProvider initialLoadResult={loadResult}>{children}</SourceLoadStateProvider>
  );
}

describe('useSourceLoadStatus', () => {
  it('exposes per-prefix loaded entries', () => {
    const loadResult: LoadResult = { loaded: ['a', 'b'], failed: [] };
    const { result } = renderHook(() => useSourceLoadStatus(), { wrapper: wrapper(loadResult) });
    expect(result.current.size).toBe(2);
    expect(result.current.get('a')).toEqual({ status: 'loaded' });
    expect(result.current.get('b')).toEqual({ status: 'loaded' });
  });

  it('exposes per-prefix failed entries with error preserved', () => {
    const err = new Error('network');
    const loadResult: LoadResult = { loaded: [], failed: [{ prefix: 'x', error: err }] };
    const { result } = renderHook(() => useSourceLoadStatus(), { wrapper: wrapper(loadResult) });
    expect(result.current.get('x')).toEqual({ status: 'failed', error: err });
  });

  it('omits prefixes that were not attempted (no entry in either array)', () => {
    const loadResult: LoadResult = { loaded: ['known'], failed: [] };
    const { result } = renderHook(() => useSourceLoadStatus(), { wrapper: wrapper(loadResult) });
    expect(result.current.has('unknown')).toBe(false);
  });

  it('throws when used outside a SourceLoadStateProvider', () => {
    expect(() => renderHook(() => useSourceLoadStatus())).toThrow(
      /must be used within a SourceLoadStateProvider/,
    );
  });
});
