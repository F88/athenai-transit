import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { SourceLoadStateProvider } from '../../contexts/source-load-state-provider';
import { useIsForcedSourcesMode } from '../use-is-forced-sources-mode';
import type { LoadResult } from '../../repositories/athenai-repository';

function wrapper(loadResult: LoadResult, sourcesParam: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <SourceLoadStateProvider initialLoadResult={loadResult} sourcesParam={sourcesParam}>
      {children}
    </SourceLoadStateProvider>
  );
}

const emptyLoadResult: LoadResult = { loaded: [], failed: [] };

describe('useIsForcedSourcesMode', () => {
  it('returns `false` when sourcesParam is null (no URL ?sources= present)', () => {
    const { result } = renderHook(() => useIsForcedSourcesMode(), {
      wrapper: wrapper(emptyLoadResult, null),
    });
    expect(result.current).toBe(false);
  });

  it('returns `true` when sourcesParam is a non-empty string', () => {
    const { result } = renderHook(() => useIsForcedSourcesMode(), {
      wrapper: wrapper(emptyLoadResult, 'minkuru,toaran'),
    });
    expect(result.current).toBe(true);
  });

  it('returns `true` for the special `all` keyword', () => {
    const { result } = renderHook(() => useIsForcedSourcesMode(), {
      wrapper: wrapper(emptyLoadResult, 'all'),
    });
    expect(result.current).toBe(true);
  });

  it('returns `false` for an empty-string sourcesParam (matches load-layer contract)', () => {
    // `?sources=` with no value reaches the boot path as `''`, but
    // `data-source-manager.ts` treats it as "no URL override" via
    // `if (!sourcesParam) return null;`. The dialog must agree —
    // otherwise the load layer is in normal mode while the UI claims
    // forced mode, and the two layers visibly disagree.
    const { result } = renderHook(() => useIsForcedSourcesMode(), {
      wrapper: wrapper(emptyLoadResult, ''),
    });
    expect(result.current).toBe(false);
  });

  it('throws when used outside a SourceLoadStateProvider', () => {
    expect(() => renderHook(() => useIsForcedSourcesMode())).toThrow(
      /must be used within a SourceLoadStateProvider/,
    );
  });
});
